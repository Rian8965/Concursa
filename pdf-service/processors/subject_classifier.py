"""
SubjectClassifier: Infere automaticamente a matéria de uma questão de concurso público
baseado em palavras-chave e padrões semânticos do enunciado e alternativas.

Estratégia: heurística por regras com pesos e desambiguação por densidade de sinais.
Cobertura: ~30 matérias comuns em concursos públicos brasileiros.
"""

import re
from typing import Optional


# ─────────────────────────────────────────────────────────────────────────────
# Dicionário de matérias com palavras-chave e expressões regulares
# Chave: nome canônico da matéria
# Valor: (peso_base, [padrões de alta prioridade], [palavras-chave])
# ─────────────────────────────────────────────────────────────────────────────

SUBJECT_RULES: list[tuple[str, int, list[str], list[str]]] = [
    # (nome, peso_base, regex_alta_prioridade, palavras_chave)

    ("Língua Portuguesa", 10, [
        r"\bacentua(?:ção|r)\b", r"\bortografia\b", r"\bsintax[ei]\b",
        r"\bmorfologia\b", r"\bpontuação\b", r"\bconcordância\s+(verbal|nominal)\b",
        r"\bregência\s+(verbal|nominal)\b", r"\bcrase\b", r"\bcoesão\s+textual\b",
        r"\bcoerência\s+textual\b", r"\binterpretação\s+de\s+texto\b",
        r"\bcompreensão\s+de\s+texto\b", r"\bfiguras?\s+de\s+linguagem\b",
        r"\btipologia\s+textual\b",
    ], [
        "sujeito", "predicado", "verbo", "substantivo", "adjetivo",
        "advérbio", "pronome", "preposição", "conjunção", "artigo",
        "frase", "oração", "período", "parágrafo", "sinonímia",
        "antonímia", "homonímia", "paronímia", "vocábulo", "redação",
        "narração", "dissertação", "descrição", "gênero textual",
    ]),

    ("Matemática", 10, [
        r"\bequa(?:ção|ções)\s+(?:do|de)?\s*(?:1[oº°]|2[oº°]|segundo|primeiro)\s+grau\b",
        r"\bfrações?\b", r"\bporcentagem\b", r"\bregra\s+de\s+três\b",
        r"\bprogressão\s+(?:aritmética|geométrica)\b", r"\bfunção\s+(?:do\s+)?(?:1[oº°]|2[oº°])\b",
        r"\btrigonometria\b", r"\bmmc\b", r"\bmdc\b",
        r"\bconjuntos?\b.*\b(?:união|interseção)\b",
        r"\b(?:média|mediana|moda)\s+(?:aritmética|ponderada)?\b",
        r"\bdesvio\s+padrão\b",
    ], [
        "número", "inteiro", "decimal", "positivo", "negativo",
        "ângulo", "triângulo", "círculo", "área", "volume",
        "perímetro", "diâmetro", "raio", "quadrado", "retângulo",
        "probabilidade", "estatística", "fatorial", "logaritmo", "exponencial",
        "matriz", "determinante", "vetores", "juros", "desconto",
    ]),

    ("Raciocínio Lógico", 10, [
        r"\blógica\s+(?:de\s+)?proposicional\b",
        r"\bsilogismo\b", r"\bcondicional\b", r"\bbicondicional\b",
        r"\bnegação\s+de\b", r"\bcontraposição\b", r"\brecíproca\b",
        r"\bproposição\s+(?:verdadeira|falsa)\b",
        r"\btabela(?:s)?\s+verdade\b", r"\bsequência\s+lógica\b",
        r"\bserie\s+numérica\b", r"\bmonte\s+de\s+(?:lógica|cards)\b",
    ], [
        "proposição", "conectivo", "conjunção", "disjunção", "implicação",
        "equivalência", "verdadeiro", "falso", "argumento", "premissa",
        "conclusão", "sequência", "padrão", "análise combinatória",
        "diagrama", "grafo", "se e somente se",
    ]),

    ("Informática", 10, [
        r"\bsistema\s+operacional\b", r"\bmicrosoft\s+(?:word|excel|powerpoint|office)\b",
        r"\binternet\s+explorer\b", r"\bbrowser\b", r"\bnavegador\b",
        r"\bfirewall\b", r"\bantivírus\b", r"\bspyware\b", r"\bmalware\b",
        r"\bemail\b", r"\bclient[eo]\b.*\bservidor\b", r"\bnuvem\b",
        r"\bbackup\b", r"\bips\b.*\bips\b", r"\btcp\/ip\b",
        r"\bhtml\b", r"\bcss\b", r"\bjavascript\b", r"\bpython\b",
        r"\bbig\s+data\b", r"\binteligência\s+artificial\b",
        r"\brede\s+(?:de\s+computadores?|local|larga)\b",
        r"\bprotocolo\s+(?:http|https|ftp|smtp|pop3|imap)\b",
    ], [
        "computador", "software", "hardware", "arquivo", "pasta",
        "desktop", "notebook", "processador", "memória", "disco",
        "impressora", "scanner", "monitor", "teclado", "mouse",
        "rede", "servidor", "banco de dados", "sistema",
    ]),

    ("Direito Administrativo", 12, [
        r"\bato\s+administrativo\b", r"\badministração\s+pública\b",
        r"\bpoder\s+(?:vinculado|discricionário|hierárquico|disciplinar|de\s+polícia)\b",
        r"\bprinc[íi]pio\s+da\s+(?:legalidade|moralidade|publicidade|impessoalidade|eficiência)\b",
        r"\blicitação\b", r"\bcontrato\s+administrativo\b",
        r"\bconcurso\s+público\b", r"\bcargo\s+público\b",
        r"\bservidor\s+público\b", r"\bautarquia\b", r"\bfundação\s+pública\b",
        r"\bempresa\s+pública\b", r"\bsociedade\s+de\s+economia\s+mista\b",
        r"\bconcessão\b", r"\bpermissão\b", r"\bautorização\b",
        r"\btutela\s+administrativa\b", r"\bcontrole\s+administrativo\b",
    ], [
        "LIMPE", "LIPPE", "impessoalidade", "moralidade", "publicidade",
        "eficiência", "legalidade", "hierarquia", "disciplina", "polícia",
    ]),

    ("Direito Constitucional", 12, [
        r"\bconstituição\s+(?:federal|da\s+república)\b",
        r"\bdireitos?\s+fundamentais?\b", r"\bdireitos?\s+(?:e\s+)?garantias?\s+fundamentais?\b",
        r"\bhabeas\s+corpus\b", r"\bmandado\s+de\s+segurança\b",
        r"\bhábeas?\s+data\b", r"\bmandado\s+de\s+injunção\b",
        r"\bação\s+direta\s+de\s+inconstitucionalidade\b",
        r"\bação\s+declaratória\s+de\s+constitucionalidade\b",
        r"\bpoder\s+(?:executivo|legislativo|judiciário|constituinte)\b",
        r"\btribunal\s+(?:superior|supremo|federal)\b",
        r"\bstf\b", r"\bstj\b", r"\btcu\b",
    ], [
        "CF/88", "emenda constitucional", "democracia", "república",
        "federação", "soberania", "cidadania", "dignidade", "igualdade",
        "liberdade", "voto", "eleição", "sufrágio",
    ]),

    ("Direito Penal", 10, [
        r"\bcrime\b", r"\bdoloso\b", r"\bculposo\b", r"\bdolo\b", r"\bculpa\b",
        r"\btentativa\b", r"\bconsumado\b", r"\bpena\b", r"\breclusão\b",
        r"\bdetenção\b", r"\bmulta\b", r"\bprescrição\s+penal\b",
        r"\banistia\b", r"\bgratia\b", r"\bindulto\b",
        r"\bcódigo\s+penal\b", r"\bcriminoso\b",
        r"\bhomicídio\b", r"\bfurto\b", r"\broubo\b",
        r"\bestelionato\b", r"\bcorrupção\b",
    ], [
        "CP", "penalidade", "ilícito", "antijurídico", "tipicidade",
        "culpabilidade", "imputabilidade", "réu", "acusado",
    ]),

    ("Direito Civil", 10, [
        r"\bcódigo\s+civil\b", r"\bpessoa\s+(?:física|jurídica)\b",
        r"\bcapacidade\s+civil\b", r"\bnegócio\s+jurídico\b",
        r"\bcontrato\s+(?:de\s+)?(?:compra|venda|locação|prestação|doação)\b",
        r"\bresponsabilidade\s+civil\b", r"\bdano\s+moral\b",
        r"\bdano\s+material\b", r"\bprescrição\s+civil\b",
        r"\bdecadência\b", r"\bsucesso\s+hereditária\b",
        r"\bherança\b", r"\btest[ae]mento\b",
    ], [
        "CC", "obrigação", "credor", "devedor", "inadimplência",
        "casamento", "divórcio", "guarda", "adoção", "filiação",
        "posse", "propriedade", "usufruto", "servidão",
    ]),

    ("Direito Trabalhista", 10, [
        r"\bclt\b", r"\bconsolidação\s+das\s+leis\s+do\s+trabalho\b",
        r"\brelação\s+de\s+emprego\b", r"\bempregado\b", r"\bempregador\b",
        r"\bcontrato\s+de\s+trabalho\b", r"\bjornada\s+de\s+trabalho\b",
        r"\bsalário\b", r"\b(?:13[oº°]|décimo\s+terceiro)\s+salário\b",
        r"\bférias\b", r"\bfgts\b", r"\bseguro(?:-|\s)desemprego\b",
        r"\bdispensa\s+(?:por\s+)?justa\s+causa\b", r"\brescisão\s+contratual\b",
        r"\bsindicato\b", r"\bgreve\b",
    ], [
        "TRT", "TST", "CLT", "convenção coletiva", "acordo coletivo",
        "horas extras", "adicional noturno", "insalubridade", "periculosidade",
    ]),

    ("Atualidades", 8, [
        r"\bnotícia\s+recente\b", r"\batualidade\s+(?:nacional|internacional|mundial)\b",
        r"\bconjuntura\s+(?:política|econômica|social)\b",
    ], [
        "presidente", "governo federal", "eleição", "pandemia",
        "inflação", "pib", "copa", "olimpíadas", "ONU",
        "OTAN", "G20", "mudanças climáticas", "sustentabilidade",
    ]),

    ("Conhecimentos Gerais", 6, [], [
        "história do brasil", "história geral", "geografia",
        "cultura", "civilização", "revolução",
    ]),

    ("Administração Pública", 9, [
        r"\bgestão\s+pública\b", r"\bgoverno\s+(?:federal|estadual|municipal)\b",
        r"\bplanejamento\s+(?:estratégico|governamental)\b",
        r"\bindicadores?\s+de\s+desempenho\b", r"\bgestão\s+por\s+(?:resultados?|competências?)\b",
        r"\borgão\s+público\b", r"\bentidade\s+pública\b",
        r"\btransparência\s+pública\b", r"\blei\s+de\s+responsabilidade\s+fiscal\b",
        r"\borçamento\s+público\b",
    ], [
        "gestão", "planejamento", "orçamento", "accountability",
        "burocracia", "patrimonialismo", "gerencialismo",
    ]),

    ("Contabilidade", 9, [
        r"\bbalancete\b", r"\bbalanço\s+(?:patrimonial|contábil)\b",
        r"\bdemonstrativo\s+(?:de\s+resultados?|financeiro)\b",
        r"\blançamento\s+contábil\b", r"\bdébito\b.*\bcrédito\b",
        r"\bativo\b.*\bpassivo\b", r"\bpatrimônio\s+(?:líquido|bruto)\b",
        r"\bdepreciação\b", r"\bamortização\b",
    ], [
        "contabilidade", "receita", "despesa", "superávit",
        "déficit", "capital", "investimento", "caixa", "banco",
    ]),

    ("Economia", 8, [
        r"\bdemanda\b.*\boferta\b", r"\bequilíbrio\s+(?:de\s+mercado)?\b",
        r"\binflação\b", r"\bdeflação\b", r"\bpib\b", r"\bcrescimento\s+econômico\b",
        r"\bjuros\b.*\bselic\b", r"\bpolítica\s+(?:fiscal|monetária)\b",
        r"\bmercado\s+(?:de\s+)?(?:trabalho|capitais|financeiro)\b",
    ], [
        "microeconomia", "macroeconomia", "produto", "consumo",
        "poupança", "investimento", "exportação", "importação",
        "câmbio", "desemprego",
    ]),

    ("Ética no Serviço Público", 9, [
        r"\bcódigo\s+de\s+ética\b", r"\bconduta\s+(?:do\s+servidor|ética)\b",
        r"\bética\s+(?:profissional|pública)\b",
        r"\bprincípio\s+da\s+(?:honestidade|integridade|lealdade)\b",
        r"\bvedação\s+ao\s+servidor\b", r"\bconflito\s+de\s+interesses?\b",
    ], [
        "servidor", "probidade", "integridade", "imparcialidade",
        "honestidade", "transparência", "dever funcional",
    ]),

    ("Português Redação", 7, [
        r"\btexto\s+(?:dissertativo|argumentativo|expositivo|narrativo|descritivo)\b",
        r"\bparagrafo(?:s)?\b", r"\bintrodução\b.*\bdesenvolvimento\b.*\bconclusão\b",
        r"\btese\b", r"\bargumento\b", r"\bconclusão\b",
    ], [
        "redação", "dissertação", "coesão", "coerência",
        "conectivo", "nexo", "referência", "progressão temática",
    ]),

    ("Noções de Direito", 6, [
        r"\bfonte\s+(?:do\s+)?direito\b",
        r"\bnorma\s+jurídica\b", r"\bordenamento\s+jurídico\b",
        r"\bvalidade\b.*\bvigência\b", r"\bhermenêutica\s+jurídica\b",
    ], [
        "direito objetivo", "direito subjetivo", "lei", "decreto",
        "portaria", "resolução", "jurisprudência", "doutrina",
    ]),
]


