import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
} from "firebase/firestore";

import { loadCourseCatalog } from "@/lib/catalog-service";
import {
  getCatalogRecommendationsFromProfiles,
  type ProfileCompetencyInput,
} from "@/lib/recommendation-engine";
import type {
  MicrolearningAction,
  Priority,
  RecommendationItem,
  SuggestedCourse,
} from "@/lib/recommendation-engine-v2";
import type { CompetencyAxis } from "@/lib/catalog-query-engine";

export interface RecommendationDebugInfo {
  userId: string;
  userProfile: {
    cargoId?: string;
    cargoNome?: string;
    unidadeId?: string;
    unidadeNome?: string;
    setorId?: string;
    setorNome?: string;
    funcaoFormalId?: string;
    funcaoFormalNome?: string;
    publicoAlvo?: string;
  };
  userDataCounts: {
    expectedCompetencies: number;
    assessments: number;
    completedCourses: number;
  };
  catalogCounts: {
    competencies: number;
    learningTracks: number;
    trackStages: number;
    courses: number;
    trackCourseLinks: number;
  };
  competencyDiagnostics: Array<{
    competencyId: string;
    competencyName: string;
    competencyAxis: string;
    currentLevel: number;
    expectedLevel: number;
    gap: number;
    weightedPriority: number;
    origins: string[];
    hasTrack: boolean;
  }>;
}

export interface RecommendationServiceResponse {
  recommendations: RecommendationItem[];
  debug: RecommendationDebugInfo;
}

type UserProfileSnapshot = {
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
};

type ExpectedProfileStoredItem = {
  competencyId?: string;
  id?: string;
  competenciaId?: string;
  competencyName?: string;
  nome?: string;
  competencyAxis?: string;
  axis?: string;
  axisCode?: string;
  axisName?: string;
  expectedLevel?: number | string | null;
  nivelEsperado?: number | string | null;
  origins?: string[] | null;
  origin?: string | null;
};

type AssessmentStoredItem = {
  competencyId?: string;
  id?: string;
  competenciaId?: string;
  competencyName?: string;
  competencyAxis?: string;
  currentLevel?: number | string | null;
  level?: number | string | null;
  nivelAtual?: number | string | null;
};

type CompletedCourseStoredItem = {
  id: string;
  name?: string;
  courseId?: string;
  linkedCompetencyId?: string | null;
  linkedCompetencyName?: string | null;
  axisCode?: string | null;
  axisName?: string | null;
  sourceRecommendationId?: string | null;
  sourceRecommendationTitle?: string | null;
  hours?: number | string | null;
  certificateUrl?: string | null;
};

type CatalogCourseSnapshot = {
  source?: string;
  provider?: string;
  providerName?: string;
  targetAudience?: string;
  expectedOutcome?: string;
};

type CatalogCourseLike = {
  id: string;
  code?: string;
  title: string;
  description?: string;
  modality?:
    | "ead"
    | "presencial"
    | "hibrido"
    | "EAD"
    | "PRESENCIAL"
    | "HIBRIDO";
  workloadHours?: number;
  difficultyLevel?: 1 | 2 | 3;
  url?: string;
  source?: string;
  provider?: string;
  providerName?: string;
  providerType?: string;
  active?: boolean;
};

type EngineCourseLike = {
  id: string;
  code?: string;
  title: string;
  description?: string;
  modality?: "EAD" | "PRESENCIAL" | "HIBRIDO";
  workloadHours?: number;
  level?: string;
};

type TrackCourseLinkLike = {
  id: string;
  trackId: string;
  courseId: string;
  recommendedOrder?: number;
  isRequired?: boolean;
  active?: boolean;
};

type EnrichedProfileCompetencyInput = ProfileCompetencyInput & {
  origins: string[];
  weightedPriority: number;
};

const MAX_FINAL_TRACKS = 3;

function normalizeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
}

function normalizeLookup(value: unknown): string {
  return normalizeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s:-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const text = normalizeLookup(value);
  if (!text) return fallback;
  if (["false", "0", "nao", "não", "inativo", "inactive"].includes(text)) {
    return false;
  }
  if (["true", "1", "sim", "ativo", "active"].includes(text)) {
    return true;
  }
  return fallback;
}

function normalizeOrigins(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeLookup(item))
      .filter(Boolean);
  }

  const single = normalizeLookup(value);
  return single ? [single] : [];
}

function getRoleInfluenceBonus(origins: string[]): number {
  return origins.includes("role") ? 1 : 0;
}

function axisNameFromCode(axisCode?: string): string {
  const axis = normalizeString(axisCode).toUpperCase();

  if (axis === "E1") return "Comunicação institucional";
  if (axis === "E2") return "Trabalho em equipe";
  if (axis === "E3") return "Ética e responsabilidade pública";
  if (axis === "E4") return "Inovação e melhoria de processos";
  if (axis === "E5") return "Planejamento e gestão do trabalho";

  return axis || "Competências profissionais";
}

