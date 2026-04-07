// src/lib/catalog-types.ts

export type DifficultyLevel = 1 | 2 | 3;

export type Modality = "ead" | "presencial" | "hibrido";
export type CourseFormat =
  | "curso"
  | "oficina"
  | "webinar"
  | "microcurso"
  | "tutorial"
  | "leitura_guiada";

export type TrackRoleInStage = "core" | "optional" | "complementary";

export type TrackProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "paused";

export type CourseCompletionStatus =
  | "completed"
  | "in_progress"
  | "cancelled";

export interface Competency {
  id: string;
  code: string;
  name: string;
  description?: string;
  axis?: string;
  type?: "institutional" | "sectoral" | "functional";
  keywords?: string[];
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LearningTrack {
  id: string;
  code: string;
  title: string;
  description?: string;
  objective?: string;
  mainCompetencyId: string;
  relatedCompetencyIds?: string[];
  targetAudience?: string[];
  recommendedCargoIds?: string[];
  recommendedSetorIds?: string[];
  recommendedFuncaoIds?: string[];
  recommendedUnidadeIds?: string[];
  entryLevel: DifficultyLevel;
  exitLevel: DifficultyLevel;
  estimatedWorkloadHours?: number;
  estimatedDurationText?: string;
  trackType?: string;
  tags?: string[];
  active: boolean;
  version?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrackStage {
  id: string;
  trackId: string;
  order: number;
  level: DifficultyLevel;
  title: string;
  description?: string;
  objective?: string;
  estimatedWorkloadHours?: number;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description?: string;
  providerName?: string;
  providerType?: "internal" | "external";
  modality?: Modality;
  format?: CourseFormat;
  workloadHours: number;
  difficultyLevel: DifficultyLevel;
  mainCompetencyId: string;
  relatedCompetencyIds?: string[];
  keywords?: string[];
  expectedOutcome?: string;
  prerequisiteCourseIds?: string[];
  certificateAvailable?: boolean;
  url?: string;
  status?: string;
  source?: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TrackCourseLink {
  id: string;
  trackId: string;
  stageId: string;
  courseId: string;
  competencyId: string;
  isRequired: boolean;
  recommendedOrder: number;
  relevanceWeight: number;
  roleInStage?: TrackRoleInStage;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  userId: string;
  cargoId?: string;
  cargoNome?: string;
  unidadeId?: string;
  unidadeNome?: string;
  setorId?: string;
  setorNome?: string;
  funcaoFormalId?: string;
  funcaoFormalNome?: string;
  publicoAlvo?: string;
}

export interface UserCompetencyAssessment {
  competencyId: string;
  currentLevel: DifficultyLevel;
}

export interface ExpectedCompetencyProfile {
  competencyId: string;
  expectedLevel: DifficultyLevel;
  appliesToCargoIds?: string[];
  appliesToSetorIds?: string[];
  appliesToFuncaoIds?: string[];
  appliesToUnidadeIds?: string[];
  institutionalPriority?: number;
}

export interface UserCourseHistory {
  userId: string;
  courseId: string;
  completionStatus: CourseCompletionStatus;
  completionDate?: string;
  certificateUrl?: string;
  source?: string;
  validated?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserTrackProgress {
  userId: string;
  trackId: string;
  currentStageId?: string | null;
  completedStageIds: string[];
  completedCourseIds: string[];
  inProgressCourseIds?: string[];
  progressPercent?: number;
  status: TrackProgressStatus;
  recommendedAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  updatedAt?: unknown;
}

export interface RecommendationWeights {
  competencyGapWeight: number;
  contextCargoWeight: number;
  contextSetorWeight: number;
  contextFuncaoWeight: number;
  contextUnidadeWeight: number;
  institutionalPriorityWeight: number;

  trackAudienceWeight: number;
  trackCargoWeight: number;
  trackSetorWeight: number;
  trackFuncaoWeight: number;
  trackUnidadeWeight: number;
  trackProgressBonus: number;

  courseStageExactWeight: number;
  courseStageNextWeight: number;
  courseEadBonus: number;
  courseLowWorkloadBonus: number;
  courseMediumWorkloadBonus: number;
  courseInProgressBonus: number;
  courseRecentRecommendationPenalty: number;
  courseSimilarityPenalty: number;
}

export interface RecommendationInput {
  userProfile: UserProfile;
  assessments: UserCompetencyAssessment[];
  expectedCompetencies: ExpectedCompetencyProfile[];

  competencies: Competency[];
  learningTracks: LearningTrack[];
  trackStages: TrackStage[];
  courses: Course[];
  trackCourseLinks: TrackCourseLink[];

  userCourseHistory: UserCourseHistory[];
  userTrackProgress: UserTrackProgress[];

  recentRecommendedCourseIds?: string[];
  weights?: Partial<RecommendationWeights>;
  maxCompetencies?: number;
  maxCoursesPerTrack?: number;
}

export interface RankedCompetency {
  competencyId: string;
  competencyName: string;
  currentLevel: number;
  expectedLevel: number;
  gap: number;
  contextScore: number;
  institutionalPriorityScore: number;
  totalScore: number;
}

export interface RankedTrack {
  trackId: string;
  trackTitle: string;
  competencyId: string;
  baseCompetencyScore: number;
  profileScore: number;
  audienceScore: number;
  progressScore: number;
  totalScore: number;
}

export interface RankedCourse {
  courseId: string;
  courseTitle: string;
  stageId: string;
  stageTitle: string;
  trackId: string;
  trackTitle: string;
  relevanceWeight: number;
  totalScore: number;
  details: {
    relevanceScore: number;
    stageScore: number;
    modalityScore: number;
    workloadScore: number;
    historyScore: number;
    repetitionPenalty: number;
    similarityPenalty: number;
  };
}

export interface RecommendationResultItem {
  competency: RankedCompetency;
  track: RankedTrack | null;
  selectedStage: TrackStage | null;
  courses: RankedCourse[];
  explanation: string;
}

export interface RecommendationResult {
  generatedAt: string;
  userId: string;
  items: RecommendationResultItem[];
}
