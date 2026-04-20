"""
ImageExtractor v2 — Recorte inteligente de imagens, tabelas e gráficos de PDFs.

Estratégias:
1. Detectar se a questão menciona figura/gráfico/tabela/mapa no texto
2. Usar PyMuPDF para mapear a posição do texto da questão na página
3. Recortar a região visual ABAIXO do enunciado (onde normalmente fica a imagem)
4. Fallback: extrair imagem embedded se existir na página
"""

import base64
import re
from typing import Any


# Palavras que indicam conteúdo visual necessário
_VISUAL_KEYWORDS = re.compile(
    r"\b(figura|imagem|gr[áa]fico|mapa|tabela|quadro|diagrama|esquema|"
    r"ilustra[çc][ãa]o|conforme|observe|analise|com\s+base\s+na|"
    r"de\s+acordo\s+com\s+a\s+(?:figura|tabela|imagem|gr[áa]fico)|"
    r"a\s+(?:figura|tabela|imagem|gr[áa]fico)\s+(?:abaixo|acima|seguinte|ao\s+lado)|"
    r"considerando\s+o\s+gr[áa]fico|pela\s+tabela)\b",
    re.IGNORECASE,
)

# Palavras que indicam questão matemática com formatação visual
_MATH_VISUAL_KEYWORDS = re.compile(
    r"\b(equa[çc][ãa]o|f[óo]rmula|express[ãa]o|c[áa]lculo|matriz|"
    r"geometria|[aá]rea|volume|per[ií]metro|tri[aâ]ngulo|c[íi]rculo|"
    r"coordenadas?|gr[áa]fico\s+de)\b",
    re.IGNORECASE,
)