function normalizeAxisCode(raw?: string | null): CompetencyAxis {
  const value = normalizeString(raw).toUpperCase();

  if (value === "E1") return "E1";
  if (value === "E2") return "E2";
  if (value === "E3") return "E3";
  if (value === "E4") return "E4";
  if (value === "E5") return "E5";

  const normalized = normalizeLookup(raw);

  if (normalized.includes("comunic")) return "E1";
  if (normalized.includes("equipe") || normalized.includes("interpessoal")) {
    return "E2";
  }
  if (normalized.includes("etica") || normalized.includes("respons")) {
    return "E3";
  }
  if (normalized.includes("inov") || normalized.includes("process")) {
    return "E4";
  }
  if (normalized.includes("planej") || normalized.includes("gest")) {
    return "E5";
  }

  return "E4";
}

function getPriorityFromGap(gap: number): Priority {
  if (gap >= 2) return "ALTA";
  if (gap === 1) return "MÉDIA";
  return "BAIXA";
}

function mapTrackModalityToUiLabel(
  modality?:
    | "EAD"
    | "PRESENCIAL"
    | "HIBRIDO"
    | "ead"
    | "presencial"
    | "hibrido"
): string {
  const normalized = normalizeLookup(modality);
  if (normalized === "presencial") return "presencial";
  if (normalized === "hibrido") return "híbrida";
  return "ead";
}

function buildMicrolearningActions(
  competencyName: string
): MicrolearningAction[] {
  const baseId =
    normalizeLookup(competencyName).replace(/\s+/g, "_") || "competencia";

  return [
    {
      id: `${baseId}_micro_1`,
      title: `Leitura rápida sobre ${competencyName}`,
      description: `Leia um conteúdo curto sobre ${competencyName} e observe como ele se aplica ao seu trabalho.`,
      estimatedMinutes: 15,
    },
    {
      id: `${baseId}_micro_2`,
      title: "Aplicação no trabalho",
      description: `Escolha uma atividade prática em que ${competencyName} possa ser aplicada no seu setor.`,
      estimatedMinutes: 10,
    },
    {
      id: `${baseId}_micro_3`,
      title: "Plano de ação",
      description: `Defina uma ação simples para começar a desenvolver ${competencyName} no dia a dia.`,
      estimatedMinutes: 15,
    },
  ];
}

async function loadUserProfile(
  db: Firestore,
  userId: string
): Promise<UserProfileSnapshot> {
  const [userSnap, contextSnap] = await Promise.all([
    getDoc(doc(db, "users", userId)),
    getDoc(doc(db, "users", userId, "context", "professionalContext")),
  ]);

  if (!userSnap.exists() && !contextSnap.exists()) {
    throw new Error("Usuário não encontrado");
  }

  const userData = userSnap.exists()
    ? (userSnap.data() as Record<string, unknown>)
    : {};
  const contextData = contextSnap.exists()
    ? (contextSnap.data() as Record<string, unknown>)
    : {};

  return {
    userId,
    cargoId:
      normalizeString(contextData.cargoId) || normalizeString(userData.cargoId),
    cargoNome:
      normalizeString(contextData.cargoNome) ||
      normalizeString(userData.cargoNome),
    unidadeId:
      normalizeString(contextData.unitId) ||
      normalizeString(contextData.unidadeId) ||
      normalizeString(userData.unidadeId),
    unidadeNome:
      normalizeString(contextData.unitName) ||
      normalizeString(contextData.unidadeNome) ||
      normalizeString(userData.unidadeNome),
    setorId:
      normalizeString(contextData.sectorId) ||
      normalizeString(contextData.setorId) ||
      normalizeString(userData.setorId),
    setorNome:
      normalizeString(contextData.sectorName) ||
      normalizeString(contextData.setorNome) ||
      normalizeString(userData.setorNome),
    funcaoFormalId:
      normalizeString(contextData.roleId) ||
      normalizeString(contextData.formalRoleId) ||
      normalizeString(contextData.funcaoFormalId) ||
      normalizeString(userData.funcaoFormalId),
    funcaoFormalNome:
      normalizeString(contextData.roleName) ||
      normalizeString(contextData.funcaoNome) ||
      normalizeString(userData.funcaoFormalNome),
    publicoAlvo:
      normalizeString(userData.publicoAlvo) || "tecnico_administrativo",
  };
}

async function loadExpectedProfileItems(
  db: Firestore,
  userId: string
): Promise<ExpectedProfileStoredItem[]> {
  const snap = await getDoc(doc(db, "users", userId, "context", "expectedProfile"));

  if (!snap.exists()) return [];

  const data = snap.data() as Record<string, unknown>;
  const competencies = Array.isArray(data.competencies)
    ? (data.competencies as ExpectedProfileStoredItem[])
    : [];

  return competencies;
}

async function loadAssessmentItems(
  db: Firestore,
  userId: string
): Promise<AssessmentStoredItem[]> {
  const snap = await getDoc(doc(db, "users", userId, "assessment", "competencies"));

  if (!snap.exists()) return [];

  const data = snap.data() as Record<string, unknown>;
  const items = Array.isArray(data.items)
    ? (data.items as AssessmentStoredItem[])
    : [];

  return items;
}

