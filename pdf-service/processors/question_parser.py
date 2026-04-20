"""
QuestionParser v3 — Pipeline inteligente de extração de questões de PDFs de concursos.

Etapas do pipeline:
1. Limpeza de watermarks e ruídos
2. Remoção do preâmbulo institucional (antes da 1ª questão)
3. Detecção e exclusão de blocos de redação
4. Extração de texto-base compartilhado (propaga para todas as questões do range)
5. Divisão em blocos de questão por alternativas (robusto, formato independente)
6. Parsing individual: enunciado limpo + alternativas + metadados de origem
"""

import re
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Padrões globais compilados uma vez
# ─────────────────────────────────────────────────────────────────────────────

# Formato 1: (A) texto  — parêntese ANTES da letra (mais comum em CESPE, FCC, VUNESP)
_ALT_BEFORE = re.compile(
    r"(?:^|\n)\s*\(([A-Ea-e])\)\s+(.+?)(?=(?:\n\s*\([A-Ea-e]\)\s)|$)",
    re.DOTALL | re.MULTILINE,
)

# Formato 2: A) texto  /  A. texto  /  A- texto  /  A – texto  (parêntese/ponto DEPOIS)
# Inclui em-dash (–) e espaço antes da alternativa
_ALT_AFTER = re.compile(
    r"(?:^|\n)\s*([A-Ea-e])\s*[\)\.\-–]\s+(.+?)(?=(?:\n\s*[A-Ea-e]\s*[\)\.\-–]\s)|$)",
    re.DOTALL | re.MULTILINE,
)

# Formato 3: A - texto  (letra + espaço + hífen/dash + espaço) — IBFC, AOCP
_ALT_DASH_SPACE = re.compile(
    r"(?:^|\n)\s*([A-Ea-e])\s+[-–]\s+(.+?)(?=(?:\n\s*[A-Ea-e]\s+[-–]\s)|$)",
    re.DOTALL | re.MULTILINE,
)

# Regex para localizar UMA alternativa individual (para detecção de sequência)
# Detecta qualquer dos formatos acima
_ANY_ALT = re.compile(
    r"(?:^|\n)\s*(?:\(([A-Ea-e])\)|([A-Ea-e])\s*[\)\.\-–]|([A-Ea-e])\s+[-–])\s+\S",
    re.MULTILINE,
)

# Inícios de questão
_Q_EXPLICIT = re.compile(
    r"(?:^|\n)\s*(?:QUEST[ÃA]O|Q\.?)\s*(\d{1,3})\b",
    re.MULTILINE | re.IGNORECASE,
)
_Q_SEPARATOR = re.compile(r"(?:^|\n)\s*(\d{1,3})\s*[\.)\-–]\s+", re.MULTILINE)
_Q_SPACE = re.compile(
    r"(?:^|\n)\s*(\d{2,3})\s+(?=[A-ZÁÉÍÓÚÂÊÔÀÈÌÒÙÃÕ])", re.MULTILINE
)

# Texto-base: detecta qualquer diretiva que mencione um range de questões
# Flexível o suficiente para capturar variações como:
# "Leia atentamente o texto a seguir para responder às questões de 01 a 05."
# "Texto para as questões 1 a 5"
# "Responda às questões 6 a 10 com base no texto"
# "Considere o texto abaixo para as questões de 11 a 15"
_BASE_TEXT_DIRECTIVE = re.compile(
    r"(?:"
    r"leia\b[^\n]{0,60}?(?:quest[õo]es?|perguntas?)"
    r"|texto[^\n]{0,40}?(?:quest[õo]es?|perguntas?)"
    r"|responda[^\n]{0,40}?(?:quest[õo]es?|perguntas?)"
    r"|considere[^\n]{0,40}?(?:quest[õo]es?|perguntas?)"
    r"|com\s+base[^\n]{0,50}?(?:quest[õo]es?|perguntas?)"
    r"|quest[õo]es?\s+(?:de\s+)?\d"
    r")"
    r"[^\n]{0,80}?(\d{1,3})\s+[àa]\s+(\d{1,3})",
    re.IGNORECASE,
)

