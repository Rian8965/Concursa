import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

export type ApostilaQuestionRow = {
  order: number;
  content: string;
  supportText: string | null;
  subjectName: string | null;
  questionImageUrl?: string | null;
  alternatives: { letter: string; content: string }[];
  correctAnswer: string;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#7C3AED",
    paddingBottom: 8,
  },
  title: { fontSize: 16, fontWeight: "bold", color: "#111827" },
  subtitle: { fontSize: 9, color: "#6B7280", marginTop: 4 },
  qBlock: { marginBottom: 14 },
  qNum: { fontSize: 11, fontWeight: "bold", color: "#7C3AED", marginBottom: 4 },
  subject: { fontSize: 8, color: "#9CA3AF", marginBottom: 3 },
  supportLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#7C3AED",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  supportBox: {
    borderWidth: 1,
    borderColor: "#DDD6FE",
    backgroundColor: "#F8F7FF",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  supportBody: {
    fontSize: 9,
    lineHeight: 1.4,
    color: "#4B5563",
  },
  figureLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#6B7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  figureBox: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  figureImage: {
    width: "100%",
    objectFit: "contain",
  },
  stem: { fontSize: 10, lineHeight: 1.45, color: "#1F2937", marginBottom: 6 },
  altRow: { flexDirection: "row", marginBottom: 3, paddingLeft: 4 },
  altLetter: { width: 18, fontWeight: "bold", color: "#4B5563" },
  altText: { flex: 1, fontSize: 9, lineHeight: 1.35, color: "#374151" },
  answerKeyTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  answerKeyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  answerKeyItem: {
    width: "23%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#F9FAFB",
  },
  answerKeyItemText: {
    fontSize: 10,
    color: "#111827",
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
  },
});

function truncate(s: string, max: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

type Props = {
  title: string;
  generatedAt: string;
  questions: ApostilaQuestionRow[];
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function ApostilaPdfDocument({ title, generatedAt, questions }: Props) {
  const pages = chunk(questions, 5);

  const answerKey = questions
    .filter((q) => q.correctAnswer && q.correctAnswer !== "-")
    .map((q) => ({ order: q.order, correctAnswer: q.correctAnswer }));

  return (
    <Document>
      {pages.map((block, pi) => (
        <Page key={pi} size="A4" style={styles.page}>
          {pi === 0 ? (
            <View style={styles.header}>
              <Text style={styles.title}>{truncate(title, 120)}</Text>
              <Text style={styles.subtitle}>
                Descomplique seu Concurso · Apostila gerada em {generatedAt}
              </Text>
            </View>
          ) : (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.subtitle}>
                {truncate(title, 80)} · continuação (p. {pi + 1})
              </Text>
            </View>
          )}
          {block.map((q) => (
            <View key={q.order} style={styles.qBlock}>
              <Text style={styles.qNum}>Questão {q.order}</Text>
              {q.subjectName ? (
                <Text style={styles.subject}>{q.subjectName}</Text>
              ) : null}
              {q.supportText ? (
                <View style={styles.supportBox}>
                  <Text style={styles.supportLabel}>Texto de apoio</Text>
                  <Text style={styles.supportBody}>{truncate(q.supportText, 4000)}</Text>
                </View>
              ) : null}
              {q.questionImageUrl ? (
                <View style={styles.figureBox}>
                  <Text style={styles.figureLabel}>Figura da questão</Text>
                  <Image style={styles.figureImage} src={q.questionImageUrl} />
                </View>
              ) : null}
              <Text style={styles.stem}>{truncate(q.content, 3500)}</Text>
              {q.alternatives.map((a) => (
                <View key={a.letter} style={styles.altRow}>
                  <Text style={styles.altLetter}>{a.letter})</Text>
                  <Text style={styles.altText}>{truncate(a.content, 800)}</Text>
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.footer} fixed>
            Documento para estudo · não reproduzir comercialmente
          </Text>
        </Page>
      ))}

      {/* Gabarito (opcional) */}
      {answerKey.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Gabarito</Text>
            <Text style={styles.subtitle}>{truncate(title, 120)} · gerado em {generatedAt}</Text>
          </View>
          <Text style={styles.answerKeyTitle}>Respostas corretas</Text>
          <View style={styles.answerKeyGrid}>
            {answerKey.map((k) => (
              <View key={k.order} style={styles.answerKeyItem}>
                <Text style={styles.answerKeyItemText}>
                  {k.order}. {k.correctAnswer}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.footer} fixed>
            Documento para estudo · não reproduzir comercialmente
          </Text>
        </Page>
      ) : null}
    </Document>
  );
}
