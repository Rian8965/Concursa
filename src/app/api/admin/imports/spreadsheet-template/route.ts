import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

function csvEscape(val: string): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const headers = [
    // Metadados por questão
    "disciplina",
    "assunto",
    "banca",
    "ano",
    "nivel",
    "cidade",
    "cargo",
    "concurso",
    // Dados da questão
    "numero_questao",
    "enunciado",
    "texto_vinculado",
    "Alternativa A",
    "Alternativa B",
    "Alternativa C",
    "Alternativa D",
    "Alternativa E",
    "gabarito",
    // Flags de pendência visual (preencher com SIM ou NÃO)
    "precisa de imagem",
    "precisa de grafico",
    "precisa de tabela",
    "precisa de formula",
    "precisa de mapa/figura/esquema",
    "alternativas em imagem",
    "observacao da IA",
  ];

  // Exemplo 1 – questão normal sem pendência visual
  const ex1 = [
    "Direito Constitucional",
    "Direitos Fundamentais",
    "CESPE",
    "2024",
    "Superior",
    "Brasília - DF",
    "Analista Judiciário",
    "Concurso STF 2024",
    "1",
    "De acordo com a Constituição Federal, assinale a alternativa correta sobre os direitos fundamentais.",
    "Art. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza...",
    "São direitos fundamentais apenas os individuais.",
    "São direitos fundamentais os individuais e coletivos.",
    "Os direitos fundamentais não admitem regulamentação por lei.",
    "Apenas brasileiros natos possuem direitos fundamentais.",
    "",
    "B",
    "NÃO", // precisa de imagem
    "NÃO", // precisa de gráfico
    "NÃO", // precisa de tabela
    "NÃO", // precisa de fórmula
    "NÃO", // precisa de mapa/figura/esquema
    "NÃO", // alternativas em imagem
    "",    // observação da IA
  ];

  // Exemplo 2 – questão com gráfico
  const ex2 = [
    "Língua Portuguesa",
    "Interpretação de Texto",
    "FGV",
    "2023",
    "Médio",
    "",
    "",
    "",
    "2",
    "Com base no gráfico apresentado, assinale a alternativa que indica corretamente o tema abordado.",
    "",
    "Desemprego no Brasil em 2022.",
    "Crescimento do PIB no último trimestre.",
    "Evolução da inflação nos últimos 5 anos.",
    "",
    "",
    "C",
    "NÃO", // precisa de imagem
    "SIM", // precisa de gráfico
    "NÃO", // precisa de tabela
    "NÃO", // precisa de fórmula
    "NÃO", // precisa de mapa/figura/esquema
    "NÃO", // alternativas em imagem
    "A questão se refere a um gráfico apresentado no PDF da prova.", // observação da IA
  ];

  const linhas = [headers, ex1, ex2]
    .map((linha) => linha.map(csvEscape).join(","))
    .join("\r\n");

  const bom = "\uFEFF";

  return new NextResponse(bom + linhas, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo_questoes.csv"',
    },
  });
}
