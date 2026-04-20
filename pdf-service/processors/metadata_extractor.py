"""
MetadataExtractor: Extrai automaticamente metadados de PDFs de concursos públicos.

Extrai das primeiras páginas:
- Banca (organizadora)
- Concurso / órgão
- Cidade / estado
- Ano
- Cargo
- Nível (fundamental, médio, superior)
- Tipo de prova (objetiva, discursiva, mista)

Estratégia: regex sobre cabeçalho das primeiras 3 páginas + dicionários de entidades conhecidas.
"""

import re
from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# Dicionários de entidades conhecidas
# ─────────────────────────────────────────────────────────────────────────────

KNOWN_BANCAS = [
    "VUNESP", "FCC", "CESPE", "CEBRASPE", "FGV", "IBFC", "IDECAN", "IADES",
    "QUADRIX", "FUNIVERSA", "ESAF", "AOCP", "FEPESE", "NCE", "CONSULPLAN",
    "OBJETIVA", "FUNDATEC", "COPS", "COPEVE", "ACAFE", "FUVEST", "COMVEST",
    "CESGRANRIO", "FUNCAB", "IBAM", "IBEG", "INEP", "COVEST", "UEPA",
    "UFRPE", "UFBA", "UECE", "UEL", "UEG", "FAUEL", "FADESP",
    "NUCEPE", "COVEST", "COVEST", "MOVENS", "SELECON",
    "AVANÇA SP", "MAKROPLAN", "CPCON", "MS CONCURSOS", "NOVA CONCURSOS",
    "LEGALLE", "AMEOSC", "FAPEMS", "AMAUC", "JFS CONCURSOS",
]

KNOWN_ORGANS = [
    "Prefeitura", "Câmara Municipal", "Câmara de Vereadores",
    "Tribunal de Justiça", "Tribunal Regional", "Tribunal Superior",
    "Ministério Público", "Defensoria Pública", "Procuradoria",
    "Secretaria Municipal", "Secretaria Estadual",
    "Polícia Civil", "Polícia Militar", "Polícia Federal",
    "DETRAN", "SAMU", "INSS", "ANATEL", "ANEEL", "ANS",
    "Receita Federal", "Banco do Brasil", "Caixa Econômica",
    "BNDES", "BACEN", "TCU", "TCE", "CGU",
]

ESTADOS_BR = {
    "AC": "Acre", "AL": "Alagoas", "AM": "Amazonas", "AP": "Amapá",
    "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal",
    "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão",
    "MG": "Minas Gerais", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso",
    "PA": "Pará", "PB": "Paraíba", "PE": "Pernambuco",
    "PI": "Piauí", "PR": "Paraná", "RJ": "Rio de Janeiro",
    "RN": "Rio Grande do Norte", "RO": "Rondônia", "RR": "Roraima",
    "RS": "Rio Grande do Sul", "SC": "Santa Catarina", "SE": "Sergipe",
    "SP": "São Paulo", "TO": "Tocantins",
}

CAPITAIS_BR = {
    "Rio Branco", "Maceió", "Macapá", "Manaus", "Salvador",
    "Fortaleza", "Brasília", "Vitória", "Goiânia", "São Luís",
    "Cuiabá", "Campo Grande", "Belo Horizonte", "Belém", "João Pessoa",
    "Curitiba", "Recife", "Teresina", "Porto Alegre", "Natal",
    "Porto Velho", "Boa Vista", "Florianópolis", "Aracaju", "São Paulo",
    "Palmas", "Rio de Janeiro",
}


