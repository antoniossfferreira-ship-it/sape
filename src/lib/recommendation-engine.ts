import type {
  Competency,
  Course,
  DifficultyLevel,
  LearningTrack,
  RankedCompetency,
  RankedCourse,
  RankedTrack,
  RecommendationInput,
  RecommendationResult,
  RecommendationResultItem,
  RecommendationWeights,
  TrackStage,
  UserCompetencyAssessment,
  UserCourseHistory,
  UserProfile,
  UserTrackProgress,
  ExpectedCompetencyProfile,
} from "@/lib/catalog-types";
import type {
  CompetencyAxis,
  TrackLevel,
  GapInput,
} from "@/lib/catalog-query-engine";
import {
  buildRecommendationsFromGaps,
} from "@/lib/catalog-query-engine";

const DEFAULT_WEIGHTS: RecommendationWeights = {
  competencyGapWeight: 10,
  contextCargoWeight: 3,
  contextSetorWeight: 12,
  contextFuncaoWeight: 3,
  contextUnidadeWeight: 4,
  institutionalPriorityWeight: 1,

  trackAudienceWeight: 3,
  trackCargoWeight: 4,
  trackSetorWeight: 24,
  trackFuncaoWeight: 4,
  trackUnidadeWeight: 8,
  trackProgressBonus: 3,

  courseStageExactWeight: 5,
  courseStageNextWeight: 2,
  courseEadBonus: 2,
  courseLowWorkloadBonus: 2,
  courseMediumWorkloadBonus: 1,
  courseInProgressBonus: 1,
  courseRecentRecommendationPenalty: 4,
  courseSimilarityPenalty: 2,
};

const LEGACY_BLOCKED_COURSE_IDS = [
  "curso_fin_001",
  "curso_fin_003",
  "curso_fin_005",
];

const LEGACY_BLOCKED_COURSE_PATTERNS = [
  "siafi",
  "siafi basico",
  "educacao fiscal",
  "código fiscal",
  "codigo fiscal",
  "serie basica",
  "série básica",
  "coesao social",
];

export type RecommendationSource =
  | "legacy-track-engine"
  | "catalog-track-engine";

export interface CatalogTrackRecommendationCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  modality: "EAD" | "PRESENCIAL" | "HIBRIDO";
  workloadHours: number;
  level: TrackLevel;
}

export interface CatalogTrackRecommendationStage {
  id: string;
  title: string;
  description: string;
  level: TrackLevel;
  recommendedTotalHours: number;
}

export interface CatalogTrackRecommendationTrack {
  id: string;
  code: string;
  title: string;
  description: string;
  competencyAxis: CompetencyAxis;
  preferredModality: "EAD" | "PRESENCIAL" | "HIBRIDO";
}

export interface CatalogTrackRecommendation {
  id: string;
  source: RecommendationSource;
  competencyId: string;
  competencyName: string;
  competencyAxis: CompetencyAxis;
  expectedLevel?: number;
  currentLevel?: number;
  gapScore?: number;
  priority?: number;
  score: number;
  rationale: string;
  track: CatalogTrackRecommendationTrack;
  stage: CatalogTrackRecommendationStage;
  courses: CatalogTrackRecommendationCourse[];
  totalWorkloadHours: number;
  recommendedLevel: TrackLevel;
  recommendedOrder: number;
  isFallback?: boolean;
  fallbackType?: "trilha_transversal_institucional" | null;
}

export interface ProfileCompetencyInput {
  competencyId: string;
  competencyName: string;
  competencyAxis: CompetencyAxis;
  expectedLevel: number;
  currentLevel: number;
  priority?: number;
}

export interface GetCatalogRecommendationsOptions {
  maxTracksPerGap?: number;
  maxFinalRecommendations?: number;
  preferredLevel?: TrackLevel;
  preferredModality?: "EAD" | "PRESENCIAL" | "HIBRIDO";
  activeOnly?: boolean;
  dedupeByTrack?: boolean;
  sortBy?: "score" | "axis" | "priority";
  maxEVGCoursesPerRecommendation?: number;
  setorId?: string;
  unidadeId?: string;
  funcaoId?: string;
  cargoId?: string;
  publicoAlvo?: string;
  contextoTexto?: string;
}

export interface CatalogRecommendationsGroupedByAxis {
  E1: CatalogTrackRecommendation[];
  E2: CatalogTrackRecommendation[];
  E3: CatalogTrackRecommendation[];
  E4: CatalogTrackRecommendation[];
  E5: CatalogTrackRecommendation[];
}

type FirestoreDb = Parameters<typeof buildRecommendationsFromGaps>[0];
type RawCatalogRecommendation = Awaited<
  ReturnType<typeof buildRecommendationsFromGaps>
>[number];