# Redação / conteúdo não-objetivo
_ESSAY_MARKERS = re.compile(
    r"(?:^|\n)\s*(?:"
    r"REDA[ÇC][ÃA]O|"
    r"PROPOSTA\s+DE\s+REDA[ÇC][ÃA]O|"
    r"PRODU[ÇC][ÃA]O\s+TEXTUAL|"
    r"TEXTO\s+DISSERTATIVO|"
    r"TEMA\s+PARA\s+REDA[ÇC][ÃA]O|"
    r"FOLHA\s+DE\s+REDA[ÇC][ÃA]O|"
    r"PARTE\s+II?\s*[:\-]?\s*REDA[ÇC][ÃA]O|"
    r"PROVA\s+DISCURSIVA"
    r")\b",
    re.IGNORECASE | re.MULTILINE,
)

# Seções de matéria (títulos em maiúsculo que marcam início de nova disciplina)
_SUBJECT_SECTION = re.compile(
    r"(?:^|\n)\s*(?:"
    r"L[ÍI]NGUA\s+PORTUGUESA|MATEM[ÁA]TICA|HIST[ÓO]RIA|GEOGRAFIA|"
    r"CI[ÊE]NCIAS?|F[ÍI]SICA|QU[ÍI]MICA|BIOLOGIA|"
    r"DIREITO\s+\w+|INFORM[ÁA]TICA|"
    r"CONHECIMENTOS?\s+(?:GERAIS?|ESPECÍFICOS?|B[ÁA]SICOS?)|"
    r"RAZ[AÃ]O\s+L[ÓO]GICA|RACIOC[IÍ]NIO\s+L[ÓO]GICO|"
    r"L[ÍI]NGUA\s+INGLESA|INGL[EÊ]S|ESPANHOL|"
    r"ATUALIDADES|ADMINISTRA[ÇC][ÃA]O|"
    r"PORTUGU[EÊ]S"
    r")\s*$",
    re.IGNORECASE | re.MULTILINE,
)

# Watermarks conhecidos
_WATERMARK = re.compile(
    r"(?:^|\n)pcimarkpci\s+[^\n]*",
    re.MULTILINE,
)
_BASE64_LINE = re.compile(r"(?:^|\n)[A-Za-z0-9+/=:]{40,}(?=\n|$)", re.MULTILINE)


