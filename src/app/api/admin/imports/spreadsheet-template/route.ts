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
    "disciplina",
    "assunto",
    "banca",
    "ano",
    "nivel",
    "cidade",
    "cargo",
    "concurso",
    "numero_questao",
    "enunciado",
    "texto_vinculado",
    "alternativa_a",
    "alternativa_b",
    "alternativa_c",
    "alternativa_d",
    "alternativa_e",
    "gabarito",
  ];

  const exemplo = [
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
  ];

  const exemplo2 = [
    "Língua Portuguesa",
    "Interpretação de Texto",
    "FGV",
    "2023",
    "Médio",
    "",
    "",
    "",
    "2",
    "Assinale a alternativa que apresenta uso correto da crase.",
    "",
    "Vou à escola todos os dias.",
    "Refiro-me à problemas antigos.",
    "Fui à pé ao trabalho.",
    "",
    "",
    "A",
  ];

  const linhas = [headers, exemplo, exemplo2]
    .map((linha) => linha.map(csvEscape).join(","))
    .join("\r\n");

  const bom = "\uFEFF";
  const csvContent = bom + linhas;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo_questoes.csv"',
    },
  });
}
