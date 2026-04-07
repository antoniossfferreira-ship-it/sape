export type Priority = "ALTA" | "MÉDIA" | "BAIXA";

export type UserContextSnapshot = {
  name?: string;
  email?: string;
  unitId?: string;
  unitName?: string;
  sectorId?: string;
  sectorName?: string;
  roleId?: string;
  roleName?: string;
  formalFunctionId?: string;
  formalFunctionName?: string;
};

export type ExpectedCompetency = {
  competencyId: string;
  competencyName: string;
  axisCode: string;
  axisName: string;
  expectedLevel: number;
};

export type AssessmentCompetency = {
  competencyId: string;
  competencyName: string;
  axisCode?: string;
  axisName?: string;
  currentLevel: number;
};

export type CompletedCourseEvidence = {
  id?: string;
  name: string;
  hours: number;
  linkedCompetencyId?: string | null;
  linkedCompetencyName?: string | null;
  axisCode?: string | null;
  axisName?: string | null;
  sourceRecommendationId?: string | null;
  sourceRecommendationTitle?: string | null;
  recognizedBySystem?: boolean;
};

export type DiagnosticItem = {
  competencyId: string;
  competencyName: string;
  axisCode: string;
  axisName: string;
  expectedLevel: number;
  currentLevel: number;
  adjustedCurrentLevel: number;
  evidenceHours: number;
  evidenceBonus: number;
  supportingCoursesCount: number;
  gap: number;
  priority: Priority;
  priorityScore: number;
  explanation: string;
  developmentNeed: boolean;
};

export type DiagnosticSummary = {
  totalCompetencies: number;
  competenciesWithGap: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  averageExpectedLevel: number;
  averageCurrentLevel: number;
  averageAdjustedCurrentLevel: number;
  adherencePercent: number;
  evidenceBackedCompetencies: number;
};

export type DiagnosticDocument = {
  userId: string;
  generatedAt?: unknown;
  version: string;
  contextSnapshot: UserContextSnapshot;
  sourceRefs: {
    expectedProfileRef: string;
    selfAssessmentRef: string;
    completedCoursesRef: string;
  };
  summary: DiagnosticSummary;
  items: DiagnosticItem[];
};

export type ExpectedProfileDocument = {
  userId?: string;
  generatedAt?: unknown;
  source?: string;
  version?: string;
  contextSnapshot?: UserContextSnapshot;
  competencies?: ExpectedCompetency[];
};

export type SelfAssessmentDocument = {
  userId?: string;
  answeredAt?: unknown;
  version?: string;
  status?: string;
  competencies?: AssessmentCompetency[];
};