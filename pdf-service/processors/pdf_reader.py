"""
PDFReader: Lê PDFs e extrai texto e metadados.

Estratégias (em ordem de qualidade):
1. pdfplumber com reordenação de 2 colunas por clusters de coordenadas XY
2. OCR via Tesseract com pré-processamento de imagem (contraste, binarização, deskew)
3. Fallback PyMuPDF para PDFs com embeddings proprietários
"""

import re
import statistics
from typing import Any


class PDFReader:
    OCR_THRESHOLD = 80  # chars mínimos para não tentar OCR

    def read(self, pdf_path: str) -> dict[str, Any]:
        try:
            import pdfplumber
        except ImportError:
            raise RuntimeError("pdfplumber não instalado. Execute: pip install pdfplumber")

        full_text = ""
        pages = []
        used_ocr = False

        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)

                # Detectar textos repetitivos entre páginas (cabeçalhos/rodapés)
                repeated_lines = self._detect_repeated_lines(pdf) if total_pages > 2 else set()

                for i, page in enumerate(pdf.pages):
                    raw_text = page.extract_text() or ""
                    is_scanned = len(raw_text.strip()) < self.OCR_THRESHOLD

                    if is_scanned:
                        page_text = self._ocr_page_with_preprocessing(page, pdf_path, i)
                        used_ocr = True
                    else:
                        page_text = self._extract_with_layout_detection(page, raw_text)

                    page_text = self._remove_repeated_lines(page_text, repeated_lines)
                    page_text = self.strip_watermarks(page_text)

                    pages.append({
                        "number": i + 1,
                        "text": page_text,
                        "width": float(page.width),
                        "height": float(page.height),
                        "has_images": len(page.images) > 0,
                    })
                    full_text += f"\n\n[PAGE:{i + 1}]\n{page_text}"

            return {
                "full_text": full_text,
                "pages": pages,
                "total_pages": total_pages,
                "has_text": bool(full_text.strip()),
                "used_ocr": used_ocr,
            }
        except Exception as e:
            raise RuntimeError(f"Erro ao ler PDF: {str(e)}")

    # ─────────────────────────────────────────────────────────────────────────
    # Layout detection
    # ─────────────────────────────────────────────────────────────────────────

    def _extract_with_layout_detection(self, page, raw_text: str) -> str:
        """Detecta layout (1 coluna, 2 colunas, misto) e extrai texto na ordem correta."""
        try:
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            if not words:
                return raw_text

            page_width = float(page.width)
            column_dividers = self._find_column_dividers(words, page_width)

            if not column_dividers:
                # Layout de 1 coluna — retornar texto normal
                return raw_text

            # Layout multi-coluna: dividir palavras por região e ordenar
            return self._reconstruct_multicolumn_text(words, column_dividers, page_width)

        except Exception:
            return raw_text

    def _find_column_dividers(self, words: list[dict], page_width: float) -> list[float]:
        """
        Detecta divisores verticais entre colunas usando histograma de densidade de texto.
        Retorna lista de posições X onde há "vazio" significativo (gap entre colunas).
        """
        if not words:
            return []

        # Criar histograma de presença de texto por faixa X (resolução: 10pts)
        resolution = 10
        buckets = int(page_width / resolution) + 1
        hist = [0] * buckets

        for w in words:
            x0 = float(w["x0"])
            x1 = float(w["x1"])
            for b in range(int(x0 / resolution), min(int(x1 / resolution) + 1, buckets)):
                hist[b] += 1

        # Encontrar gaps (regiões de baixa densidade)
        avg_density = statistics.mean(h for h in hist if h > 0) if any(h > 0 for h in hist) else 0
        gap_threshold = avg_density * 0.15  # gap = menos de 15% da densidade média

        # Encontrar regiões de gap contínuas
        gaps = []
        in_gap = False
        gap_start = 0
        for i, density in enumerate(hist):
            if density <= gap_threshold:
                if not in_gap:
                    gap_start = i
                    in_gap = True
            else:
                if in_gap:
                    gap_end = i
                    gap_width = (gap_end - gap_start) * resolution
                    gap_center = (gap_start + gap_end) / 2 * resolution
                    # Só considerar gaps no meio da página (20% a 80%) e com largura mínima
                    rel_pos = gap_center / page_width
                    if 0.2 <= rel_pos <= 0.8 and gap_width >= 20:
                        gaps.append(gap_center)
                    in_gap = False

        # Mesclar gaps próximos (< 30pts de distância)
        merged = []
        for g in sorted(gaps):
            if not merged or g - merged[-1] > 30:
                merged.append(g)

        return merged if len(merged) >= 1 else []

    def _reconstruct_multicolumn_text(
        self, words: list[dict], dividers: list[float], page_width: float
    ) -> str:
        """
        Reconstrói o texto de um layout multi-coluna.
        Trata elementos full-width (que cruzam a linha divisória) como seções separadas.
        """
        # Definir regiões de coluna
        boundaries = [0.0] + dividers + [page_width]
        columns = [(boundaries[i], boundaries[i + 1]) for i in range(len(boundaries) - 1)]

        def get_column(x0: float, x1: float) -> int | None:
            """Retorna o índice da coluna ou None se o elemento é full-width"""
            for i, (col_start, col_end) in enumerate(columns):
                # Se mais de 60% do elemento está nesta coluna
                overlap = max(0, min(x1, col_end) - max(x0, col_start))
                element_width = x1 - x0
                if element_width > 0 and overlap / element_width > 0.6:
                    return i
            return None  # full-width

        # Agrupar palavras em linhas (tolerância Y de 3 pontos)
        line_tolerance = 4
        line_groups: dict[int, list[dict]] = {}
        for w in words:
            line_key = round(float(w["top"]) / line_tolerance)
            line_groups.setdefault(line_key, []).append(w)

        # Para cada linha, determinar se é full-width ou pertence a uma coluna
        segments: list[tuple[float, int | None, str]] = []  # (top, col_idx, text)
        for line_key in sorted(line_groups.keys()):
            line_words = sorted(line_groups[line_key], key=lambda w: float(w["x0"]))
            if not line_words:
                continue
            top = line_words[0]["top"]

            # Verificar se a linha cruza um divisor (full-width)
            x_min = min(float(w["x0"]) for w in line_words)
            x_max = max(float(w["x1"]) for w in line_words)
            span = x_max - x_min
            is_full_width = span > page_width * 0.55

            line_text = " ".join(w["text"] for w in line_words)

            if is_full_width:
                segments.append((top, None, line_text))  # full-width
            else:
                col = get_column(x_min, x_max)
                segments.append((top, col, line_text))

        # Reconstruir: blocos de cada coluna, precedidos por elementos full-width
        result_lines = []
        current_col_texts: dict[int | None, list[tuple[float, str]]] = {}

        def flush_columns():
            """Esvaziar colunas na ordem: col 0, col 1, ..."""
            for col_idx in sorted(k for k in current_col_texts if k is not None):
                items = sorted(current_col_texts[col_idx], key=lambda x: x[0])
                result_lines.extend(t for _, t in items)
            current_col_texts.clear()

        for top, col, text in segments:
            if col is None:
                # Elemento full-width: esvaziar colunas acumuladas antes
                flush_columns()
                result_lines.append(text)
            else:
                current_col_texts.setdefault(col, []).append((top, text))

        flush_columns()
        return "\n".join(result_lines)

    # ─────────────────────────────────────────────────────────────────────────
    # OCR com pré-processamento
    # ─────────────────────────────────────────────────────────────────────────

    def _ocr_page_with_preprocessing(self, page, pdf_path: str, page_idx: int) -> str:
        """
        OCR com pipeline de pré-processamento:
        1. Renderizar página em alta resolução
        2. Converter para escala de cinza
        3. Binarização adaptativa (Otsu ou similar)
        4. Deskew se necessário
        5. Passar para Tesseract com configuração otimizada
        """
        # Tentativa 1: pdfplumber → PIL → pré-processamento → Tesseract
        try:
            import pytesseract
            from PIL import Image, ImageFilter, ImageEnhance, ImageOps

            # Renderizar em 300 DPI (mínimo para OCR decente)
            pil_img = page.to_image(resolution=300).original

            # Pré-processamento
            processed = self._preprocess_for_ocr(pil_img)

            # Tesseract com configuração para texto de múltiplas colunas
            # --psm 1: orientação automática + segmentação completa de página
            # --oem 3: LSTM (mais preciso)
            config = r"--psm 1 --oem 3 -l por"
            text = pytesseract.image_to_string(processed, config=config)
            if len(text.strip()) > 30:
                return text
        except Exception:
            pass

        # Tentativa 2: PyMuPDF com texto embedded (alguns PDFs "escaneados" têm texto oculto)
        try:
            import fitz
            doc = fitz.open(pdf_path)
            fitz_page = doc[page_idx]
            text = fitz_page.get_text("text")
            doc.close()
            if len(text.strip()) > 30:
                return text
        except Exception:
            pass

        return ""

    def _preprocess_for_ocr(self, img):
        """Pré-processa imagem PIL para melhorar qualidade do OCR."""
        from PIL import Image, ImageFilter, ImageEnhance, ImageOps
        import io

        # 1. Converter para escala de cinza
        gray = img.convert("L")

        # 2. Aumentar contraste
        enhancer = ImageEnhance.Contrast(gray)
        gray = enhancer.enhance(2.0)

        # 3. Nitidez
        gray = gray.filter(ImageFilter.SHARPEN)

        # 4. Binarização por threshold adaptativo
        # Usar threshold de Otsu via ponto de corte simples (Pillow puro)
        gray = gray.point(lambda x: 0 if x < 140 else 255, "1")
        gray = gray.convert("L")

        # 5. Deskew leve: verificar se há biblioteca disponível
        try:
            import numpy as np
            from PIL import Image as PILImage

            arr = np.array(gray)
            # Detectar ângulo de inclinação pelo método de projeção horizontal
            angle = self._detect_skew(arr)
            if abs(angle) > 0.5:  # só corrigir se inclinação > 0.5°
                from PIL import Image as PILImage
                gray = PILImage.fromarray(arr).rotate(angle, expand=True, fillcolor=255)
        except ImportError:
            pass  # numpy não disponível, pular deskew

        return gray

    def _detect_skew(self, arr) -> float:
        """Detecta ângulo de inclinação usando variância das projeções horizontais."""
        try:
            import numpy as np

            best_angle = 0.0
            best_variance = 0.0

            for angle in range(-5, 6):  # testar ângulos de -5 a +5 graus
                from PIL import Image
                import io
                rotated = Image.fromarray(arr).rotate(angle, expand=True, fillcolor=255)
                r_arr = np.array(rotated)
                projections = np.sum(r_arr < 128, axis=1)  # pixels escuros por linha
                variance = float(np.var(projections))
                if variance > best_variance:
                    best_variance = variance
                    best_angle = float(angle)

            return best_angle
        except Exception:
            return 0.0

    # ─────────────────────────────────────────────────────────────────────────
    # Remoção de cabeçalhos/rodapés repetitivos
    # ─────────────────────────────────────────────────────────────────────────

    def _detect_repeated_lines(self, pdf) -> set[str]:
        """
        Detecta linhas que aparecem em mais de 60% das páginas (cabeçalho/rodapé).
        """
        total = len(pdf.pages)
        if total < 3:
            return set()

        line_counts: dict[str, int] = {}
        sample_pages = pdf.pages[:min(total, 10)]  # Amostrar até 10 páginas

        for page in sample_pages:
            text = page.extract_text() or ""
            lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 3]
            # Verificar primeiras e últimas 3 linhas de cada página
            candidates = lines[:3] + lines[-3:] if len(lines) >= 6 else lines
            for line in candidates:
                line_counts[line] = line_counts.get(line, 0) + 1

        threshold = max(2, len(sample_pages) * 0.6)
        return {line for line, count in line_counts.items() if count >= threshold}

    def _remove_repeated_lines(self, text: str, repeated: set[str]) -> str:
        """Remove linhas repetitivas (cabeçalho/rodapé) do texto de uma página."""
        if not repeated:
            return text
        lines = text.split("\n")
        filtered = [l for l in lines if l.strip() not in repeated]
        return "\n".join(filtered)

    @staticmethod
    def strip_watermarks(text: str) -> str:
        """Remove watermarks conhecidos e linhas de ruído injetadas por ferramentas de PDF."""
        lines = text.split("\n")
        cleaned = []
        for line in lines:
            stripped = line.strip()
            # pcimarkpci (pciconcursos.com.br DRM watermark)
            if stripped.startswith("pcimarkpci "):
                continue
            # Linha longa sem espaços que parece Base64/hash
            if len(stripped) > 40 and " " not in stripped and re.match(r"^[A-Za-z0-9+/=:]+$", stripped):
                continue
            cleaned.append(line)
        return "\n".join(cleaned)