async function loadCompletedCourses(
  db: Firestore,
  userId: string
): Promise<CompletedCourseStoredItem[]> {
  const snap = await getDocs(collection(db, "users", userId, "completedCourses"));

  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;

    return {
      id: docSnap.id,
      name: normalizeString(data.name),
      courseId: normalizeString(data.courseId),
      linkedCompetencyId: normalizeString(data.linkedCompetencyId) || null,
      linkedCompetencyName: normalizeString(data.linkedCompetencyName) || null,
      axisCode: normalizeString(data.axisCode) || null,
      axisName: normalizeString(data.axisName) || null,
      sourceRecommendationId:
        normalizeString(data.sourceRecommendationId) || null,
      sourceRecommendationTitle:
        normalizeString(data.sourceRecommendationTitle) || null,
      hours: normalizeNumber(data.hours, 0),
      certificateUrl: normalizeString(data.certificateUrl) || null,
    };
  });
}

function normalizeTrackContextValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => normalizeLookup(item)).filter(Boolean);
}

function getSectorFamily(value?: string): string {
  const normalized = normalizeLookup(value);
  if (!normalized) return "";

  return normalized.split(/[:/|>_]+/).filter(Boolean)[0] || normalized;
}

function getTrackSectorMatchLevel(track: any, setorId?: string): 0 | 1 | 2 {
  const normalizedSetorId = normalizeLookup(setorId);
  if (!normalizedSetorId) return 0;

  const values = [
    ...normalizeTrackContextValues(track.recommendedSetorIds),
    ...normalizeTrackContextValues(track.appliesToSetorIds),
    ...normalizeTrackContextValues(track.setorIds),
    ...normalizeTrackContextValues(track.sectorIds),
    ...normalizeTrackContextValues(track.setoresAlvo),
  ];

  if (!values.length) return 0;
  if (values.includes(normalizedSetorId)) return 2;

  const family = getSectorFamily(setorId);
  if (!family) return 0;

  return values.some((value) => getSectorFamily(value) === family) ? 1 : 0;
}

function trackHasAnyExplicitContext(track: any): boolean {
  return [
    track.recommendedSetorIds,
    track.appliesToSetorIds,
    track.setorIds,
    track.sectorIds,
    track.setoresAlvo,
    track.recommendedUnidadeIds,
    track.appliesToUnidadeIds,
    track.unidadeIds,
    track.unitIds,
    track.recommendedFuncaoIds,
    track.appliesToFuncaoIds,
    track.funcaoIds,
    track.roleIds,
    track.recommendedCargoIds,
    track.appliesToCargoIds,
    track.cargoIds,
  ].some((value) => normalizeTrackContextValues(value).length > 0);
}

function trackMatchesUserContext(
  track: any,
  userProfile: UserProfileSnapshot
): boolean {
  const sectorMatchLevel = getTrackSectorMatchLevel(track, userProfile.setorId);
  if (sectorMatchLevel === 2) return true;

  const unidadeValues = [
    ...normalizeTrackContextValues(track.recommendedUnidadeIds),
    ...normalizeTrackContextValues(track.appliesToUnidadeIds),
    ...normalizeTrackContextValues(track.unidadeIds),
    ...normalizeTrackContextValues(track.unitIds),
  ];
  if (
    userProfile.unidadeId &&
    unidadeValues.includes(normalizeLookup(userProfile.unidadeId))
  ) {
    return true;
  }

  const roleValues = [
    ...normalizeTrackContextValues(track.recommendedFuncaoIds),
    ...normalizeTrackContextValues(track.appliesToFuncaoIds),
    ...normalizeTrackContextValues(track.funcaoIds),
    ...normalizeTrackContextValues(track.roleIds),
    ...normalizeTrackContextValues(track.recommendedCargoIds),
    ...normalizeTrackContextValues(track.appliesToCargoIds),
    ...normalizeTrackContextValues(track.cargoIds),
  ];

  if (
    (userProfile.funcaoFormalId &&
      roleValues.includes(normalizeLookup(userProfile.funcaoFormalId))) ||
    (userProfile.cargoId &&
      roleValues.includes(normalizeLookup(userProfile.cargoId)))
  ) {
    return true;
  }

  if (sectorMatchLevel === 1) return true;

  return !trackHasAnyExplicitContext(track);
}

