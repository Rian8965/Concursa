export type UserRole = "STUDENT" | "ADMIN" | "SUPER_ADMIN";

export type CompetitionStatus = "UPCOMING" | "ACTIVE" | "PAST" | "CANCELLED";

export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

export type QuestionStatus = "PENDING_REVIEW" | "ACTIVE" | "INACTIVE" | "REJECTED";

export type SessionType = "TRAINING" | "EXAM" | "REVIEW";

export type ExamStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";

export type ImportStatus =
  | "PENDING"
  | "PROCESSING"
  | "REVIEW_PENDING"
  | "COMPLETED"
  | "FAILED";

export type ImportedQuestionStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED";

export interface CompetitionCard {
  id: string;
  name: string;
  city: string;
  state: string;
  organization: string | null;
  examBoard: string | null;
  examDate: Date | null;
  status: CompetitionStatus;
  jobRole: string | null;
  daysRemaining: number | null;
}

export interface StudentDashboardStats {
  totalAnswered: number;
  correctAnswers: number;
  accuracy: number;
  totalTrainingSessions: number;
  totalSimulatedExams: number;
  bestSubjects: SubjectStat[];
  worstSubjects: SubjectStat[];
  recentActivity: ActivityItem[];
}

export interface SubjectStat {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  totalAnswered: number;
  correctAnswers: number;
  accuracy: number;
}

export interface ActivityItem {
  type: "training" | "exam" | "apostila";
  date: Date;
  description: string;
  result?: string;
}

export interface QuestionWithAlternatives {
  id: string;
  content: string;
  correctAnswer: string;
  hasImage: boolean;
  imageUrl: string | null;
  difficulty: QuestionDifficulty;
  subject: { name: string; color: string | null } | null;
  topic: { name: string } | null;
  examBoard: { acronym: string } | null;
  year: number | null;
  alternatives: {
    id: string;
    letter: string;
    content: string;
    imageUrl: string | null;
    order: number;
  }[];
}

export interface TrainingFilters {
  subjectId?: string;
  topicId?: string;
  examBoardId?: string;
  difficulty?: QuestionDifficulty;
  excludeUsed?: boolean;
}
