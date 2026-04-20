"""
AnswerKeyExtractor: Extrai o gabarito de PDFs ou texto de concursos públicos.

Suporta múltiplos formatos reais de gabarito:
- "01 C"           (número + espaço + letra, sem separador)
- "01-C"           (com hífen)
- "01. C"          (com ponto)
- "01) C"          (com parêntese)
- "01 C  19 C"     (duas colunas na mesma linha)
- "A B C D E..."   (linha sequencial de letras)
"""

import re
import json
import time
from typing import Any


LOG_PATH = "debug-03dbee.log"


def _log(message: str, data: dict = None, hypothesis: str = ""):
    try:
        entry = {
            "sessionId": "03dbee",
            "timestamp": int(time.time() * 1000),
            "location": "answer_key_extractor.py",
            "message": message,
            "hypothesisId": hypothesis,
            "data": data or {},
        }
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass


class AnswerKeyExtractor:
    def extract_from_text(self, text: str) -> dict[int, str]:
        answer_key = {}

        # Localizar seção de gabarito
        gabarito_text = self._find_gabarito_section(text) or text

        _log("gabarito_section_found", {
            "has_section": gabarito_text != text,
            "preview": gabarito_text[:300],
        }, "H3")

        # Tentar padrões em ordem de especificidade

        # Padrão 1: "01 C" ou "01C" — número seguido diretamente de letra (sem separador)
        # Muito comum em gabaritos brasileiros
        result = self._extract_no_separator(gabarito_text)
        _log("pattern1_result", {"count": len(result), "sample": dict(list(result.items())[:5])}, "H3")
        if result:
            answer_key.update(result)
            return answer_key

        # Padrão 2: "01-C" / "01. C" / "01) C" — com separador
        result = self._extract_with_separator(gabarito_text)
        _log("pattern2_result", {"count": len(result)}, "H3")
        if result:
            answer_key.update(result)
            return answer_key

        # Padrão 3: "Questão 01: C"
        result = self._extract_verbose(gabarito_text)
        _log("pattern3_result", {"count": len(result)}, "H3")
        if result:
            answer_key.update(result)
            return answer_key

        # Padrão 4: Linha sequencial "A B C D E A B C..."
        result = self._extract_sequential(gabarito_text)
        _log("pattern4_result", {"count": len(result)}, "H3")
        answer_key.update(result)

        return answer_key

    def _extract_no_separator(self, text: str) -> dict[int, str]:
        """
        Extrai gabarito no formato '01 C' ou '01C'.
        Suporta 2 colunas por linha: '01 C  19 C'.
        """
        answer_key = {}

        # Padrão: número (1-3 dígitos) seguido de espaço(s) e letra A-E
        # Suporta múltiplas ocorrências por linha (2 colunas)
        pattern = re.compile(r"\b(\d{1,3})\s+([A-Ea-e])\b")

        for line in text.split("\n"):
            line_stripped = line.strip()
            if not line_stripped:
                continue

            matches = list(pattern.finditer(line_stripped))
            # Linha de gabarito válida: só números e letras (sem palavras longas)
            # Verificar que a linha não é texto corrido (muitas palavras != gabarito)
            words = line_stripped.split()
            non_q_words = [w for w in words if not re.match(r"^\d{1,3}$", w) and not re.match(r"^[A-Ea-e]$", w)]

            if len(non_q_words) <= 2 and len(matches) >= 1:
                for m in matches:
                    num = int(m.group(1))
                    letter = m.group(2).upper()
                    if 1 <= num <= 200:
                        answer_key[num] = letter

        return answer_key

    def _extract_with_separator(self, text: str) -> dict[int, str]:
        """Extrai '01-C', '01. C', '01) C', '01|C'."""
        answer_key = {}
        pattern = re.compile(r"\b(\d{1,3})\s*[-\.)\|]\s*([A-Ea-e])\b", re.MULTILINE)
        for m in pattern.finditer(text):
            num = int(m.group(1))
            letter = m.group(2).upper()
            if 1 <= num <= 200:
                answer_key[num] = letter
        return answer_key

    def _extract_verbose(self, text: str) -> dict[int, str]:
        """Extrai 'Questão 01: C' ou 'Q01 - C'."""
        answer_key = {}
        pattern = re.compile(
            r"(?:quest[ãa]o|q\.?)\s*(\d{1,3})\s*[:\-]\s*([A-Ea-e])\b",
            re.IGNORECASE | re.MULTILINE,
        )
        for m in pattern.finditer(text):
            num = int(m.group(1))
            letter = m.group(2).upper()
            if 1 <= num <= 200:
                answer_key[num] = letter
        return answer_key

    def _extract_sequential(self, text: str) -> dict[int, str]:
        """Extrai linha de letras sequenciais: 'A B C D E A B C...'."""
        answer_key = {}
        lines = text.split("\n")
        for line in lines:
            letters = re.findall(r"\b([A-Ea-e])\b", line)
            if len(letters) >= 5:
                start_num = self._detect_starting_number(text, line)
                for i, letter in enumerate(letters):
                    answer_key[start_num + i] = letter.upper()
                if len(answer_key) >= 5:
                    return answer_key
        return answer_key

    def _find_gabarito_section(self, text: str) -> str | None:
        """Localiza a seção de gabarito no texto."""
        patterns = [
            r"GABARITO\s+DEFINITIVO",
            r"GABARITO\s+OFICIAL",
            r"GABARITO\s+PRELIMINAR",
            r"GABARITO",
            r"RESPOSTA\s+OFICIAL",
            r"RESPOSTAS",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                start = match.start()
                return text[start:start + 3000]
        return None

    def _detect_starting_number(self, full_text: str, gabarito_line: str) -> int:
        idx = full_text.find(gabarito_line)
        if idx > 0:
            nearby = full_text[max(0, idx - 100):idx]
            nums = re.findall(r"\b(\d{1,3})\b", nearby)
            if nums:
                return int(nums[-1])
        return 1
