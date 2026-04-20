import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

export type ApostilaQuestionRow = {
  order: number;
  content: string;
  supportText: string | null;
  subjectName: string | null;
  alternatives: { letter: string; content: string }[];
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
  supportBody: {
    fontSize: 9,
    lineHeight: 1.4,
    color: "#4B5563",
    marginBottom: 6,
    padding: 8,
    backgroundColor: "#F5F3FF",
    borderLeftWidth: 3,
    borderLeftColor: "#C4B5FD",
  },
  stem: { fontSize: 10, lineHeight: 1.45, color: "#1F2937", marginBottom: 6 },
  altRow: { flexDirection: "row", marginBottom: 3, paddingLeft: 4 },
  altLetter: { width: 18, fontWeight: "bold", color: "#4B5563" },
  altText: { flex: 1, fontSize: 9, lineHeight: 1.35, color: "#374151" },
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

  return (
    <Document>
      {pages.map((block, pi) => (
        <Page key={pi} size="A4" style={styles.page}>
          {pi === 0 ? (
            <View style={styles.header}>
              <Text style={styles.title}>{truncate(title, 120)}</Text>
              <Text style={styles.subtitle}>
                ÓRBITA Concursos · Apostila gerada em {generatedAt}
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
                <View style={{ marginBottom: 4 }}>
                  <Text style={styles.supportLabel}>Texto de apoio</Text>
                  <Text style={styles.supportBody}>
                    {truncate(q.supportText, 4000)}
                  </Text>
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
    </Document>
  );
}