class ImageExtractor:

    def extract_question_images(
        self, pdf_path: str, questions: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Para cada questão, detecta se precisa de conteúdo visual e recorta.

        Pipeline:
        1. Verificar se questão menciona visual no texto
        2. Localizar posição do texto da questão na página (PyMuPDF)
        3. Recortar região visual relevante (abaixo/ao redor do enunciado)
        4. Fallback: imagem embedded
        """
        try:
            import fitz
            doc = fitz.open(pdf_path)
        except ImportError:
            for q in questions:
                q.setdefault("has_image", False)
            return questions
        except Exception:
            for q in questions:
                q.setdefault("has_image", False)
            return questions

        try:
            # Construir mapa de imagens por página uma vez
            page_image_map = self._build_page_image_map(doc)

            for question in questions:
                page_num = self._resolve_page(doc, question)
                if not page_num:
                    question.setdefault("has_image", False)
                    continue
                question["page"] = page_num

                page = doc[page_num - 1]
                content = question.get("content", "")
                base_text = question.get("base_text", "") or ""
                full_q_text = content + " " + base_text

                # Detectar necessidade de conteúdo visual
                needs_visual = bool(_VISUAL_KEYWORDS.search(full_q_text))
                needs_math_visual = bool(_MATH_VISUAL_KEYWORDS.search(full_q_text))
                has_page_images = page_num in page_image_map

                if not needs_visual and not needs_math_visual and not has_page_images:
                    question["has_image"] = False
                    continue

                # Tentativa 1: recorte por posição do texto (página da questão)
                force = needs_visual or needs_math_visual
                image_result = self._crop_by_text_position(
                    page, doc, question, force
                )
                # Texto-base com figura costuma ficar na página anterior à pergunta
                if not image_result and base_text and page_num > 1 and (
                    needs_visual or needs_math_visual
                ):
                    prev_page = doc[page_num - 2]
                    image_result = self._crop_by_text_position(
                        prev_page, doc, question, force, prefer_base_text=True
                    )

                if image_result:
                    question["has_image"] = True
                    question["image_base64"] = image_result
                    continue

                # Tentativa 2: imagem embedded na página
                if has_page_images and needs_visual:
                    embedded = self._extract_embedded_image(
                        doc, page_image_map[page_num]
                    )
                    if embedded:
                        question["has_image"] = True
                        question["image_base64"] = embedded
                        continue

                question.setdefault("has_image", False)

        except Exception:
            for q in questions:
                q.setdefault("has_image", False)
        finally:
            try:
                doc.close()
            except Exception:
                pass

        return questions

    def _resolve_page(self, doc, question: dict[str, Any]) -> int | None:
        """Página onde localizar a questão (metadado, busca no PDF ou número)."""
        pn = question.get("page")
        if pn and isinstance(pn, int) and 1 <= pn <= len(doc):
            return pn

        content = (question.get("content") or "").strip()
        base_text = (question.get("base_text") or "").strip()
        qn = int(question.get("number") or 0)

        needles: list[str] = []
        if len(content) >= 10:
            needles.append(content[:min(50, len(content))])
        if len(base_text) >= 12:
            needles.append(base_text[:min(60, len(base_text))])
        if qn and 1 <= qn <= 200:
            needles.append(f"{qn:02d}")
            needles.append(str(qn))

        for i in range(len(doc)):
            page = doc[i]
            for needle in needles:
                if needle and page.search_for(needle):
                    return i + 1
        return None

    def _build_page_image_map(self, doc) -> dict[int, list]:
        """Mapeia número de página → lista de xrefs de imagens."""
        result = {}
        for page_idx in range(len(doc)):
            images = doc[page_idx].get_images(full=True)
            if images:
                result[page_idx + 1] = [img[0] for img in images]
        return result

    def _crop_by_text_position(
        self,
        page,
        doc,
        question: dict,
        force_crop: bool,
        prefer_base_text: bool = False,
    ) -> str | None:
        """
        Localiza onde o enunciado da questão está na página e recorta
        a região visual abaixo/ao redor (onde ficam gráficos/tabelas).
        """
        try:
            import fitz

            content_start = (question.get("content", "") or "")[:80]
            base_snip = (question.get("base_text", "") or "")[:100]

            if prefer_base_text and base_snip.strip():
                search_order = [base_snip[:50].strip(), content_start[:40].strip()]
            else:
                search_order = [content_start[:40].strip(), base_snip[:50].strip()]

            instances = []
            for search_text in search_order:
                if len(search_text) < 6:
                    continue
                instances = page.search_for(search_text)
                if instances:
                    break

            if not instances:
                q_num = question.get("number", 0)
                if q_num:
                    instances = page.search_for(f"{q_num:02d}")
                if not instances and q_num:
                    instances = page.search_for(str(q_num))

            if not instances:
                return None

            # Pegar a primeira ocorrência do texto na página
            text_rect = instances[0]

            # Área de recorte: desde o enunciado até ~40% abaixo da altura da página
            page_height = page.rect.height
            page_width = page.rect.width

            crop_top = max(0, text_rect.y0 - 10)
            crop_bottom = min(page_height, text_rect.y1 + page_height * 0.35)
            crop_rect = fitz.Rect(0, crop_top, page_width, crop_bottom)

            # Verificar se há imagens ou vetores na área recortada
            drawings = page.get_drawings()
            images_in_area = page.get_images(full=True)

            has_visual_in_area = False

            # Verificar vetores/desenhos na área
            for drawing in drawings:
                rect = drawing.get("rect")
                if rect and crop_rect.intersects(rect):
                    if drawing.get("width", 0) > 50 or drawing.get("height", 0) > 50:
                        has_visual_in_area = True
                        break

            # Verificar imagens embedded na área
            if not has_visual_in_area:
                for img_xref, *_ in images_in_area:
                    img_rects = page.get_image_rects(img_xref)
                    if img_rects and any(crop_rect.intersects(r) for r in img_rects):
                        has_visual_in_area = True
                        break

            # Sem desenho na área: só desiste se não for obrigatório recortar
            # (palavras-chave de figura/tabela no enunciado → force_crop)
            if not has_visual_in_area and not force_crop:
                return None

            # Renderizar a área recortada em alta resolução
            mat = fitz.Matrix(2.0, 2.0)  # 2x zoom = ~144 DPI
            clip = crop_rect
            pixmap = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
            img_bytes = pixmap.tobytes("png")
            return f"data:image/png;base64,{base64.b64encode(img_bytes).decode()}"

        except Exception:
            return None

    def _extract_embedded_image(self, doc, xrefs: list) -> str | None:
        """Extrai a primeira imagem embedded relevante."""
        try:
            for xref in xrefs[:3]:
                base_image = doc.extract_image(xref)
                if not base_image:
                    continue
                img_bytes = base_image["image"]
                ext = base_image.get("ext", "png")
                # Ignorar imagens muito pequenas (logos, ícones)
                if len(img_bytes) < 2000:
                    continue
                return f"data:image/{ext};base64,{base64.b64encode(img_bytes).decode()}"
        except Exception:
            pass
        return None