const FALLBACK_TRANSVERSAL_TRACK: CatalogTrackRecommendation = {
  id: "REC-FALLBACK-TRANSVERSAL-UNEB",
  source: "catalog-track-engine",
  competencyId: "transversal_uneb",
  competencyName: "Competências Transversais UNEB",
  competencyAxis: "E4",
  score: 100,
  rationale:
    'Não foi identificada, no catálogo atual, uma trilha específica diretamente vinculada à competência priorizada no contexto profissional informado. Por isso, o sistema recomendou a trilha institucional "Desenvolvimento Profissional na Multicampia", que reúne conteúdos transversais relevantes para o fortalecimento da atuação técnico-administrativa na UNEB.',
  totalWorkloadHours: 85,
  recommendedLevel: "intermediario",
  recommendedOrder: 1,
  isFallback: true,
  fallbackType: "trilha_transversal_institucional",
  track: {
    id: "trilha_transversal_uneb",
    code: "UNB-TRANS",
    title:
      "Desenvolvimento Profissional na Multicampia (Competências Transversais UNEB)",
    description:
      "Formação institucional transversal para apoiar o desenvolvimento profissional de servidores técnico-administrativos da UNEB.",
    competencyAxis: "E4",
    preferredModality: "EAD",
  },
  stage: {
    id: "trilha_transversal_uneb__stage__intermediario",
    title: "Desenvolvimento transversal institucional",
    description:
      "Percurso formativo transversal para fortalecimento da atuação técnico-administrativa.",
    level: "intermediario",
    recommendedTotalHours: 85,
  },
  courses: [
    {
      id: "ct_01",
      code: "C01",
      title: "Gestão Pública e Processos Administrativos",
      description:
        "Curso introdutório sobre fundamentos da gestão pública e rotinas administrativas aplicadas ao contexto institucional.",
      modality: "EAD",
      workloadHours: 20,
      level: "intermediario",
    },
    {
      id: "ct_02",
      code: "C02",
      title: "Gestão de Documentos Digitais e LGPD",
      description:
        "Curso voltado à organização documental, uso responsável da informação e proteção de dados no ambiente institucional.",
      modality: "EAD",
      workloadHours: 15,
      level: "intermediario",
    },
    {
      id: "ct_03",
      code: "C03",
      title: "Inteligência Emocional e Comunicação Não-Violenta",
      description:
        "Curso para aprimorar relações interpessoais, comunicação e colaboração no trabalho.",
      modality: "EAD",
      workloadHours: 10,
      level: "intermediario",
    },
    {
      id: "ct_04",
      code: "C04",
      title: "Gestão do Tempo e Trabalho Remoto",
      description:
        "Curso para apoiar organização do trabalho, produtividade e planejamento de atividades.",
      modality: "EAD",
      workloadHours: 12,
      level: "intermediario",
    },
    {
      id: "ct_05",
      code: "C05",
      title: "Sistemas administrativos e acadêmicos",
      description:
        "Curso introdutório sobre uso de sistemas institucionais administrativos e acadêmicos.",
      modality: "EAD",
      workloadHours: 20,
      level: "intermediario",
    },
    {
      id: "ct_06",
      code: "C06",
      title: "Ferramentas de Colaboração",
      description:
        "Curso voltado ao uso de ferramentas digitais para comunicação, cooperação e acompanhamento do trabalho.",
      modality: "EAD",
      workloadHours: 8,
      level: "intermediario",
    },
  ],
};

function cloneTransversalFallbackRecommendation(): CatalogTrackRecommendation {
  return {
    ...FALLBACK_TRANSVERSAL_TRACK,
    track: { ...FALLBACK_TRANSVERSAL_TRACK.track },
    stage: { ...FALLBACK_TRANSVERSAL_TRACK.stage },
    courses: FALLBACK_TRANSVERSAL_TRACK.courses.map((course) => ({ ...course })),
  };
}

function mergeWeights(
  custom?: Partial<RecommendationWeights>
): RecommendationWeights {
  return {
    ...DEFAULT_WEIGHTS,
    ...(custom || {}),
  };
}

function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeGenericId(value?: string): string {
  return normalizeText(value || "");
}

function normalizeGapScore(expectedLevel: number, currentLevel: number): number {
  return Math.max(0, expectedLevel - currentLevel);
}

function getMacroSetor(value?: string): string {
  const normalized = normalizeGenericId(value);
  if (!normalized) return "";

  const compact = normalized.replace(/[:\s-]+/g, "_");
  const tokens = compact.split(/[_]+/).filter(Boolean);
  const tokenSet = new Set(tokens);

  if (
    tokenSet.has("seconf") ||
    tokenSet.has("proad") ||
    tokenSet.has("proplan") ||
    tokenSet.has("gabinete") ||
    tokenSet.has("financeira") ||
    tokenSet.has("contabil") ||
    tokenSet.has("contratos") ||
    tokenSet.has("administrativa")
  ) {
    return "gestao";
  }

  if (
    tokenSet.has("pgdp") ||
    tokenSet.has("pessoas") ||
    tokenSet.has("desenvolvimento") ||
    tokenSet.has("rh")
  ) {
    return "desenvolvimento_pessoas";
  }

  if (
    tokenSet.has("cepaia") ||
    tokenSet.has("cesde") ||
    tokenSet.has("direito") ||
    tokenSet.has("educacao") ||
    tokenSet.has("dch") ||
    tokenSet.has("dcht") ||
    tokenSet.has("dedc") ||
    tokenSet.has("dcv")
  ) {
    return "educacao_direito";
  }

  return tokens[0] || compact;
}

function getSetorCandidateKeys(value?: string): string[] {
  const normalized = normalizeGenericId(value);
  if (!normalized) return [];

  const compact = normalized.replace(/[:\s-]+/g, "_");
  const pieces = compact.split(/[_]+/).filter(Boolean);
  const macro = getMacroSetor(value);

  const candidates = new Set<string>([normalized, compact, macro]);

  if (pieces.length > 0) candidates.add(pieces[0]);
  if (pieces.length > 1) candidates.add(`${pieces[0]}_${pieces[1]}`);

  return Array.from(candidates).filter(Boolean);
}

function includesValue(
  list: string[] | undefined,
  value: string | undefined
): boolean {
  if (!list?.length || !value) return false;

  const normalizedValue = normalizeGenericId(value);
  if (!normalizedValue) return false;

  return list.some((item) => normalizeGenericId(item) === normalizedValue);
}

function includesSetorValue(
  list: string[] | undefined,
  value: string | undefined
): boolean {
  if (!list?.length || !value) return false;

  const candidates = getSetorCandidateKeys(value);
  if (!candidates.length) return false;

  return list.some((item) => {
    const normalizedItem = normalizeGenericId(item).replace(/[:\s-]+/g, "_");
    return (
      candidates.includes(normalizedItem) ||
      candidates.some(
        (candidate) =>
          normalizedItem.includes(candidate) || candidate.includes(normalizedItem)
      )
    );
  });
}

function flattenCatalogField(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenCatalogField(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      flattenCatalogField(item)
    );
  }

  return [];
}

function getStringArrayFromUnknown(value: unknown): string[] {
  return flattenCatalogField(value)
    .map((item) => item.trim())
    .filter(Boolean);
}