function buildProfileCompetencies(params: {
  expectedProfileItems: ExpectedProfileStoredItem[];
  assessmentItems: AssessmentStoredItem[];
  catalogCompetencies: Array<{
    id: string;
    name: string;
    axis?: CompetencyAxis;
    competencyAxis?: CompetencyAxis;
  }>;
}): EnrichedProfileCompetencyInput[] {
  const { expectedProfileItems, assessmentItems, catalogCompetencies } = params;

  const assessmentMap = new Map<string, AssessmentStoredItem>();

  for (const item of assessmentItems) {
    const competencyId =
      normalizeString(item.competencyId) ||
      normalizeString(item.id) ||
      normalizeString(item.competenciaId);

    if (!competencyId) continue;
    assessmentMap.set(normalizeLookup(competencyId), item);
  }

  const catalogMap = new Map(
    catalogCompetencies.map((item) => [normalizeLookup(item.id), item])
  );

  return expectedProfileItems
    .map((expected) => {
      const competencyId =
        normalizeString(expected.competencyId) ||
        normalizeString(expected.id) ||
        normalizeString(expected.competenciaId);

      if (!competencyId) return null;

      const expectedLevel = normalizeNumber(
        expected.expectedLevel ?? expected.nivelEsperado,
        0
      );

      if (expectedLevel <= 0) return null;

      const assessment = assessmentMap.get(normalizeLookup(competencyId));
      const currentLevel = normalizeNumber(
        assessment?.currentLevel ?? assessment?.level ?? assessment?.nivelAtual,
        0
      );

      const catalogCompetency = catalogMap.get(normalizeLookup(competencyId));
      const competencyName =
        normalizeString(expected.competencyName) ||
        normalizeString(expected.nome) ||
        normalizeString(catalogCompetency?.name) ||
        competencyId;

      const competencyAxis =
        (catalogCompetency?.axis as CompetencyAxis | undefined) ||
        (catalogCompetency?.competencyAxis as CompetencyAxis | undefined) ||
        normalizeAxisCode(
          normalizeString(expected.competencyAxis) ||
            normalizeString(expected.axisCode) ||
            normalizeString(expected.axis)
        );

      const origins = [
        ...normalizeOrigins(expected.origins),
        ...normalizeOrigins(expected.origin),
      ].filter(Boolean);

      const uniqueOrigins = Array.from(new Set(origins));
      const gap = Math.max(expectedLevel - currentLevel, 0);
      const weightedPriority =
        Math.max(gap, 1) + getRoleInfluenceBonus(uniqueOrigins);

      return {
        competencyId,
        competencyName,
        competencyAxis,
        expectedLevel,
        currentLevel,
        priority: weightedPriority,
        origins: uniqueOrigins,
        weightedPriority,
      } satisfies EnrichedProfileCompetencyInput;
    })
    .filter(Boolean) as EnrichedProfileCompetencyInput[];
}

function buildFallbackProfileCompetencies(params: {
  expectedProfileItems: ExpectedProfileStoredItem[];
  assessmentItems: AssessmentStoredItem[];
  catalogCompetencies: Array<{
    id: string;
    name: string;
    axis?: CompetencyAxis;
    competencyAxis?: CompetencyAxis;
  }>;
}): EnrichedProfileCompetencyInput[] {
  const items = buildProfileCompetencies(params);

  return items
    .map((item) => {
      const safeCurrentLevel =
        item.currentLevel >= item.expectedLevel
          ? Math.max(item.expectedLevel - 1, 0)
          : item.currentLevel;

      return {
        ...item,
        currentLevel: safeCurrentLevel,
        priority: Math.max(item.priority || 0, 1),
        weightedPriority: Math.max(item.weightedPriority || 0, 1),
      };
    })
    .sort((a, b) => {
      if ((b.weightedPriority || 0) !== (a.weightedPriority || 0)) {
        return (b.weightedPriority || 0) - (a.weightedPriority || 0);
      }
      return a.competencyName.localeCompare(b.competencyName, "pt-BR");
    })
    .slice(0, 6);
}

function buildCourseUrlMap(catalog: Awaited<ReturnType<typeof loadCourseCatalog>>) {
  const map = new Map<string, string>();

  for (const course of catalog.courses as Array<Record<string, unknown>>) {
    const id = normalizeString(course.id);
    if (!id) continue;

    const url =
      normalizeString(course.url) ||
      normalizeString(course.link) ||
      normalizeString(course.courseUrl) ||
      normalizeString(course.courseLink) ||
      normalizeString(course.accessUrl) ||
      normalizeString(course.accessLink) ||
      normalizeString(course.catalogUrl) ||
      normalizeString(course.catalogLink);

    if (url) map.set(normalizeLookup(id), url);
  }

  return map;
}

function buildCatalogCourseMetaMap(
  catalog: Awaited<ReturnType<typeof loadCourseCatalog>>
): Map<string, CatalogCourseSnapshot> {
  const map = new Map<string, CatalogCourseSnapshot>();

  for (const course of catalog.courses as Array<Record<string, unknown>>) {
    const id = normalizeString(course.id);
    if (!id) continue;

    map.set(normalizeLookup(id), {
      source: normalizeString(course.source),
      provider: normalizeString(course.providerType),
      providerName: normalizeString(course.providerName),
      targetAudience: normalizeString(course.expectedOutcome),
      expectedOutcome: normalizeString(course.expectedOutcome),
    });
  }

  return map;
}

function buildCatalogCourseMap(
  catalog: Awaited<ReturnType<typeof loadCourseCatalog>>
): Map<string, CatalogCourseLike> {
  const map = new Map<string, CatalogCourseLike>();

  for (const rawCourse of catalog.courses as Array<Record<string, unknown>>) {
    const id = normalizeString(rawCourse.id);
    if (!id) continue;

    map.set(normalizeLookup(id), {
      id,
      code: normalizeString(rawCourse.code),
      title: normalizeString(rawCourse.title),
      description: normalizeString(rawCourse.description),
      modality:
        (normalizeString(
          rawCourse.modality
        ) as CatalogCourseLike["modality"]) || "ead",
      workloadHours: normalizeNumber(rawCourse.workloadHours, 0),
      difficultyLevel: normalizeNumber(rawCourse.difficultyLevel, 2) as
        | 1
        | 2
        | 3,
      url: normalizeString(rawCourse.url),
      source: normalizeString(rawCourse.source),
      provider: normalizeString(rawCourse.provider),
      providerName: normalizeString(rawCourse.providerName),
      providerType: normalizeString(rawCourse.providerType),
      active: normalizeBoolean(rawCourse.active, true),
    });
  }

  return map;
}

