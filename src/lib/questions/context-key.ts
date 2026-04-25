export type QuestionContextKeyInput = {
  competitionId: string;
  jobRoleId: string | null;
  examBoardId: string | null;
  subjectIds: string[];
  difficulty?: string | null;
};

export function buildQuestionContextKey(input: QuestionContextKeyInput) {
  const subjects = [...input.subjectIds].sort().join(",");
  const diff = (input.difficulty ?? null) || "-";
  return `comp:${input.competitionId}|job:${input.jobRoleId ?? "-"}|board:${input.examBoardId ?? "-"}|subs:${subjects}|diff:${diff}`;
}