class MetadataExtractor:
    """
    Extrai metadados de concurso a partir do texto das primeiras páginas do PDF.
    Retorna um dicionário com campos preenchidos apenas quando há confiança razoável.
    """

    def extract(self, pages: list[dict]) -> dict:
        """
        Recebe as páginas extraídas pelo PDFReader e retorna metadados inferidos.

        Args:
            pages: Lista de dicts com {"number": int, "text": str, ...}

        Returns:
            {
                "banca": str | None,
                "concurso": str | None,
                "cidade": str | None,
                "estado": str | None,
                "ano": int | None,
                "cargo": str | None,
                "nivel": str | None,
                "tipo_prova": str | None,
                "confidence": dict,
            }
        """
        # Usar apenas as primeiras 3 páginas (onde ficam as capas e cabeçalhos)
        header_text = "\n".join(p["text"] for p in pages[:3])
        first_page = pages[0]["text"] if pages else ""

        result = {
            "banca": self._extract_banca(header_text),
            "concurso": self._extract_concurso(header_text),
            "cidade": self._extract_cidade(header_text),
            "estado": self._extract_estado(header_text),
            "ano": self._extract_ano(header_text),
            "cargo": self._extract_cargo(header_text),
            "nivel": self._extract_nivel(header_text),
            "tipo_prova": self._extract_tipo_prova(header_text),
        }

        # Adicionar confidence por campo
        result["confidence"] = {
            k: "high" if v else "none"
            for k, v in result.items()
            if k != "confidence"
        }

        return result

    # ─────────────────────────────────────────────────────────────────────────
    # Extratores específicos
    # ─────────────────────────────────────────────────────────────────────────

    def _extract_banca(self, text: str) -> Optional[str]:
        """Detecta a banca organizadora."""
        text_upper = text.upper()

        # 1. Banca conhecida por nome exato
        for banca in KNOWN_BANCAS:
            if banca.upper() in text_upper:
                return banca

        # 2. Padrões como "Banca: VUNESP" ou "Organização: FCC"
        match = re.search(
            r"(?:banca|organiza(?:ção|dora)|institui(?:ção|to))\s*[:\-]?\s*([A-Z][A-Za-z\s\-\.]+?)(?:\n|,|\.|/|\()",
            text,
            re.IGNORECASE,
        )
        if match:
            candidate = match.group(1).strip()
            if 2 <= len(candidate) <= 60:
                return candidate

        return None

    def _extract_concurso(self, text: str) -> Optional[str]:
        """Detecta o nome do concurso/órgão."""

        # 1. Padrões explícitos
        patterns = [
            r"(?:concurso\s+público\s+(?:n[oº°]\s*\d+[\/\-]\d+\s+)?(?:da|do|para)\s+)([^\n]{5,80})",
            r"(?:edital\s+(?:n[oº°]\s*[\d\/\-]+\s+)?(?:do\s+)?concurso\s+(?:público\s+)?(?:da|do|para)\s+)([^\n]{5,80})",
            r"(?:seleção\s+(?:pública|simplificada)\s+(?:da|do|para)\s+)([^\n]{5,80})",
        ]
        for pat in patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        # 2. Busca por órgão conhecido em linha isolada (primeiras linhas)
        for line in text.split("\n")[:20]:
            line_stripped = line.strip()
            if 5 < len(line_stripped) < 80:
                for organ in KNOWN_ORGANS:
                    if organ.lower() in line_stripped.lower():
                        return line_stripped

        return None

    def _extract_cidade(self, text: str) -> Optional[str]:
        """Detecta cidade/município."""

        # 1. Padrão "Município de X" / "Prefeitura de X"
        match = re.search(
            r"(?:prefeitura|município|câmara)\s+(?:municipal\s+)?de\s+([A-ZÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÃ][a-záéíóúâêîôûàèìòùã\s]+?)(?:\s*[-\/,\n]|\s+–|\s+\()",
            text,
            re.IGNORECASE,
        )
        if match:
            cidade = match.group(1).strip()
            if 3 <= len(cidade) <= 50:
                return cidade

        # 2. Capitais conhecidas
        for capital in CAPITAIS_BR:
            if capital in text:
                return capital

        # 3. Padrão "cidade/UF" ou "cidade - UF"
        match = re.search(
            r"([A-ZÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÃ][a-záéíóúâêîôûàèìòùã\s]{2,30})\s*[\/\-]\s*([A-Z]{2})\b",
            text,
        )
        if match:
            cidade = match.group(1).strip()
            uf = match.group(2)
            if uf in ESTADOS_BR:
                return cidade

        return None

    def _extract_estado(self, text: str) -> Optional[str]:
        """Detecta estado/UF."""

        # 1. UF depois de "/"
        match = re.search(r"[A-Za-z\s]{3,}/\s*([A-Z]{2})\b", text)
        if match and match.group(1) in ESTADOS_BR:
            return ESTADOS_BR[match.group(1)]

        # 2. Estado por extenso
        for uf, nome in ESTADOS_BR.items():
            if f"Estado de {nome}" in text or f"Estado do {nome}" in text:
                return nome

        # 3. Sigla isolada no contexto
        match = re.search(
            r"(?:estado|governo)\s+(?:do\s+|de\s+|da\s+)?([A-Z]{2})\b",
            text,
            re.IGNORECASE,
        )
        if match and match.group(1).upper() in ESTADOS_BR:
            return ESTADOS_BR[match.group(1).upper()]

        return None

    def _extract_ano(self, text: str) -> Optional[int]:
        """Detecta o ano do concurso."""

        # 1. Padrões de ano em editais: "edital N/XXXX", "concurso XXXX"
        match = re.search(
            r"(?:edital|concurso|prova|sele(?:ção|cao))\s+[\w\-\/]*(?:20\d{2}|19\d{2})",
            text,
            re.IGNORECASE,
        )
        if match:
            year_match = re.search(r"(20\d{2}|19\d{2})", match.group())
            if year_match:
                return int(year_match.group(1))

        # 2. "XXXX" isolado nas primeiras 500 chars
        header = text[:500]
        years = re.findall(r"\b(20\d{2}|19[89]\d)\b", header)
        if years:
            # Escolher o mais frequente
            from collections import Counter
            counts = Counter(years)
            return int(counts.most_common(1)[0][0])

        return None

    def _extract_cargo(self, text: str) -> Optional[str]:
        """Detecta o cargo ou função."""
        patterns = [
            r"(?:cargo|função|emprego|vaga)\s*[:\-]\s*([^\n]{5,80})",
            r"(?:para\s+o\s+cargo\s+de\s+)([^\n,\(]{5,60})",
            r"(?:área\s*[:\-]\s*)([^\n]{5,60})",
        ]
        for pat in patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                cargo = match.group(1).strip()
                # Remover artefatos comuns
                cargo = re.sub(r"\s+", " ", cargo)
                if len(cargo) > 60:
                    cargo = cargo[:60]
                return cargo
        return None

    def _extract_nivel(self, text: str) -> Optional[str]:
        """Detecta o nível de escolaridade exigido."""
        if re.search(r"\bsuperior\b", text, re.IGNORECASE):
            return "superior"
        if re.search(r"\bmédio\b", text, re.IGNORECASE):
            return "médio"
        if re.search(r"\bfundamental\b", text, re.IGNORECASE):
            return "fundamental"
        return None

    def _extract_tipo_prova(self, text: str) -> Optional[str]:
        """Detecta o tipo de prova."""
        if re.search(r"\b(?:prova\s+)?objetiva\b", text, re.IGNORECASE):
            return "objetiva"
        if re.search(r"\b(?:prova\s+)?discursiva\b", text, re.IGNORECASE):
            return "discursiva"
        return None