function includesAnyNormalizedValue(
  list: unknown,
  candidateValues: Array<string | undefined>
): boolean {
  if (!Array.isArray(list)) return false;

  const normalizedCandidates = candidateValues
    .map((value) => normalizeGenericId(value))
    .filter(Boolean);

  if (!normalizedCandidates.length) return false;

  return list.some((item) => {
    const normalizedItem = normalizeGenericId(String(item));
    return normalizedCandidates.includes(normalizedItem);
  });
}

function getAssessmentLevel(
  assessments: UserCompetencyAssessment[],
  competencyId: string
): DifficultyLevel {
  const found = assessments.find((a) => a.competencyId === competencyId);
  return found?.currentLevel ?? 1;
}

function getCompletedCourseIds(history: UserCourseHistory[]): Set<string> {
  return new Set(
    history
      .filter((item) => item.completionStatus === "completed")
      .map((item) => item.courseId)
  );
}

function getInProgressCourseIds(history: UserCourseHistory[]): Set<string> {
  return new Set(
    history
      .filter((item) => item.completionStatus === "in_progress")
      .map((item) => item.courseId)
  );
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function isLegacyBlockedCourse(course?: {
  id?: string;
  title?: string;
}): boolean {
  const normalizedId = normalizeGenericId(course?.id);
  const normalizedTitle = normalizeText(course?.title || "");

  if (!normalizedId && !normalizedTitle) return false;

  if (
    normalizedId &&
    LEGACY_BLOCKED_COURSE_IDS.some(
      (blockedId) => normalizeGenericId(blockedId) === normalizedId
    )
  ) {
    return true;
  }

  return LEGACY_BLOCKED_COURSE_PATTERNS.some((pattern) =>
    normalizedTitle.includes(normalizeText(pattern))
  );
}

function filterLegacyBlockedCourses(
  courses: CatalogTrackRecommendationCourse[]
): CatalogTrackRecommendationCourse[] {
  return courses.filter((course) => !isLegacyBlockedCourse(course));
}

function buildCatalogCourseDedupKey(
  course: Pick<
    CatalogTrackRecommendationCourse,
    "title" | "workloadHours" | "modality"
  >
): string {
  return normalizeText(
    `${course.title}|${course.workloadHours}|${course.modality}`
  );
}

function dedupeCatalogRecommendationCourses(
  courses: CatalogTrackRecommendationCourse[]
): CatalogTrackRecommendationCourse[] {
  const seen = new Set<string>();
  const unique: CatalogTrackRecommendationCourse[] = [];

  for (const course of courses) {
    const key = buildCatalogCourseDedupKey(course);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(course);
  }

  return unique;
}

function totalCatalogWorkload(courses: Array<{ workloadHours: number }>): number {
  return courses.reduce((sum, course) => sum + course.workloadHours, 0);
}

function recommendationIdFromCatalogItem(
  item: RawCatalogRecommendation,
  index: number
): string {
  return [
    "REC",
    item.gap.competencyAxis,
    item.gap.competencyId,
    item.track.id,
    item.stage.id,
    String(index + 1).padStart(2, "0"),
  ].join("-");
}

function computeContextScore(
  expected: ExpectedCompetencyProfile,
  user: UserProfile,
  weights: RecommendationWeights
): number {
  let score = 0;

  if (includesValue(expected.appliesToCargoIds, user.cargoId)) {
    score += weights.contextCargoWeight;
  }
  if (includesSetorValue(expected.appliesToSetorIds, user.setorId)) {
    score += weights.contextSetorWeight;
  }
  if (includesValue(expected.appliesToFuncaoIds, user.funcaoFormalId)) {
    score += weights.contextFuncaoWeight;
  }
  if (includesValue(expected.appliesToUnidadeIds, user.unidadeId)) {
    score += weights.contextUnidadeWeight;
  }

  return score;
}

function computeInstitutionalPriorityScore(
  expected: ExpectedCompetencyProfile,
  weights: RecommendationWeights
): number {
  return (
    (expected.institutionalPriority ?? 0) * weights.institutionalPriorityWeight
  );
}

function rankCompetencies(
  input: RecommendationInput,
  weights: RecommendationWeights
): RankedCompetency[] {
  const competencyMap = mapById<Competency>(input.competencies);

  const ranked = input.expectedCompetencies
    .map((expected) => {
      const competency = competencyMap.get(expected.competencyId);

      if (!competency || !competency.active) return null;

      const currentLevel = getAssessmentLevel(
        input.assessments,
        expected.competencyId
      );
      const expectedLevel = expected.expectedLevel;
      const gap = Math.max(0, expectedLevel - currentLevel);

      if (gap <= 0) return null;

      const contextScore = computeContextScore(
        expected,
        input.userProfile,
        weights
      );
      const institutionalPriorityScore = computeInstitutionalPriorityScore(
        expected,
        weights
      );

      const totalScore =
        gap * weights.competencyGapWeight +
        contextScore +
        institutionalPriorityScore;

      const item: RankedCompetency = {
        competencyId: expected.competencyId,
        competencyName: competency.name,
        currentLevel,
        expectedLevel,
        gap,
        contextScore,
        institutionalPriorityScore,
        totalScore,
      };

      return item;
    })
    .filter((item): item is RankedCompetency => item !== null)
    .sort((a, b) => b.totalScore - a.totalScore);

  return ranked.slice(0, input.maxCompetencies ?? 3);
}

function computeTrackProfileScore(
  track: LearningTrack,
  user: UserProfile,
  weights: RecommendationWeights
): number {
  let score = 0;

  if (track.targetAudience?.includes(user.publicoAlvo || "")) {
    score += weights.trackAudienceWeight;
  }
  if (includesValue(track.recommendedCargoIds, user.cargoId)) {
    score += weights.trackCargoWeight;
  }
  if (includesSetorValue(track.recommendedSetorIds, user.setorId)) {
    score += weights.trackSetorWeight;
  }
  if (includesValue(track.recommendedFuncaoIds, user.funcaoFormalId)) {
    score += weights.trackFuncaoWeight;
  }
  if (includesValue(track.recommendedUnidadeIds, user.unidadeId)) {
    score += weights.trackUnidadeWeight;
  }

  return score;
}

function computeTrackContextMatchStrength(
  track: LearningTrack,
  user: UserProfile
): number {
  let score = 0;

  if (includesSetorValue(track.recommendedSetorIds, user.setorId)) score += 100;
  if (includesValue(track.recommendedUnidadeIds, user.unidadeId)) score += 35;
  if (includesValue(track.recommendedFuncaoIds, user.funcaoFormalId)) score += 20;
  if (includesValue(track.recommendedCargoIds, user.cargoId)) score += 20;
  if (track.targetAudience?.includes(user.publicoAlvo || "")) score += 10;

  return score;
}

function hasTrackAnyExplicitContext(track: LearningTrack): boolean {
  return Boolean(
    (track.recommendedSetorIds && track.recommendedSetorIds.length > 0) ||
      (track.recommendedUnidadeIds && track.recommendedUnidadeIds.length > 0) ||
      (track.recommendedFuncaoIds && track.recommendedFuncaoIds.length > 0) ||
      (track.recommendedCargoIds && track.recommendedCargoIds.length > 0) ||
      (track.targetAudience && track.targetAudience.length > 0)
  );
}

function getTrackGenericPenalty(
  track: LearningTrack,
  user: UserProfile
): number {
  const contextStrength = computeTrackContextMatchStrength(track, user);

  if (contextStrength > 0) return 0;

  const hasExplicitContext = hasTrackAnyExplicitContext(track);
  if (hasExplicitContext) return 120;

  return 45;
}

function computeTrackProgressScore(
  trackId: string,
  progressList: UserTrackProgress[],
  weights: RecommendationWeights
): number {
  const progress = progressList.find((item) => item.trackId === trackId);
  if (!progress) return 0;

  if (progress.status === "in_progress") {
    return weights.trackProgressBonus;
  }

  return 0;
}

function sortTracksByContextPriority(
  tracks: LearningTrack[],
  user: UserProfile
): LearningTrack[] {
  return [...tracks].sort((a, b) => {
    const aStrength = computeTrackContextMatchStrength(a, user);
    const bStrength = computeTrackContextMatchStrength(b, user);

    if (aStrength !== bStrength) return bStrength - aStrength;

    const aPenalty = getTrackGenericPenalty(a, user);
    const bPenalty = getTrackGenericPenalty(b, user);

    if (aPenalty !== bPenalty) return aPenalty - bPenalty;

    return a.title.localeCompare(b.title, "pt-BR");
  });
}

function filterTracksByStrictContext(
  tracks: LearningTrack[],
  user: UserProfile
): LearningTrack[] {
  if (!tracks.length) return tracks;

  const withSector = tracks.filter((track) =>
    includesSetorValue(track.recommendedSetorIds, user.setorId)
  );
  if (withSector.length > 0) return withSector;

  const withUnit = tracks.filter((track) =>
    includesValue(track.recommendedUnidadeIds, user.unidadeId)
  );
  if (withUnit.length > 0) return withUnit;

  const withRoleOrCargo = tracks.filter(
    (track) =>
      includesValue(track.recommendedFuncaoIds, user.funcaoFormalId) ||
      includesValue(track.recommendedCargoIds, user.cargoId)
  );
  if (withRoleOrCargo.length > 0) return withRoleOrCargo;

  return tracks.filter((track) => !hasTrackAnyExplicitContext(track));
}

function rankTracksForCompetency(
  competency: RankedCompetency,
  input: RecommendationInput,
  weights: RecommendationWeights
): RankedTrack[] {
  const baseTracks = input.learningTracks.filter((track) => {
    if (!track.active) return false;

    const mainMatch = track.mainCompetencyId === competency.competencyId;
    const relatedMatch = (track.relatedCompetencyIds || []).includes(
      competency.competencyId
    );

    return mainMatch || relatedMatch;
  });

  const strictTracks = filterTracksByStrictContext(baseTracks, input.userProfile);
  const tracks = sortTracksByContextPriority(strictTracks, input.userProfile);

  return tracks
    .map((track) => {
      const profileScore = computeTrackProfileScore(
        track,
        input.userProfile,
        weights
      );
      const audienceScore = track.targetAudience?.includes(
        input.userProfile.publicoAlvo || ""
      )
        ? weights.trackAudienceWeight
        : 0;
      const progressScore = computeTrackProgressScore(
        track.id,
        input.userTrackProgress,
        weights
      );
      const contextStrength = computeTrackContextMatchStrength(
        track,
        input.userProfile
      );
      const genericPenalty = getTrackGenericPenalty(track, input.userProfile);

      const totalScore =
        competency.totalScore +
        profileScore +
        audienceScore +
        progressScore +
        contextStrength -
        genericPenalty;

      const item: RankedTrack = {
        trackId: track.id,
        trackTitle: track.title,
        competencyId: competency.competencyId,
        baseCompetencyScore: competency.totalScore,
        profileScore,
        audienceScore,
        progressScore,
        totalScore,
      };

      return item;
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

function determineInitialStage(
  trackId: string,
  currentLevel: DifficultyLevel,
  trackStages: TrackStage[],
  userTrackProgress: UserTrackProgress[]
): TrackStage | null {
  const stages = trackStages
    .filter((stage) => stage.trackId === trackId && stage.active)
    .sort((a, b) => a.order - b.order);

  if (!stages.length) return null;

  const progress = userTrackProgress.find((item) => item.trackId === trackId);

  if (progress) {
    const nextIncomplete = stages.find(
      (stage) => !progress.completedStageIds.includes(stage.id)
    );
    if (nextIncomplete) {
      return nextIncomplete;
    }
  }

  const stageByLevel =
    stages.find((stage) => stage.level === currentLevel) ||
    stages.find((stage) => stage.order === currentLevel) ||
    stages[0];

  return stageByLevel ?? null;
}

function computeCourseWorkloadScore(
  workloadHours: number,
  weights: RecommendationWeights
): number {
  if (workloadHours <= 20) return weights.courseLowWorkloadBonus;
  if (workloadHours <= 40) return weights.courseMediumWorkloadBonus;
  return 0;
}

function computeStageScore(
  courseStage: TrackStage,
  selectedStage: TrackStage,
  weights: RecommendationWeights
): number {
  if (courseStage.id === selectedStage.id) {
    return weights.courseStageExactWeight;
  }

  if (courseStage.order === selectedStage.order + 1) {
    return weights.courseStageNextWeight;
  }

  return 0;
}

function computeSoftSimilarityPenalty(
  candidate: Course,
  alreadyAcceptedCourses: Course[],
  weights: RecommendationWeights
): number {
  if (alreadyAcceptedCourses.length === 0) return 0;

  const candidateTokens = tokenize(
    `${candidate.title} ${candidate.description ?? ""} ${(candidate.keywords ?? []).join(" ")}`
  );

  let maxPenalty = 0;

  for (const accepted of alreadyAcceptedCourses) {
    const acceptedTokens = tokenize(
      `${accepted.title} ${accepted.description ?? ""} ${(accepted.keywords ?? []).join(" ")}`
    );

    const similarity = jaccardSimilarity(candidateTokens, acceptedTokens);

    let penalty = 0;

    if (similarity >= 0.7) {
      penalty += weights.courseSimilarityPenalty + 2;
    } else if (similarity >= 0.45) {
      penalty += weights.courseSimilarityPenalty;
    } else if (similarity >= 0.25) {
      penalty += 1;
    }

    if (accepted.mainCompetencyId === candidate.mainCompetencyId) {
      penalty += 0.5;
    }

    if (accepted.difficultyLevel === candidate.difficultyLevel) {
      penalty += 0.5;
    }

    maxPenalty = Math.max(maxPenalty, penalty);
  }

  return maxPenalty;
}

function diversifyRankedCourses(
  scoredCourses: Array<{
    ranked: RankedCourse;
    course: Course;
    stage: TrackStage;
  }>,
  maxCourses: number,
  weights: RecommendationWeights
): RankedCourse[] {
  const selected: Array<{
    ranked: RankedCourse;
    course: Course;
    stage: TrackStage;
  }> = [];

  const pool = [...scoredCourses].sort(
    (a, b) => b.ranked.totalScore - a.ranked.totalScore
  );

  while (pool.length > 0 && selected.length < maxCourses) {
    let bestIndex = 0;
    let bestAdjustedScore = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[i];
      const diversityPenalty = computeSoftSimilarityPenalty(
        candidate.course,
        selected.map((item) => item.course),
        weights
      );

      const adjustedScore = candidate.ranked.totalScore - diversityPenalty;

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = i;
      }
    }

    const chosen = pool.splice(bestIndex, 1)[0];
    selected.push({
      ...chosen,
      ranked: {
        ...chosen.ranked,
        totalScore: Number(bestAdjustedScore.toFixed(2)),
        details: {
          ...chosen.ranked.details,
          similarityPenalty:
            chosen.ranked.details.similarityPenalty +
            Math.max(0, chosen.ranked.totalScore - bestAdjustedScore),
        },
      },
    });
  }

  return selected.map((item) => item.ranked);
}

function rankCoursesForTrackStage(
  track: RankedTrack,
  selectedStage: TrackStage,
  input: RecommendationInput,
  weights: RecommendationWeights
): RankedCourse[] {
  const courseMap = mapById(input.courses);
  const stageMap = mapById(input.trackStages);
  const completedCourseIds = getCompletedCourseIds(input.userCourseHistory);
  const inProgressCourseIds = getInProgressCourseIds(input.userCourseHistory);
  const recentRecommendedCourseIds = new Set(
    input.recentRecommendedCourseIds ?? []
  );

  const links = input.trackCourseLinks
    .filter((link) => {
      if (!link.active) return false;
      if (link.trackId !== track.trackId) return false;

      const stage = stageMap.get(link.stageId);
      if (!stage || !stage.active) return false;

      return (
        link.stageId === selectedStage.id ||
        stage.order === selectedStage.order + 1
      );
    })
    .sort((a, b) => a.recommendedOrder - b.recommendedOrder);

  const scoredCourses: Array<{
    ranked: RankedCourse;
    course: Course;
    stage: TrackStage;
  }> = [];

  for (const link of links) {
    const course = courseMap.get(link.courseId);
    const courseStage = stageMap.get(link.stageId);

    if (!course || !course.active || !courseStage || !courseStage.active) {
      continue;
    }

    if (completedCourseIds.has(course.id)) {
      continue;
    }

    const relevanceScore = link.relevanceWeight * 10;
    const stageScore = computeStageScore(courseStage, selectedStage, weights);
    const modalityScore =
      course.modality === "ead" ? weights.courseEadBonus : 0;
    const workloadScore = computeCourseWorkloadScore(
      course.workloadHours,
      weights
    );
    const historyScore = inProgressCourseIds.has(course.id)
      ? weights.courseInProgressBonus
      : 0;
    const repetitionPenalty = recentRecommendedCourseIds.has(course.id)
      ? weights.courseRecentRecommendationPenalty
      : 0;

    const baseTotalScore =
      relevanceScore +
      stageScore +
      modalityScore +
      workloadScore +
      historyScore -
      repetitionPenalty;

    scoredCourses.push({
      ranked: {
        courseId: course.id,
        courseTitle: course.title,
        stageId: courseStage.id,
        stageTitle: courseStage.title,
        trackId: track.trackId,
        trackTitle: track.trackTitle,
        relevanceWeight: link.relevanceWeight,
        totalScore: Number(baseTotalScore.toFixed(2)),
        details: {
          relevanceScore,
          stageScore,
          modalityScore,
          workloadScore,
          historyScore,
          repetitionPenalty,
          similarityPenalty: 0,
        },
      },
      course,
      stage: courseStage,
    });
  }

  return diversifyRankedCourses(
    scoredCourses,
    input.maxCoursesPerTrack ?? 3,
    weights
  );
}

function buildExplanation(
  competency: RankedCompetency,
  track: RankedTrack | null,
  stage: TrackStage | null,
  courses: RankedCourse[]
): string {
  const parts: string[] = [];

  parts.push(
    `A competência prioritária é "${competency.competencyName}" porque o nível atual (${competency.currentLevel}) está abaixo do esperado (${competency.expectedLevel}), gerando lacuna ${competency.gap}.`
  );

  if (track) {
    parts.push(
      `A trilha selecionada foi "${track.trackTitle}" por apresentar maior aderência à competência e ao contexto institucional do servidor.`
    );
  }

  if (stage) {
    parts.push(
      `A etapa inicial recomendada é "${stage.title}" (nível ${stage.level}), pois corresponde ao momento formativo atual do servidor.`
    );
  }

  if (courses.length) {
    parts.push(
      `Os cursos foram ranqueados por relevância, aderência à etapa e viabilidade de carga horária.`
    );
  }

  return parts.join(" ");
}

export function generateTrackBasedRecommendations(
  input: RecommendationInput
): RecommendationResult {
  const weights = mergeWeights(input.weights);
  const rankedCompetencies = rankCompetencies(input, weights);

  const items: RecommendationResultItem[] = rankedCompetencies.map(
    (competency) => {
      const rankedTracks = rankTracksForCompetency(
        competency,
        input,
        weights
      );
      const selectedTrack = rankedTracks[0] ?? null;

      if (!selectedTrack) {
        return {
          competency,
          track: null,
          selectedStage: null,
          courses: [],
          explanation: `A competência "${competency.competencyName}" foi priorizada, mas ainda não há trilha cadastrada para ela.`,
        };
      }

      const selectedStage = determineInitialStage(
        selectedTrack.trackId,
        competency.currentLevel as DifficultyLevel,
        input.trackStages,
        input.userTrackProgress
      );

      if (!selectedStage) {
        return {
          competency,
          track: selectedTrack,
          selectedStage: null,
          courses: [],
          explanation: `A trilha "${selectedTrack.trackTitle}" foi selecionada, mas ainda não há etapas ativas cadastradas.`,
        };
      }

      const rankedCourses = rankCoursesForTrackStage(
        selectedTrack,
        selectedStage,
        input,
        weights
      );

      return {
        competency,
        track: selectedTrack,
        selectedStage,
        courses: rankedCourses,
        explanation: buildExplanation(
          competency,
          selectedTrack,
          selectedStage,
          rankedCourses
        ),
      };
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    userId: input.userProfile.userId,
    items,
  };
}

// ==========================
// MOTOR SIMPLIFICADO BASEADO NO CATÁLOGO FIRESTORE
// ==========================

function mapProfileToGapInput(item: ProfileCompetencyInput): GapInput | null {
  const gapScore = normalizeGapScore(item.expectedLevel, item.currentLevel);

  if (gapScore <= 0) return null;

  return {
    competencyId: item.competencyId,
    competencyName: item.competencyName,
    competencyAxis: item.competencyAxis,
    expectedLevel: item.expectedLevel,
    currentLevel: item.currentLevel,
    gapScore,
    priority: item.priority ?? gapScore,
  };
}

export function buildGapInputsFromProfiles(
  profileCompetencies: ProfileCompetencyInput[]
): GapInput[] {
  return profileCompetencies
    .map(mapProfileToGapInput)
    .filter(Boolean) as GapInput[];
}

function toCatalogCourseList(
  item: RawCatalogRecommendation
): CatalogTrackRecommendationCourse[] {
  return item.courses.map((course) => ({
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    modality: course.modality,
    workloadHours: course.workloadHours,
    level: course.level,
  }));
}

function getValidCoursesForTrackRecommendation(
  item: RawCatalogRecommendation
): CatalogTrackRecommendationCourse[] {
  return filterLegacyBlockedCourses(
    dedupeCatalogRecommendationCourses(toCatalogCourseList(item))
  );
}

function hasTrackSectorMatch(
  recommendation: RawCatalogRecommendation,
  setorId?: string
): boolean {
  if (!setorId) return false;

  const trackData = recommendation.track as Record<string, any>;
  const possibleLists = [
    trackData.recommendedSetorIds,
    trackData.appliesToSetorIds,
    trackData.setorIds,
    trackData.sectorIds,
  ];

  return possibleLists.some(
    (list) => Array.isArray(list) && includesSetorValue(list, setorId)
  );
}

function hasTrackUnitMatch(
  recommendation: RawCatalogRecommendation,
  unidadeId?: string
): boolean {
  if (!unidadeId) return false;

  const trackData = recommendation.track as Record<string, any>;
  const possibleLists = [
    trackData.recommendedUnidadeIds,
    trackData.appliesToUnidadeIds,
    trackData.unidadeIds,
    trackData.unitIds,
  ];

  return possibleLists.some((list) =>
    includesAnyNormalizedValue(list, [unidadeId])
  );
}

function hasTrackRoleMatch(
  recommendation: RawCatalogRecommendation,
  funcaoId?: string,
  cargoId?: string
): boolean {
  const trackData = recommendation.track as Record<string, any>;
  const possibleLists = [
    trackData.recommendedFuncaoIds,
    trackData.appliesToFuncaoIds,
    trackData.funcaoIds,
    trackData.roleIds,
    trackData.recommendedCargoIds,
    trackData.appliesToCargoIds,
    trackData.cargoIds,
  ];

  return possibleLists.some((list) =>
    includesAnyNormalizedValue(list, [funcaoId, cargoId])
  );
}

function hasAnyExplicitTrackContext(recommendation: RawCatalogRecommendation): boolean {
  const trackData = recommendation.track as Record<string, any>;

  return (
    getStringArrayFromUnknown(trackData.recommendedSetorIds).length > 0 ||
    getStringArrayFromUnknown(trackData.appliesToSetorIds).length > 0 ||
    getStringArrayFromUnknown(trackData.recommendedUnidadeIds).length > 0 ||
    getStringArrayFromUnknown(trackData.appliesToUnidadeIds).length > 0 ||
    getStringArrayFromUnknown(trackData.recommendedFuncaoIds).length > 0 ||
    getStringArrayFromUnknown(trackData.appliesToFuncaoIds).length > 0 ||
    getStringArrayFromUnknown(trackData.recommendedCargoIds).length > 0 ||
    getStringArrayFromUnknown(trackData.appliesToCargoIds).length > 0
  );
}

function hasDirectCompetencyMatch(
  item: RawCatalogRecommendation,
  gap: GapInput
): boolean {
  const mainCompetencyId = normalizeGenericId(
    (item.track as any).mainCompetencyId ||
      (item.track as any).competenciaPrincipal
  );

  const relatedCompetencyIds = Array.isArray((item.track as any).relatedCompetencyIds)
    ? (item.track as any).relatedCompetencyIds
    : Array.isArray((item.track as any).competenciasSecundarias)
    ? (item.track as any).competenciasSecundarias
    : [];

  const normalizedGapCompetencyId = normalizeGenericId(gap.competencyId);

  if (mainCompetencyId === normalizedGapCompetencyId) return true;

  return relatedCompetencyIds.some(
    (id: unknown) => normalizeGenericId(String(id)) === normalizedGapCompetencyId
  );
}

function filterTracksByContextPriority(
  items: RawCatalogRecommendation[],
  options: GetCatalogRecommendationsOptions
): RawCatalogRecommendation[] {
  if (!items.length) return items;

  const withSector = items.filter((item) =>
    hasTrackSectorMatch(item, options.setorId)
  );
  if (withSector.length > 0) return withSector;

  const withUnit = items.filter((item) =>
    hasTrackUnitMatch(item, options.unidadeId)
  );
  if (withUnit.length > 0) return withUnit;

  const withRoleOrCargo = items.filter((item) =>
    hasTrackRoleMatch(item, options.funcaoId, options.cargoId)
  );
  if (withRoleOrCargo.length > 0) return withRoleOrCargo;

  const generic = items.filter((item) => !hasAnyExplicitTrackContext(item));
  if (generic.length > 0) return generic;

  return [];
}

function computeSimpleTrackScore(
  item: RawCatalogRecommendation,
  gap: GapInput,
  options: GetCatalogRecommendationsOptions
): number {
  let score = 0;

  const mainCompetencyId = normalizeGenericId(
    (item.track as any).mainCompetencyId ||
      (item.track as any).competenciaPrincipal
  );

  const relatedCompetencyIds = Array.isArray((item.track as any).relatedCompetencyIds)
    ? (item.track as any).relatedCompetencyIds
    : Array.isArray((item.track as any).competenciasSecundarias)
    ? (item.track as any).competenciasSecundarias
    : [];

  if (mainCompetencyId === normalizeGenericId(gap.competencyId)) {
    score += 100;
  } else if (
    relatedCompetencyIds.some(
      (id: unknown) =>
        normalizeGenericId(String(id)) === normalizeGenericId(gap.competencyId)
    )
  ) {
    score += 60;
  }

  if (hasTrackSectorMatch(item, options.setorId)) score += 80;
  if (hasTrackUnitMatch(item, options.unidadeId)) score += 40;
  if (hasTrackRoleMatch(item, options.funcaoId, options.cargoId)) score += 30;

  if (item.track.preferredModality === (options.preferredModality ?? "EAD")) {
    score += 10;
  }

  const workload = totalCatalogWorkload(item.courses);
  if (workload >= 20 && workload <= 80) score += 5;

  score += item.matchScore;

  return score;
}

function buildSpecificRecommendation(params: {
  item: RawCatalogRecommendation;
  gap: GapInput;
  index: number;
  score: number;
  courses: CatalogTrackRecommendationCourse[];
}): CatalogTrackRecommendation {
  const { item, gap, index, score, courses } = params;

  return {
    id: recommendationIdFromCatalogItem(item, index),
    source: "catalog-track-engine",
    competencyId: gap.competencyId,
    competencyName: gap.competencyName,
    competencyAxis: gap.competencyAxis,
    expectedLevel: gap.expectedLevel,
    currentLevel: gap.currentLevel,
    gapScore: gap.gapScore,
    priority: gap.priority,
    score,
    rationale: `A trilha foi recomendada por estar vinculada à competência "${gap.competencyName}", em que foi identificada lacuna entre o nível esperado e o nível atual do servidor, além de apresentar aderência ao contexto profissional informado.`,
    track: {
      id: item.track.id,
      code: item.track.code,
      title: item.track.title,
      description: item.track.description,
      competencyAxis: item.track.competencyAxis,
      preferredModality: item.track.preferredModality,
    },
    stage: {
      id: item.stage.id,
      title: item.stage.title,
      description: item.stage.description,
      level: item.stage.level,
      recommendedTotalHours: item.stage.recommendedTotalHours,
    },
    courses,
    totalWorkloadHours: totalCatalogWorkload(courses),
    recommendedLevel: item.stage.level,
    recommendedOrder: index + 1,
    isFallback: false,
    fallbackType: null,
  };
}

function buildFallbackRecommendation(
  gap: GapInput,
  index: number
): CatalogTrackRecommendation {
  const fallback = cloneTransversalFallbackRecommendation();

  return {
    ...fallback,
    id: `REC-FALLBACK-${gap.competencyAxis}-${gap.competencyId}-${String(
      index + 1
    ).padStart(2, "0")}`,
    competencyId: gap.competencyId,
    competencyName: gap.competencyName,
    competencyAxis: gap.competencyAxis,
    expectedLevel: gap.expectedLevel,
    currentLevel: gap.currentLevel,
    gapScore: gap.gapScore,
    priority: gap.priority,
    recommendedOrder: index + 1,
  };
}

function sortCatalogRecommendations(
  recommendations: CatalogTrackRecommendation[],
  sortBy: GetCatalogRecommendationsOptions["sortBy"] = "score"
): CatalogTrackRecommendation[] {
  const items = [...recommendations];

  if (sortBy === "axis") {
    return items.sort((a, b) => {
      if (a.competencyAxis !== b.competencyAxis) {
        return a.competencyAxis.localeCompare(b.competencyAxis, "pt-BR");
      }
      return b.score - a.score;
    });
  }

  if (sortBy === "priority") {
    return items.sort((a, b) => {
      const pa = a.priority ?? 0;
      const pb = b.priority ?? 0;
      if (pa !== pb) return pb - pa;
      return b.score - a.score;
    });
  }

  return items.sort((a, b) => {
    const gapDiff = (b.gapScore ?? 0) - (a.gapScore ?? 0);
    if (gapDiff !== 0) return gapDiff;

    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;

    return b.score - a.score;
  });
}

export async function getCatalogRecommendations(
  db: FirestoreDb,
  gaps: GapInput[],
  options: GetCatalogRecommendationsOptions = {}
): Promise<CatalogTrackRecommendation[]> {
  const {
    maxTracksPerGap = 10,
    maxFinalRecommendations = 3,
    preferredLevel,
    preferredModality = "EAD",
    activeOnly = true,
    sortBy = "score",
  } = options;

  if (!gaps.length) return [];

  console.log("DEBUG GAPS INPUT:", gaps);

  const rawCatalogRecommendations = await buildRecommendationsFromGaps(db, gaps, {
    maxTracksPerGap,
    preferredLevel,
    preferredModality,
    activeOnly,
  });

  console.log(
    "DEBUG buildRecommendationsFromGaps RAW:",
    rawCatalogRecommendations.map((item) => ({
      competencyId: item.gap?.competencyId,
      trackId: item.track?.id,
      trackTitle: item.track?.title,
      stageId: item.stage?.id,
      courses: Array.isArray(item.courses) ? item.courses.map((c) => c.id) : [],
      matchScore: item.matchScore,
    }))
  );

  const orderedGaps = [...gaps].sort((a, b) => {
    const gapDiff = (b.gapScore ?? 0) - (a.gapScore ?? 0);
    if (gapDiff !== 0) return gapDiff;

    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;

    return a.competencyName.localeCompare(b.competencyName, "pt-BR");
  });

  const recommendations: CatalogTrackRecommendation[] = [];
  const usedTrackIds = new Set<string>();
  let fallbackAlreadyUsed = false;

  for (const gap of orderedGaps) {
    const itemsForGap = rawCatalogRecommendations.filter(
      (item) => normalizeGenericId(item.gap.competencyId) === normalizeGenericId(gap.competencyId)
    );

    const directTracks = itemsForGap.filter((item) =>
      hasDirectCompetencyMatch(item, gap)
    );

    const contextualTracks = filterTracksByContextPriority(
      directTracks,
      options
    );

    const rankedTracks = contextualTracks
      .map((item) => ({
        item,
        score: computeSimpleTrackScore(item, gap, options),
      }))
      .sort((a, b) => b.score - a.score);

    const selected = rankedTracks.find(
      ({ item }) => !usedTrackIds.has(item.track.id)
    );

    if (selected) {
      const validCourses = getValidCoursesForTrackRecommendation(selected.item);

      if (validCourses.length > 0) {
        recommendations.push(
          buildSpecificRecommendation({
            item: selected.item,
            gap,
            index: recommendations.length,
            score: selected.score,
            courses: validCourses,
          })
        );

        usedTrackIds.add(selected.item.track.id);
        continue;
      }

      console.log(
        "⚠️ TRILHA DESCARTADA POR CURSOS BLOQUEADOS:",
        selected.item.track?.title
      );
    }

    if (!fallbackAlreadyUsed) {
      recommendations.push(
        buildFallbackRecommendation(gap, recommendations.length)
      );
      fallbackAlreadyUsed = true;
    }
  }

  console.log(
    "DEBUG AFTER CONTEXT PRIORITIZATION:",
    recommendations.map((item) => ({
      trackId: item.track?.id,
      trackTitle: item.track?.title,
      matchScore: item.score,
      isFallback: item.isFallback ?? false,
    }))
  );

  return sortCatalogRecommendations(recommendations, sortBy).slice(
    0,
    maxFinalRecommendations
  );
}

export async function getCatalogRecommendationsFromProfiles(
  db: FirestoreDb,
  profileCompetencies: ProfileCompetencyInput[],
  options: GetCatalogRecommendationsOptions = {}
): Promise<CatalogTrackRecommendation[]> {
  const gaps = buildGapInputsFromProfiles(profileCompetencies);
  return getCatalogRecommendations(db, gaps, options);
}

export function groupCatalogRecommendationsByAxis(
  recommendations: CatalogTrackRecommendation[]
): CatalogRecommendationsGroupedByAxis {
  return {
    E1: recommendations.filter((item) => item.competencyAxis === "E1"),
    E2: recommendations.filter((item) => item.competencyAxis === "E2"),
    E3: recommendations.filter((item) => item.competencyAxis === "E3"),
    E4: recommendations.filter((item) => item.competencyAxis === "E4"),
    E5: recommendations.filter((item) => item.competencyAxis === "E5"),
  };
}

export function getTopCatalogRecommendationsByAxis(
  recommendations: CatalogTrackRecommendation[],
  limitPerAxis = 2
): CatalogRecommendationsGroupedByAxis {
  const grouped = groupCatalogRecommendationsByAxis(recommendations);

  return {
    E1: grouped.E1.slice(0, limitPerAxis),
    E2: grouped.E2.slice(0, limitPerAxis),
    E3: grouped.E3.slice(0, limitPerAxis),
    E4: grouped.E4.slice(0, limitPerAxis),
    E5: grouped.E5.slice(0, limitPerAxis),
  };
}

export function flattenGroupedCatalogRecommendations(
  grouped: CatalogRecommendationsGroupedByAxis
): CatalogTrackRecommendation[] {
  return [
    ...grouped.E1,
    ...grouped.E2,
    ...grouped.E3,
    ...grouped.E4,
    ...grouped.E5,
  ];
}