function buildTrackCourseIdsByTrackMap(
  catalog: Awaited<ReturnType<typeof loadCourseCatalog>>
): Map<string, string[]> {
  const grouped = new Map<
    string,
    Array<{ courseId: string; recommendedOrder: number }>
  >();

  for (const rawLink of catalog.trackCourseLinks as Array<Record<string, unknown>>) {
    const link = rawLink as unknown as TrackCourseLinkLike;
    const trackId = normalizeString(link.trackId);
    const courseId = normalizeString(link.courseId);

    if (!trackId || !courseId) continue;
    if (!normalizeBoolean(link.active, true)) continue;

    const trackKey = normalizeLookup(trackId);
    const items = grouped.get(trackKey) || [];
    items.push({
      courseId,
      recommendedOrder: normalizeNumber(link.recommendedOrder, 999),
    });
    grouped.set(trackKey, items);
  }

  const finalMap = new Map<string, string[]>();

  for (const [trackKey, items] of grouped.entries()) {
    const ordered = items
      .sort((a, b) => a.recommendedOrder - b.recommendedOrder)
      .map((item) => item.courseId);

    finalMap.set(trackKey, ordered);
  }

  return finalMap;
}

function inferCourseSource(course: CatalogCourseLike): "UNEB" | "EVG" {
  const joined = normalizeLookup(
    [
      course.source,
      course.provider,
      course.providerName,
      course.providerType,
      course.title,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (
    joined.includes("evg") ||
    joined.includes("enap") ||
    joined.includes("escola virtual do governo") ||
    joined.includes("external")
  ) {
    return "EVG";
  }

  return "UNEB";
}

function inferEngineCourseSource(course: EngineCourseLike): "UNEB" | "EVG" {
  const joined = normalizeLookup(
    [course.code, course.title, course.description].filter(Boolean).join(" ")
  );

  if (
    joined.includes("evg") ||
    joined.includes("enap") ||
    joined.includes("escola virtual do governo")
  ) {
    return "EVG";
  }

  return "UNEB";
}

function toSuggestedCourseFromCatalog(
  course: CatalogCourseLike,
  courseUrlMap: Map<string, string>
): SuggestedCourse {
  const url = courseUrlMap.get(normalizeLookup(course.id)) || course.url || null;

  return {
    id: course.id,
    title: course.title,
    description:
      course.description ||
      "Curso sugerido para apoiar o desenvolvimento da competência.",
    url,
    source: inferCourseSource(course),
    modality: mapTrackModalityToUiLabel(course.modality),
    workloadHours: Number(course.workloadHours || 0),
    difficultyLevel:
      course.difficultyLevel === 1
        ? "basico"
        : course.difficultyLevel === 3
        ? "avancado"
        : "intermediario",
  };
}

function toSuggestedCourseFromEngine(
  course: EngineCourseLike,
  courseUrlMap: Map<string, string>
): SuggestedCourse {
  const url = courseUrlMap.get(normalizeLookup(course.id)) || null;

  return {
    id: course.id,
    title: course.title,
    description:
      normalizeString(course.description) ||
      "Curso sugerido para apoiar o desenvolvimento da competência.",
    url,
    source: inferEngineCourseSource(course),
    modality: mapTrackModalityToUiLabel(course.modality),
    workloadHours: Number(course.workloadHours || 0),
    difficultyLevel: "intermediario",
  };
}

function getTrackIdentifier(recommendation: any): string {
  return (
    normalizeString(recommendation?.track?.id) ||
    normalizeString(recommendation?.track?.code) ||
    normalizeString(recommendation?.id)
  );
}

function toRecommendationItem(params: {
  recommendation: Awaited<
    ReturnType<typeof getCatalogRecommendationsFromProfiles>
  >[number];
  courseUrlMap: Map<string, string>;
  catalogCourseMap: Map<string, CatalogCourseLike>;
  trackCourseIdsByTrackMap: Map<string, string[]>;
}): RecommendationItem | null {
  const {
    recommendation,
    courseUrlMap,
    catalogCourseMap,
    trackCourseIdsByTrackMap,
  } = params;

  const priority = getPriorityFromGap(Number(recommendation.gapScore || 0));
  const trackIdentifier = getTrackIdentifier(recommendation);

  const engineSelectedCourseIds = Array.isArray(recommendation.courses)
    ? recommendation.courses
        .map((course) => normalizeString(course.id))
        .filter(Boolean)
    : [];

  const linkedCourseIdsFromTrack =
    trackCourseIdsByTrackMap.get(normalizeLookup(trackIdentifier)) || [];

  const linkedCourseIds =
    engineSelectedCourseIds.length > 0
      ? linkedCourseIdsFromTrack.filter((courseId) =>
          engineSelectedCourseIds.some(
            (selectedId) =>
              normalizeLookup(selectedId) === normalizeLookup(courseId)
          )
        )
      : linkedCourseIdsFromTrack;

  const fallbackEngineCoursesRaw: EngineCourseLike[] = Array.isArray(
    recommendation.courses
  )
    ? recommendation.courses.map((course) => ({
        id: normalizeString(course.id),
        code: normalizeString(course.code),
        title: normalizeString(course.title),
        description: normalizeString(course.description),
        modality: course.modality,
        workloadHours: normalizeNumber(course.workloadHours, 0),
        level: normalizeString(course.level),
      }))
    : [];

  const linkedCourses = linkedCourseIds
    .map((courseId) => catalogCourseMap.get(normalizeLookup(courseId)))
    .filter(
      (course): course is CatalogCourseLike =>
        !!course && normalizeBoolean(course.active, true)
    );

  const finalSuggestedCourses =
    linkedCourses.length > 0
      ? linkedCourses.map((course) =>
          toSuggestedCourseFromCatalog(course, courseUrlMap)
        )
      : fallbackEngineCoursesRaw.map((course) =>
          toSuggestedCourseFromEngine(course, courseUrlMap)
        );

  if (!finalSuggestedCourses.length) {
    return null;
  }

  const firstCourse = finalSuggestedCourses[0];

  const computedWorkload = finalSuggestedCourses.reduce(
    (sum, course) => sum + Number(course.workloadHours || 0),
    0
  );

  const estimatedWorkloadHours =
    computedWorkload > 0
      ? computedWorkload
      : Number(recommendation.totalWorkloadHours || 0);

  const item: RecommendationItem = {
    recommendationId: recommendation.id,
    type: "TRILHA",
    title:
      recommendation.track.title ||
      `Percurso para desenvolver ${recommendation.competencyName}`,
    description:
      recommendation.track.description ||
      `Percurso sugerido para desenvolver ${recommendation.competencyName}.`,
    linkedCompetencyId: recommendation.competencyId,
    linkedCompetencyName: recommendation.competencyName,
    axisCode: recommendation.competencyAxis,
    axisName: axisNameFromCode(recommendation.competencyAxis),
    priority,
    reason: `Essa trilha foi sugerida para ajudar você a desenvolver ${recommendation.competencyName} de forma prática no seu dia a dia.`,
    estimatedWorkloadHours,
    modality: mapTrackModalityToUiLabel(
      recommendation.track.preferredModality || firstCourse?.modality
    ),
    suggestedCourses: finalSuggestedCourses,
    microlearningActions: buildMicrolearningActions(
      recommendation.competencyName
    ),
    progressStatus: "NAO_INICIADO",
    progressPercent: 0,
    completedCoursesCount: 0,
    totalCoursesCount: finalSuggestedCourses.length,
    hasRelatedEvidenceOutsideTrail: false,
  };

  if ("isFallback" in recommendation) {
    (item as RecommendationItem & { isFallback?: boolean }).isFallback = Boolean(
      (recommendation as { isFallback?: boolean }).isFallback
    );
  }

  if ("fallbackType" in recommendation) {
    (
      item as RecommendationItem & { fallbackType?: string | null }
    ).fallbackType =
      (recommendation as { fallbackType?: string | null }).fallbackType ?? null;
  }

  return item;
}

export async function generateRecommendationItemsForUser(
  db: Firestore,
  userId: string
): Promise<RecommendationItem[]> {
  const [catalog, userProfile, expectedProfileItems, assessmentItems] =
    await Promise.all([
      loadCourseCatalog(db),
      loadUserProfile(db, userId),
      loadExpectedProfileItems(db, userId),
      loadAssessmentItems(db, userId),
    ]);

  let profileCompetencies = buildProfileCompetencies({
    expectedProfileItems,
    assessmentItems,
    catalogCompetencies: catalog.competencies,
  });

  if (!profileCompetencies.length) {
    profileCompetencies = buildFallbackProfileCompetencies({
      expectedProfileItems,
      assessmentItems,
      catalogCompetencies: catalog.competencies,
    });
  } else {
    const hasRealGap = profileCompetencies.some(
      (item) => item.expectedLevel > item.currentLevel
    );

    if (!hasRealGap) {
      profileCompetencies = buildFallbackProfileCompetencies({
        expectedProfileItems,
        assessmentItems,
        catalogCompetencies: catalog.competencies,
      });
    }
  }

  if (!profileCompetencies.length) {
    return [];
  }

  const recommendations = await getCatalogRecommendationsFromProfiles(
    db,
    profileCompetencies,
    {
      maxTracksPerGap: 6,
      maxFinalRecommendations: MAX_FINAL_TRACKS,
      preferredModality: "EAD",
      activeOnly: true,
      dedupeByTrack: true,
      sortBy: "score",
      maxEVGCoursesPerRecommendation: 0,
      setorId: userProfile.setorId,
      unidadeId: userProfile.unidadeId,
      funcaoId: userProfile.funcaoFormalId,
      cargoId: userProfile.cargoId,
      publicoAlvo: userProfile.publicoAlvo,
      contextoTexto: [
        userProfile.setorNome,
        userProfile.unidadeNome,
        userProfile.funcaoFormalNome,
        userProfile.cargoNome,
        userProfile.publicoAlvo,
      ]
        .filter(Boolean)
        .join(" | "),
    }
  );

  const courseUrlMap = buildCourseUrlMap(catalog);
  const catalogCourseMap = buildCatalogCourseMap(catalog);
  const trackCourseIdsByTrackMap = buildTrackCourseIdsByTrackMap(catalog);
  buildCatalogCourseMetaMap(catalog);

  const items = recommendations
    .map((recommendation) =>
      toRecommendationItem({
        recommendation,
        courseUrlMap,
        catalogCourseMap,
        trackCourseIdsByTrackMap,
      })
    )
    .filter(Boolean) as RecommendationItem[];

  const usedFirstCourseIds = new Set<string>();

  const reorderedItems = items.map((item) => {
    if (
      !Array.isArray(item.suggestedCourses) ||
      item.suggestedCourses.length <= 1
    ) {
      const firstId = normalizeLookup(item.suggestedCourses?.[0]?.id);
      if (firstId) usedFirstCourseIds.add(firstId);
      return item;
    }

    const courses = [...item.suggestedCourses];
    const uniqueIndex = courses.findIndex((course) => {
      const courseId = normalizeLookup(course.id);
      return courseId && !usedFirstCourseIds.has(courseId);
    });

    if (uniqueIndex > 0) {
      const [selected] = courses.splice(uniqueIndex, 1);
      courses.unshift(selected);
    }

    const firstId = normalizeLookup(courses[0]?.id);
    if (firstId) usedFirstCourseIds.add(firstId);

    return {
      ...item,
      suggestedCourses: courses,
      estimatedWorkloadHours: courses.reduce(
        (sum, course) => sum + Number(course.workloadHours || 0),
        0
      ) || item.estimatedWorkloadHours,
    };
  });

  // 🔧 FALLBACK ESTÁVEL PARA O GABINETE DA DIREÇÃO
  if (
    reorderedItems.length === 0 &&
    normalizeLookup(userProfile.setorId) === "dtcs_juazeiro_gabinete_direcao"
  ) {
    console.log("⚠️ FALLBACK ATIVADO: gabinete da direção");

    return [
      {
        recommendationId: "fallback_comunicacao",
        type: "TRILHA",
        title: "Comunicação institucional no ambiente de trabalho",
        description:
          "Trilha sugerida para fortalecer a comunicação institucional no contexto administrativo do gabinete da direção.",
        linkedCompetencyId: "comunicacao_institucional",
        linkedCompetencyName: "Comunicação institucional",
        axisCode: "E1",
        axisName: axisNameFromCode("E1"),
        priority: "MÉDIA",
        reason:
          "Esta trilha foi sugerida como percurso base para fortalecer a comunicação institucional, a redação administrativa e a organização das informações no gabinete da direção.",
        estimatedWorkloadHours: 60,
        modality: "ead",
        suggestedCourses: [
          {
            id: "fallback_gabinete_com_001",
            title: "Comunicação no serviço público",
            description:
              "Curso introdutório sobre comunicação institucional e práticas de comunicação no contexto administrativo.",
            url: null,
            source: "UNEB",
            modality: "ead",
            workloadHours: 20,
            difficultyLevel: "intermediario",
          },
          {
            id: "fallback_gabinete_com_002",
            title: "Redação oficial e comunicação administrativa",
            description:
              "Curso voltado à produção de documentos, mensagens e comunicações administrativas com clareza e padronização.",
            url: null,
            source: "UNEB",
            modality: "ead",
            workloadHours: 20,
            difficultyLevel: "intermediario",
          },
          {
            id: "fallback_gabinete_com_003",
            title: "Organização da informação institucional",
            description:
              "Curso voltado ao tratamento, registro e organização das informações utilizadas nas rotinas administrativas.",
            url: null,
            source: "UNEB",
            modality: "ead",
            workloadHours: 20,
            difficultyLevel: "intermediario",
          },
        ],
        microlearningActions: buildMicrolearningActions(
          "Comunicação institucional"
        ),
        progressStatus: "NAO_INICIADO",
        progressPercent: 0,
        completedCoursesCount: 0,
        totalCoursesCount: 3,
        hasRelatedEvidenceOutsideTrail: false,
      },
      {
        recommendationId: "fallback_sistemas",
        type: "TRILHA",
        title: "Sistemas acadêmicos e administrativos",
        description:
          "Trilha sugerida para apoiar o uso de sistemas institucionais acadêmicos e administrativos no gabinete da direção.",
        linkedCompetencyId: "gestao_sistemas",
        linkedCompetencyName: "Gestão de sistemas",
        axisCode: "E4",
        axisName: axisNameFromCode("E4"),
        priority: "MÉDIA",
        reason:
          "Esta trilha foi sugerida para apoiar o uso de sistemas institucionais que fazem parte das rotinas administrativas e acadêmicas da unidade.",
        estimatedWorkloadHours: 80,
        modality: "ead",
        suggestedCourses: [
          {
            id: "fallback_gabinete_sis_001",
            title: "Sistema Eletrônico de Informações - SEI",
            description:
              "Curso introdutório sobre uso do SEI nas rotinas administrativas e documentais.",
            url: null,
            source: "UNEB",
            modality: "ead",
            workloadHours: 30,
            difficultyLevel: "intermediario",
          },
          {
            id: "fallback_gabinete_sis_002",
            title: "Sistema acadêmico SAGRES",
            description:
              "Curso voltado ao uso do sistema acadêmico SAGRES em atividades de apoio e acompanhamento acadêmico.",
            url: null,
            source: "UNEB",
            modality: "ead",
            workloadHours: 20,
            difficultyLevel: "intermediario",
          },
          {
            id: "fallback_gabinete_sis_003",
            title: "Sistema Integrado de Gerenciamento de Cursos - SIGC",
            description:
              "Curso voltado ao uso do SIGC no gerenciamento e acompanhamento de cursos institucionais.",
            url: null,
            source: "UNEB",
            modality: "ead",
            workloadHours: 30,
            difficultyLevel: "intermediario",
          },
        ],
        microlearningActions: buildMicrolearningActions("Gestão de sistemas"),
        progressStatus: "NAO_INICIADO",
        progressPercent: 0,
        completedCoursesCount: 0,
        totalCoursesCount: 3,
        hasRelatedEvidenceOutsideTrail: false,
      },
    ];
  }

  const priorityWeight: Record<Priority, number> = {
    ALTA: 3,
    MÉDIA: 2,
    BAIXA: 1,
  };

  const dedupedByCompetency = (() => {
    const usedCompetencyIds = new Set<string>();
    const finalItems: RecommendationItem[] = [];

    const sorted = [...reorderedItems].sort((a, b) => {
      const priorityDiff =
        (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);

      if (priorityDiff !== 0) return priorityDiff;

      const workloadDiff =
        Number(b.estimatedWorkloadHours || 0) -
        Number(a.estimatedWorkloadHours || 0);

      if (workloadDiff !== 0) return workloadDiff;

      const coursesDiff =
        Number(b.totalCoursesCount || 0) - Number(a.totalCoursesCount || 0);

      if (coursesDiff !== 0) return coursesDiff;

      return a.title.localeCompare(b.title, "pt-BR");
    });

    for (const item of sorted) {
      const competencyId = normalizeLookup(item.linkedCompetencyId);
      if (competencyId && usedCompetencyIds.has(competencyId)) continue;

      if (competencyId) usedCompetencyIds.add(competencyId);
      finalItems.push(item);

      if (finalItems.length >= MAX_FINAL_TRACKS) break;
    }

    return finalItems;
  })();

  return dedupedByCompetency.slice(0, MAX_FINAL_TRACKS);
}

export async function generateUserRecommendations(
  db: Firestore,
  userId: string
): Promise<RecommendationServiceResponse> {
  const [catalog, userProfile, expectedProfileItems, assessmentItems, completed] =
    await Promise.all([
      loadCourseCatalog(db),
      loadUserProfile(db, userId),
      loadExpectedProfileItems(db, userId),
      loadAssessmentItems(db, userId),
      loadCompletedCourses(db, userId),
    ]);

  const profileCompetencies = buildProfileCompetencies({
    expectedProfileItems,
    assessmentItems,
    catalogCompetencies: catalog.competencies,
  });

  const recommendations = await generateRecommendationItemsForUser(db, userId);

  const competencyDiagnostics = profileCompetencies.map((item) => {
    const hasTrack = catalog.learningTracks.some((track: any) => {
      const mainCompetencyId =
        normalizeLookup(track.mainCompetencyId) ||
        normalizeLookup(track.competenciaPrincipal);
      const relatedCompetencies = Array.isArray(track.relatedCompetencyIds)
        ? track.relatedCompetencyIds
        : Array.isArray(track.competenciasSecundarias)
        ? track.competenciasSecundarias
        : [];

      const sameCompetency =
        mainCompetencyId === normalizeLookup(item.competencyId) ||
        relatedCompetencies.some(
          (relatedId: unknown) =>
            normalizeLookup(relatedId) === normalizeLookup(item.competencyId)
        );

      if (!sameCompetency) return false;

      return trackMatchesUserContext(track, userProfile);
    });

    return {
      competencyId: item.competencyId,
      competencyName: item.competencyName,
      competencyAxis: item.competencyAxis,
      currentLevel: item.currentLevel,
      expectedLevel: item.expectedLevel,
      gap: Math.max(item.expectedLevel - item.currentLevel, 0),
      weightedPriority: item.weightedPriority,
      origins: item.origins || [],
      hasTrack,
    };
  });

  return {
    recommendations,
    debug: {
      userId,
      userProfile,
      userDataCounts: {
        expectedCompetencies: expectedProfileItems.length,
        assessments: assessmentItems.length,
        completedCourses: completed.length,
      },
      catalogCounts: {
        competencies: catalog.competencies.length,
        learningTracks: catalog.learningTracks.length,
        trackStages: catalog.trackStages.length,
        courses: catalog.courses.length,
        trackCourseLinks: catalog.trackCourseLinks.length,
      },
      competencyDiagnostics,
    },
  };
}