class QuestionParser:

    def parse(self, pages: list[dict], metadata: dict = None) -> list[dict[str, Any]]:
        """
        Pipeline completo de extração de questões.
        """
        # 1. Montar texto com marcadores de página
        full_text = self._build_full_text(pages)

        # 2. Limpar watermarks e ruídos
        full_text = self._strip_noise(full_text)

        # 3. Detectar e marcar blocos de redação para exclusão
        essay_ranges = self._find_essay_ranges(full_text)

        # 4. Detectar seção de questões (ignorar preâmbulo institucional)
        question_section_start = self._find_question_section_start(full_text)
        question_text = full_text[question_section_start:]

        # 5. Extrair textos-base com seus ranges de questões
        # IMPORTANTE: buscar no full_text inteiro pois a diretiva pode estar no preâmbulo
        base_texts = self._extract_base_texts(full_text, 0)

        # 6. Detectar formato de alternativas
        alt_format = self._detect_alt_format(question_text)

        # 7. Dividir em blocos de questão
        blocks = self._split_into_question_blocks(question_text, alt_format)

        # 8. Parsear cada bloco
        questions = []
        seen_numbers: set[int] = set()

        for i, (block, block_abs_start) in enumerate(blocks):
            abs_start = question_section_start + block_abs_start
            if self._is_in_essay_range(abs_start, essay_ranges):
                continue

            q = self._parse_block(
                block,
                i + 1,
                alt_format,
                metadata or {},
                full_text,
                question_section_start + block_abs_start,
            )
            if not q:
                continue

            if self._block_is_essay(block):
                continue

            # Deduplicar: ignorar se já temos questão com este número
            q_num = q.get("number", 0)
            if q_num in seen_numbers:
                continue
            seen_numbers.add(q_num)

            q = self._attach_base_text(q, base_texts)
            questions.append(q)

        # Garantir ordem original da prova pelo número da questão
        questions.sort(key=lambda q: q.get("number", 9999))

        # Reatribuir position de acordo com ordem final (1, 2, 3...)
        for idx, q in enumerate(questions, start=1):
            q["position"] = idx
            if q.get("origin"):
                q["origin"]["position_in_doc"] = idx

        return questions

    # ─────────────────────────────────────────────────────────────────────────
    # 1 + 2. Construção e limpeza do texto
    # ─────────────────────────────────────────────────────────────────────────

    def _build_full_text(self, pages: list[dict]) -> str:
        return "".join(f"\n\n[PAGE:{p['number']}]\n{p['text']}" for p in pages)

    def _strip_noise(self, text: str) -> str:
        text = _WATERMARK.sub("", text)
        text = _BASE64_LINE.sub("", text)
        return text

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Detecção de blocos de redação
    # ─────────────────────────────────────────────────────────────────────────

    def _find_essay_ranges(self, text: str) -> list[tuple[int, int]]:
        """
        Retorna lista de (start, end) de blocos que são seções de redação.
        Tudo dentro desses ranges deve ser ignorado.
        """
        ranges = []
        for m in _ESSAY_MARKERS.finditer(text):
            start = m.start()
            # Estender até o próximo marcador de matéria ou 3000 chars
            next_section = _SUBJECT_SECTION.search(text, m.end())
            end = next_section.start() if next_section else min(start + 3000, len(text))
            ranges.append((start, end))
        return ranges

    def _is_in_essay_range(self, pos: int, ranges: list[tuple[int, int]]) -> bool:
        return any(s <= pos <= e for s, e in ranges)

    def _block_is_essay(self, block: str) -> bool:
        """Verifica se o bloco em si é sobre redação."""
        return bool(_ESSAY_MARKERS.search(block))

    # ─────────────────────────────────────────────────────────────────────────
    # 4. Localizar início real das questões (ignorar preâmbulo)
    # ─────────────────────────────────────────────────────────────────────────

    def _find_question_section_start(self, text: str) -> int:
        """
        Encontra onde as questões objetivas realmente começam.
        Ignora o preâmbulo: instruções, dados do candidato, nome da prova, etc.

        Estratégia: encontrar a primeira ocorrência de alternativas válidas (A)(B)(C)
        e voltar para o início do bloco de questão correspondente.
        Limitar o recuo a 1500 chars para não capturar o preâmbulo.
        """
        alt_re = self._get_alt_re(text)

        # Encontrar primeira sequência de alternativas A,B,C
        first_alt_pos = None
        alt_seq_start = None
        alt_count = 0
        for m in alt_re.finditer(text):
            letter = m.group(1).upper()
            if letter == "A":
                alt_seq_start = m.start()
                alt_count = 1
            elif alt_seq_start is not None:
                alt_count += 1
                if alt_count >= 3:
                    first_alt_pos = alt_seq_start
                    break
            else:
                alt_seq_start = None
                alt_count = 0

        if first_alt_pos is None:
            return 0

        # Olhar 1500 chars antes das primeiras alternativas
        lookback_start = max(0, first_alt_pos - 1500)
        lookback = text[lookback_start:first_alt_pos]

        # Encontrar o início da questão nesse lookback
        q_start_in_lookback = None
        for pattern in [_Q_EXPLICIT, _Q_SEPARATOR, _Q_SPACE]:
            matches = list(pattern.finditer(lookback))
            if matches:
                # Pegar a última ocorrência (mais próxima das alternativas)
                last_match = matches[-1]
                num = int(last_match.group(1))
                if 1 <= num <= 200:
                    candidate = lookback_start + last_match.start()
                    if q_start_in_lookback is None or candidate < q_start_in_lookback:
                        q_start_in_lookback = candidate

        if q_start_in_lookback is not None:
            # Mínimo: não voltar além de 50 chars antes do número para não pegar
            # seção de matéria (LÍNGUA PORTUGUESA, etc.)
            # Verificar se há título de matéria logo antes
            preamble = text[max(0, q_start_in_lookback - 200):q_start_in_lookback]
            section_match = list(_SUBJECT_SECTION.finditer(preamble))
            if section_match:
                # Começar na seção de matéria para incluir o nome da disciplina
                return q_start_in_lookback - (len(preamble) - section_match[-1].start())
            return q_start_in_lookback

        # Fallback: começar onde achar o primeiro número de questão
        return lookback_start

    # ─────────────────────────────────────────────────────────────────────────
    # 5. Extração de textos-base compartilhados
    # ─────────────────────────────────────────────────────────────────────────

    def _strip_internal_markers(self, text: str) -> str:
        """Remove marcadores internos de página do texto exibido ao usuário."""
        if not text:
            return text
        t = re.sub(r"\[PAGE:\d+\]\s*", "", text)
        return re.sub(r"\n{3,}", "\n\n", t).strip()

    def _extract_base_texts(
        self, text: str, abs_offset: int
    ) -> list[dict]:
        """
        Detecta blocos de texto-base que se referem a intervalos de questões.
        Usa padrão flexível que captura qualquer diretiva "questões de X a Y".
        """
        base_texts = []
        seen_ranges: set[tuple[int, int]] = set()

        for m in _BASE_TEXT_DIRECTIVE.finditer(text):
            try:
                q_start = int(m.group(1))
                q_end = int(m.group(2))
            except (IndexError, TypeError, ValueError):
                continue

            q_range = (min(q_start, q_end), max(q_start, q_end))
            if q_range in seen_ranges:
                continue
            seen_ranges.add(q_range)

            text_block = self._extract_base_text_block(text, m.start(), q_range[0])
            text_block = self._strip_internal_markers(text_block) if text_block else ""
            if text_block and len(text_block.strip()) > 20:
                base_texts.append({
                    "content": text_block.strip(),
                    "directive": m.group(0).strip(),
                    "q_start": q_range[0],
                    "q_end": q_range[1],
                    "section": self._find_nearby_section(text, m.start()),
                })

        return base_texts

    def _extract_base_text_block(
        self, text: str, directive_pos: int, first_q_num: int
    ) -> str:
        """
        Extrai o texto-base: o conteúdo entre a instrução e o início da primeira questão.
        Inclui parágrafos antes da instrução (título, autor, etc.) até a questão anterior.
        """
        # Encontrar onde começa a primeira questão do range
        # Tentativas flexíveis de encontrar o número
        q_match = None
        for pattern_str in [
            rf"(?:^|\n)\s*{first_q_num:02d}\s+",
            rf"(?:^|\n)\s*{first_q_num}\s*[\.)\-–]\s",
            rf"(?:^|\n)\s*{first_q_num}\s+",
        ]:
            pattern = re.compile(pattern_str, re.MULTILINE)
            q_match = pattern.search(text, directive_pos)
            if q_match:
                break

        block_end = q_match.start() if q_match else directive_pos + 2000

        # Pegar texto antes da diretiva (até 2500 chars / última alternativa anterior)
        lookback_start = max(0, directive_pos - 2500)

        # Não incluir texto de questões anteriores (parar na última alternativa antes)
        prev_alts = list(_ALT_BEFORE.finditer(text[lookback_start:directive_pos]))
        if not prev_alts:
            prev_alts = list(_ALT_AFTER.finditer(text[lookback_start:directive_pos]))
        if prev_alts:
            lookback_start = lookback_start + prev_alts[-1].end()
        else:
            # Sem alternativas anteriores: limitar ao marcador de página mais recente
            # para não capturar conteúdo de páginas anteriores (instruções, capa, etc.)
            page_markers_before = list(
                re.finditer(r"\[PAGE:\d+\]", text[lookback_start:directive_pos])
            )
            if page_markers_before:
                # Usar o ÚLTIMO marcador de página antes da diretiva
                last_marker = page_markers_before[-1]
                lookback_start = lookback_start + last_marker.start()

        return text[lookback_start:block_end]

    def _find_nearby_section(self, text: str, pos: int) -> str | None:
        """Encontra o nome da seção/matéria mais próximo antes da posição."""
        lookback = text[max(0, pos - 500):pos]
        matches = list(_SUBJECT_SECTION.finditer(lookback))
        if matches:
            return matches[-1].group(0).strip()
        return None

    # ─────────────────────────────────────────────────────────────────────────
    # 6. Detecção de formato de alternativas
    # ─────────────────────────────────────────────────────────────────────────

    def _detect_alt_format(self, text: str) -> str:
        """
        Detecta o formato dominante de alternativas no texto.
        Retorna: 'paren_before', 'paren_after', ou 'dash_space'.
        """
        n_before = len(_ALT_BEFORE.findall(text))
        n_after = len(_ALT_AFTER.findall(text))
        n_dash = len(_ALT_DASH_SPACE.findall(text))
        dominant = max(
            [("paren_before", n_before), ("paren_after", n_after), ("dash_space", n_dash)],
            key=lambda x: x[1],
        )
        return dominant[0]

    def _get_alt_re(self, text: str):
        fmt = self._detect_alt_format(text)
        return {"paren_before": _ALT_BEFORE, "paren_after": _ALT_AFTER, "dash_space": _ALT_DASH_SPACE}[fmt]

    def _get_all_alt_res(self) -> list:
        """Retorna todos os padrões de alternativa, para fallback."""
        return [_ALT_BEFORE, _ALT_AFTER, _ALT_DASH_SPACE]

    # ─────────────────────────────────────────────────────────────────────────
    # 7. Divisão em blocos de questão
    # ─────────────────────────────────────────────────────────────────────────

    def _split_into_question_blocks(
        self, text: str, alt_format: str
    ) -> list[tuple[str, int]]:
        """
        Retorna lista de (block_text, block_start_in_text).

        Estratégia robusta:
        1. Usar _ANY_ALT para detectar QUALQUER alternativa, independente de formato
        2. Agrupar em sequências válidas (A,B,C,... em ordem, tolerando gaps de ±1)
        3. Para cada sequência, buscar o número da questão antes dela
        4. Incluir marcador [PAGE:N] mais próximo para rastreamento
        """
        alt_re = {
            "paren_before": _ALT_BEFORE,
            "paren_after": _ALT_AFTER,
            "dash_space": _ALT_DASH_SPACE,
        }.get(alt_format, _ALT_BEFORE)

        # Pré-mapear marcadores de página
        page_marker_positions = [
            (m.start(), int(m.group(1)))
            for m in re.finditer(r"\[PAGE:(\d+)\]", text)
        ]

        # Encontrar starts de sequências de alternativas usando _ANY_ALT
        # Uma sequência válida: letra A encontrada, seguida de B, C (com tolerância de gap)
        alt_seq_starts: list[int] = []
        LETTER_ORDER = "ABCDE"

        seq_start: int | None = None
        seq_last_letter: str | None = None
        seq_count: int = 0

        for m in _ANY_ALT.finditer(text):
            # Extrair qual letra foi encontrada (dos 3 grupos possíveis)
            letter = (m.group(1) or m.group(2) or m.group(3) or "").upper()
            if not letter:
                continue

            if seq_start is None:
                # Só inicia uma nova sequência a partir do 'A'
                if letter == "A":
                    seq_start = m.start()
                    seq_last_letter = "A"
                    seq_count = 1
            else:
                # Verificar se é a próxima letra esperada (ou pula uma: A→C permitido)
                try:
                    last_idx = LETTER_ORDER.index(seq_last_letter)
                    curr_idx = LETTER_ORDER.index(letter)
                except ValueError:
                    # Reiniciar
                    seq_start = None
                    seq_count = 0
                    continue

                if curr_idx == last_idx + 1:
                    # Progressão normal A→B→C→D→E
                    seq_last_letter = letter
                    seq_count += 1
                    if seq_count >= 3:
                        alt_seq_starts.append(seq_start)
                        seq_start = None
                        seq_last_letter = None
                        seq_count = 0
                elif curr_idx <= last_idx:
                    # Voltou para letra anterior — nova sequência começa aqui se for 'A'
                    if letter == "A":
                        seq_start = m.start()
                        seq_last_letter = "A"
                        seq_count = 1
                    else:
                        seq_start = None
                        seq_count = 0
                # else: gap maior que 1 (A→C) — tolerado mas não incrementa count,
                # mantém a sequência ativa aguardando a próxima letra

        if not alt_seq_starts:
            # Fallback: tentar dividir pelo número da questão diretamente
            return [(b, p) for p, b in self._split_by_number_with_pos(text)]

        blocks = []
        n = len(alt_seq_starts)

        for i, alt_start in enumerate(alt_seq_starts):
            lookback_start = alt_seq_starts[i - 1] if i > 0 else 0
            preamble = text[lookback_start:alt_start]

            # Buscar o número da questão no preamble (último número válido antes das alts)
            q_start_in_preamble = None
            for pattern in [_Q_EXPLICIT, _Q_SEPARATOR, _Q_SPACE]:
                matches = list(pattern.finditer(preamble))
                if matches:
                    last = matches[-1]
                    num = int(last.group(1))
                    if 1 <= num <= 200:
                        q_start_in_preamble = lookback_start + last.start()
                        break

            block_start = q_start_in_preamble if q_start_in_preamble is not None else lookback_start

            # Incluir o marcador [PAGE:N] mais recente antes do bloco
            # sem retroagir além da questão anterior
            min_allowed = alt_seq_starts[i - 1] if i > 0 else 0
            page_marker_start = self._find_last_page_marker_before(
                page_marker_positions, block_start
            )
            if (
                page_marker_start is not None
                and page_marker_start >= min_allowed
                and page_marker_start < block_start
            ):
                block_start = page_marker_start

            # Fim do bloco: fim das alternativas desta questão
            next_boundary = alt_seq_starts[i + 1] if i + 1 < n else len(text)
            matches_in_block = list(alt_re.finditer(text[alt_start:next_boundary]))
            if not matches_in_block:
                # Tentar os outros formatos
                for other_re in [_ALT_BEFORE, _ALT_AFTER, _ALT_DASH_SPACE]:
                    if other_re == alt_re:
                        continue
                    matches_in_block = list(other_re.finditer(text[alt_start:next_boundary]))
                    if matches_in_block:
                        break
            if matches_in_block:
                block_end = alt_start + matches_in_block[-1].end()
            else:
                block_end = next_boundary

            blocks.append((text[block_start:block_end], block_start))

        return blocks

    def _find_last_page_marker_before(
        self, page_markers: list[tuple[int, int]], pos: int
    ) -> int | None:
        """Retorna a posição do marcador [PAGE:N] imediatamente antes de pos."""
        result = None
        for marker_pos, _ in page_markers:
            if marker_pos <= pos:
                result = marker_pos
            else:
                break
        return result

    def _split_by_number_with_pos(self, text: str) -> list[tuple[int, str]]:
        positions = []
        for pattern in [_Q_EXPLICIT, _Q_SEPARATOR, _Q_SPACE]:
            for m in pattern.finditer(text):
                num = int(m.group(1))
                if 1 <= num <= 200:
                    positions.append((m.start(), num))
        positions.sort(key=lambda x: x[0])
        deduped = []
        for pos, num in positions:
            if not deduped or pos - deduped[-1][0] > 20:
                deduped.append((pos, num))
        if len(deduped) < 2:
            return []
        result = []
        for i, (pos, _) in enumerate(deduped):
            end = deduped[i + 1][0] if i + 1 < len(deduped) else len(text)
            result.append((pos, text[pos:end]))
        return result

    # ─────────────────────────────────────────────────────────────────────────
    # 8. Parsing de bloco individual
    # ─────────────────────────────────────────────────────────────────────────

    def _page_at_doc_offset(self, full_text: str, offset: int) -> int | None:
        """Última página [PAGE:N] antes de offset (para quando o bloco não traz o marcador)."""
        if offset <= 0:
            return None
        before = full_text[:offset]
        markers = list(re.finditer(r"\[PAGE:(\d+)\]", before))
        if not markers:
            return None
        return int(markers[-1].group(1))

    def _parse_block(
        self,
        block: str,
        fallback_num: int,
        alt_format: str,
        metadata: dict,
        full_text: str,
        block_offset_in_full: int,
    ) -> dict | None:
        if not block or len(block.strip()) < 10:
            return None

        # Detectar páginas de origem (marcador no bloco ou última página antes do início do bloco)
        page_matches = list(re.finditer(r"\[PAGE:(\d+)\]", block))
        source_page = int(page_matches[0].group(1)) if page_matches else None
        if source_page is None:
            source_page = self._page_at_doc_offset(full_text, block_offset_in_full)
        clean = re.sub(r"\[PAGE:\d+\]", "", block).strip()

        # Extrair alternativas — tentar formato dominante, depois os outros
        alt_re = {
            "paren_before": _ALT_BEFORE,
            "paren_after": _ALT_AFTER,
            "dash_space": _ALT_DASH_SPACE,
        }.get(alt_format, _ALT_BEFORE)

        alt_matches = list(alt_re.finditer(clean))

        # Se não encontrou suficiente, tentar os outros formatos
        if len(alt_matches) < 2:
            for other_re in [_ALT_BEFORE, _ALT_AFTER, _ALT_DASH_SPACE]:
                if other_re == alt_re:
                    continue
                candidate = list(other_re.finditer(clean))
                if len(candidate) > len(alt_matches):
                    alt_matches = candidate
                    if len(alt_matches) >= 3:
                        break

        if len(alt_matches) < 2:
            return None

        first_alt_pos = alt_matches[0].start()
        alternatives = []
        for j, m in enumerate(alt_matches):
            letter = m.group(1).upper()
            content = re.sub(r"\[PAGE:\d+\]\s*", "", m.group(2)).strip()
            if len(content) > 1000:
                content = content[:997] + "..."
            alternatives.append({"letter": letter, "order": j + 1, "content": content})

        # Enunciado: texto antes da primeira alternativa
        content_raw = clean[:first_alt_pos].strip()

        # Detectar número da questão
        num_match = re.match(
            r"(?:QUEST[ÃA]O\s*)?(\d{1,3})\s*[\.)\-–]?\s",
            clean,
            re.IGNORECASE,
        )
        question_number = int(num_match.group(1)) if num_match else fallback_num

        # Remover número do início do enunciado
        content = re.sub(
            r"^(?:QUEST[ÃA]O\s*)?\s*\d{1,3}\s*[\.)\-–]?\s+",
            "",
            content_raw,
            flags=re.IGNORECASE,
        ).strip()

        if len(content) < 8:
            return None

        # Detectar seção/matéria pelo contexto
        section = self._detect_section_from_block(clean)

        return {
            "number": question_number,
            "content": content,
            "alternatives": alternatives,
            "base_text": None,          # preenchido por _attach_base_text
            "section": section,         # título de matéria detectado no bloco
            "page": source_page,
            "position": fallback_num,
            "raw_text": clean[:2000],
            "confidence": self._confidence(alternatives, content),
            "has_image": False,
            "image_base64": None,
            # Rastreabilidade completa
            "origin": {
                "page": source_page,
                "block_offset": block_offset_in_full,
                "position_in_doc": fallback_num,
                "banca": metadata.get("banca"),
                "concurso": metadata.get("concurso"),
                "cidade": metadata.get("cidade"),
                "ano": metadata.get("ano"),
                "cargo": metadata.get("cargo"),
                "materia": metadata.get("materia") or section,
                "filename": metadata.get("filename"),
            },
        }

    def _detect_section_from_block(self, text: str) -> str | None:
        """Detecta o nome da disciplina/seção no bloco ou nos 3 chars antes."""
        match = _SUBJECT_SECTION.search(text)
        return match.group(0).strip() if match else None

    # ─────────────────────────────────────────────────────────────────────────
    # 9. Associação de texto-base
    # ─────────────────────────────────────────────────────────────────────────

    def _attach_base_text(
        self, question: dict, base_texts: list[dict]
    ) -> dict:
        """
        Se a questão cair dentro do range de algum texto-base, anexa esse texto.
        Propaga para TODAS as questões do range, não apenas a primeira.
        """
        num = question.get("number", 0)
        for bt in base_texts:
            if bt["q_start"] <= num <= bt["q_end"]:
                question["base_text"] = bt["content"]
                question["base_text_directive"] = bt.get("directive")
                question["base_text_section"] = bt.get("section")
                break
        return question

    # ─────────────────────────────────────────────────────────────────────────
    # Utilitários
    # ─────────────────────────────────────────────────────────────────────────

    def _confidence(self, alternatives: list, content: str) -> float:
        score = 0.5
        if len(alternatives) >= 4:
            score += 0.3
        elif len(alternatives) == 3:
            score += 0.15
        if 30 <= len(content) <= 2000:
            score += 0.1
        if all(len(a["content"]) > 3 for a in alternatives):
            score += 0.1
        return min(score, 1.0)