class SubjectClassifier:
    """
    Classifica questões de concurso público por matéria usando heurística por palavras-chave.
    Retorna uma lista de sugestões ordenadas por pontuação (maior = mais confiante).
    """

    def __init__(self):
        # Compilar todos os padrões uma vez
        self._compiled: list[tuple[str, int, list, list[str]]] = []
        for name, base_weight, patterns, keywords in SUBJECT_RULES:
            compiled_patterns = [re.compile(p, re.IGNORECASE) for p in patterns]
            kw_lower = [k.lower() for k in keywords]
            self._compiled.append((name, base_weight, compiled_patterns, kw_lower))

    def classify(
        self, text: str, *, top_n: int = 3
    ) -> list[dict]:
        """
        Classifica o texto e retorna as top_n matérias mais prováveis.

        Retorna:
            [{"subject": str, "score": float, "confidence": "high"|"medium"|"low"}, ...]
        """
        if not text or len(text.strip()) < 20:
            return []

        text_lower = text.lower()
        scores: list[tuple[str, float]] = []

        for name, base_weight, compiled_patterns, keywords in self._compiled:
            score = 0.0

            # Pontuação por padrão regex de alta prioridade (peso 3x)
            for pat in compiled_patterns:
                if pat.search(text):
                    score += base_weight * 3

            # Pontuação por palavras-chave (peso 1x)
            for kw in keywords:
                if kw in text_lower:
                    score += base_weight

            if score > 0:
                scores.append((name, score))

        if not scores:
            return []

        scores.sort(key=lambda x: -x[1])
        max_score = scores[0][1]

        result = []
        for name, score in scores[:top_n]:
            normalized = score / max_score
            if normalized >= 0.75:
                confidence = "high"
            elif normalized >= 0.40:
                confidence = "medium"
            else:
                confidence = "low"

            result.append({
                "subject": name,
                "score": round(normalized, 3),
                "confidence": confidence,
            })

        return result

    def best_subject(self, text: str) -> Optional[str]:
        """Retorna apenas a melhor sugestão de matéria, ou None se não encontrar."""
        results = self.classify(text, top_n=1)
        if results and results[0]["confidence"] in ("high", "medium"):
            return results[0]["subject"]
        return None
