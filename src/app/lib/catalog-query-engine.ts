
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  documentId,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";

export type CompetencyAxis = "E1" | "E2" | "E3" | "E4" | "E5";
export type TrackLevel = "inicial" | "intermediario" | "avancado";
export type CourseModality = "EAD" | "PRESENCIAL" | "HIBRIDO";

export interface AuditFields {
  slug?: string;
  version?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
  searchTokens?: string[];
  importedAt?: unknown;
}

export interface LearningTrack extends AuditFields {
  id: string;
  code: string;
  title: string;
  description: string;
  competencyAxis: CompetencyAxis;
  targetAudience: string;
  preferredModality: CourseModality;
  levels: TrackLevel[];
  active: boolean;
  sortOrder: number;
}

export interface TrackStage extends AuditFields {
  id: string;
  trackId: string;
  level: TrackLevel;
  title: string;
  description: string;
  recommendedTotalHours: number;
  sortOrder: number;
  active: boolean;
}

export interface Course extends AuditFields {
  id: string;
  code: string;
  title: string;
  description: string;
  competencyAxis: CompetencyAxis;
  modality: CourseModality;
  workloadHours: number;
  level: TrackLevel;
  active: boolean;
  sortOrder: number;
}

export interface TrackCourseLink extends AuditFields {
  id: string;
  trackId: string;
  stageId: string;
  courseId: string;
  order: number;
  required: boolean;
  active: boolean;
}

export interface GapInput {
  competencyId: string;
  competencyName: string;
  competencyAxis: CompetencyAxis;
  expectedLevel?: number;
  currentLevel?: number;
  gapScore?: number;
  priority?: number;
}

export interface StageWithCourses extends TrackStage {
  courses: Course[];
}

export interface TrackWithStagesAndCourses extends LearningTrack {
  stages: StageWithCourses[];
}

export interface RecommendationItem {
  track: LearningTrack;
  stage: TrackStage;
  courses: Course[];
  matchScore: number;
  rationale: string;
  gap: GapInput;
}

export interface BuildRecommendationsOptions {
  maxTracksPerGap?: number;
  preferredLevel?: TrackLevel;
  preferredModality?: CourseModality;
  activeOnly?: boolean;
}

type FirestoreRecord = Record<string, unknown>;

type RawTrilha = {
  id: string;
  nome?: string;
  title?: string;
  descricao?: string;
  description?: string;
  competenciaPrincipal?: string;
  mainCompetencyId?: string;
  competenciasSecundarias?: unknown[];
  relatedCompetencyIds?: unknown[];
  nivel?: string;
  level?: string;
  ativo?: boolean;
  active?: boolean;
  ordem?: number;
  sortOrder?: number;
  modalidadePreferencial?: string;
  preferredModality?: string;
  publicoAlvo?: string;
  targetAudience?: string;
};

type RawTrilhaCurso = {
  id: string;
  trilhaId?: string;
  trackId?: string;
  cursoId?: string;
  courseId?: string;
  ordem?: number;
  order?: number;
  obrigatorio?: boolean;
  required?: boolean;
  ativo?: boolean;
  active?: boolean;
};

type RawCurso = {
  id: string;
  codigo?: string;
  code?: string;
  nome?: string;
  title?: string;
  descricao?: string;
  description?: string;
  eixo?: string;
  competencyAxis?: string;
  modalidade?: string;
  modality?: string;
  cargaHoraria?: number;
  workloadHours?: number;
  nivel?: string;
  level?: string;
  ativo?: boolean;
  active?: boolean;
  ordem?: number;
  sortOrder?: number;
  fonte?: string;
  source?: string;
  provider?: string;
  institution?: string;
  url?: string;
  link?: string;
};

function preserveString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function normalizeLookup(value: unknown): string {
  return preserveString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
}

function normalizeCompact(value: unknown): string {
  return preserveString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function normalizeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(normalized)) return true;
    if (["false", "0", "nao", "não", "no"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const raw = preserveString(value);
    if (!raw) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    result.push(raw);
  }

  return result;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function bySortOrder<T extends { sortOrder?: number; title?: string }>(a: T, b: T) {
  const orderA = a.sortOrder ?? 999999;
  const orderB = b.sortOrder ?? 999999;
  if (orderA !== orderB) return orderA - orderB;
  return (a.title ?? "").localeCompare(b.title ?? "", "pt-BR");
}

function normalizeTrackLevel(value: unknown, fallback: TrackLevel = "intermediario"): TrackLevel {
  const normalized = normalizeLookup(value);

  if (normalized.includes("inic")) return "inicial";
  if (normalized.includes("inter")) return "intermediario";
  if (normalized.includes("avanc")) return "avancado";

  return fallback;
}

function normalizeCourseModality(value: unknown, fallback: CourseModality = "EAD"): CourseModality {
  const normalized = normalizeLookup(value);

  if (normalized.includes("presencial")) return "PRESENCIAL";
  if (normalized.includes("hibrid")) return "HIBRIDO";
  if (normalized.includes("ead")) return "EAD";

  return fallback;
}

function normalizeAxis(value: unknown, fallback: CompetencyAxis = "E4"): CompetencyAxis {
  const raw = preserveString(value);
  const upper = raw.toUpperCase();

  if (upper === "E1" || upper === "E2" || upper === "E3" || upper === "E4" || upper === "E5") {
    return upper as CompetencyAxis;
  }

  const normalized = normalizeLookup(value);

  if (normalized.includes("comunic")) return "E1";
  if (normalized.includes("equipe") || normalized.includes("interpessoal")) return "E2";
  if (normalized.includes("etica") || normalized.includes("respons")) return "E3";
  if (normalized.includes("inov") || normalized.includes("process")) return "E4";
  if (normalized.includes("planej") || normalized.includes("gest")) return "E5";

  return fallback;
}

function normalizeLevelFromGap(gap: GapInput): TrackLevel {
  if (typeof gap.gapScore === "number") {
    if (gap.gapScore >= 2) return "inicial";
    if (gap.gapScore >= 1) return "intermediario";
    return "avancado";
  }

  if (
    typeof gap.expectedLevel === "number" &&
    typeof gap.currentLevel === "number"
  ) {
    const diff = gap.expectedLevel - gap.currentLevel;
    if (diff >= 2) return "inicial";
    if (diff === 1) return "intermediario";
  }

  return "intermediario";
}

function matchesCompetency(trilha: RawTrilha, gap: GapInput): boolean {
  const gapCandidates = new Set(
    [
      gap.competencyId,
      gap.competencyName,
      normalizeLookup(gap.competencyId),
      normalizeLookup(gap.competencyName),
      normalizeCompact(gap.competencyId),
      normalizeCompact(gap.competencyName),
    ].filter(Boolean)
  );

  const primaryCandidates = [
    trilha.competenciaPrincipal,
    trilha.mainCompetencyId,
  ];

  for (const value of primaryCandidates) {
    const raw = preserveString(value);
    if (!raw) continue;

    if (
      gapCandidates.has(raw) ||
      gapCandidates.has(normalizeLookup(raw)) ||
      gapCandidates.has(normalizeCompact(raw))
    ) {
      return true;
    }
  }

  const secondary = [
    ...(Array.isArray(trilha.competenciasSecundarias)
      ? trilha.competenciasSecundarias
      : []),
    ...(Array.isArray(trilha.relatedCompetencyIds)
      ? trilha.relatedCompetencyIds
      : []),
  ];

  return secondary.some((value) => {
    const raw = preserveString(value);
    if (!raw) return false;

    return (
      gapCandidates.has(raw) ||
      gapCandidates.has(normalizeLookup(raw)) ||
      gapCandidates.has(normalizeCompact(raw))
    );
  });
}

function buildTrackMatchScore(
  track: LearningTrack,
  stage: TrackStage,
  courses: Course[],
  gap: GapInput,
  preferredModality?: CourseModality
): number {
  let score = 0;

  if (track.competencyAxis === gap.competencyAxis) score += 20;
  if (stage.level === normalizeLevelFromGap(gap)) score += 25;
  if (preferredModality && track.preferredModality === preferredModality) score += 8;

  const totalHours = courses.reduce((sum, course) => sum + (course.workloadHours || 0), 0);
  if (totalHours >= 20 && totalHours <= 80) score += 10;
  else if (totalHours > 0) score += 5;

  const eadCourses = courses.filter((course) => course.modality === "EAD").length;
  score += eadCourses * 1.5;

  score += Math.max(0, 10 - (track.sortOrder ?? 10));

  return Number(score.toFixed(2));
}

function buildRationale(
  track: LearningTrack,
  stage: TrackStage,
  courses: Course[],
  gap: GapInput
): string {
  const totalHours = courses.reduce((sum, course) => sum + (course.workloadHours || 0), 0);

  return `A trilha "${track.title}" foi selecionada por estar ligada diretamente à competência "${gap.competencyName}", com nível ${stage.level} compatível com a lacuna identificada. Ela reúne ${courses.length} curso(s), com carga horária total de ${totalHours}h.`;
}

async function fetchCollection<T>(
  db: Firestore,
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<T[]> {
  const ref = collection(db, collectionName);
  const snapshot = await getDocs(query(ref, ...constraints));
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as T));
}

async function fetchByIds<T>(
  db: Firestore,
  collectionName: string,
  ids: string[]
): Promise<T[]> {
  const uniqueIds = uniqueStrings(ids);

  if (!uniqueIds.length) return [];

  const chunks = chunkArray(uniqueIds, 30);
  const results: T[] = [];

  for (const group of chunks) {
    const snapshot = await getDocs(
      query(collection(db, collectionName), where(documentId(), "in", group))
    );

    results.push(
      ...snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as T))
    );
  }

  return results;
}

function mapRawCourse(raw: RawCurso, fallbackAxis: CompetencyAxis, fallbackLevel: TrackLevel): Course {
  return {
    id: raw.id,
    code: preserveString(raw.codigo || raw.code || raw.id),
    title: preserveString(raw.nome || raw.title || raw.id),
    description: preserveString(raw.descricao || raw.description),
    competencyAxis: normalizeAxis(raw.eixo || raw.competencyAxis, fallbackAxis),
    modality: normalizeCourseModality(raw.modalidade || raw.modality, "EAD"),
    workloadHours: normalizeNumber(raw.cargaHoraria || raw.workloadHours),
    level: normalizeTrackLevel(raw.nivel || raw.level, fallbackLevel),
    active: normalizeBoolean(raw.ativo ?? raw.active, true),
    sortOrder: normalizeNumber(raw.ordem ?? raw.sortOrder),
  };
}

function buildSyntheticStage(
  track: LearningTrack,
  courses: Course[],
  preferredLevel?: TrackLevel
): TrackStage {
  const level = preferredLevel || track.levels[0] || "intermediario";
  const recommendedTotalHours = courses.reduce(
    (sum, course) => sum + (course.workloadHours || 0),
    0
  );

  return {
    id: `${track.id}__stage__${level}`,
    trackId: track.id,
    level,
    title: `Etapa ${level}`,
    description: `Etapa recomendada da trilha ${track.title}.`,
    recommendedTotalHours,
    sortOrder: 1,
    active: true,
  };
}

function normalizeRawTrack(raw: RawTrilha, gap: GapInput): LearningTrack {
  const level = normalizeTrackLevel(raw.nivel || raw.level, normalizeLevelFromGap(gap));

  return {
    id: raw.id,
    code: preserveString(raw.id),
    title: preserveString(raw.nome || raw.title || raw.id),
    description: preserveString(raw.descricao || raw.description),
    competencyAxis: gap.competencyAxis,
    targetAudience: preserveString(raw.publicoAlvo || raw.targetAudience),
    preferredModality: normalizeCourseModality(
      raw.modalidadePreferencial || raw.preferredModality,
      "EAD"
    ),
    levels: [level],
    active: normalizeBoolean(raw.ativo ?? raw.active, true),
    sortOrder: normalizeNumber(raw.ordem ?? raw.sortOrder),
  };
}

export async function getLearningTracksByAxis(
  db: Firestore,
  competencyAxis: CompetencyAxis,
  activeOnly = true
): Promise<LearningTrack[]> {
  const constraints: QueryConstraint[] = [];
  if (activeOnly) constraints.push(where("ativo", "==", true));

  const trilhas = await fetchCollection<RawTrilha>(db, "trilhas", constraints);
  const mapped = trilhas.map((raw) =>
    normalizeRawTrack({ ...raw, id: raw.id }, {
      competencyId: "",
      competencyName: "",
      competencyAxis,
    })
  );

  return mapped
    .filter((item) => item.competencyAxis === competencyAxis)
    .sort(bySortOrder);
}

export async function getCoursesByLevel(
  db: Firestore,
  level: TrackLevel,
  activeOnly = true
): Promise<Course[]> {
  const cursos = await fetchCollection<RawCurso>(db, "cursos");
  return cursos
    .map((raw) => mapRawCourse(raw, "E4", level))
    .filter((course) => (activeOnly ? course.active : true) && course.level === level)
    .sort(bySortOrder);
}

export async function getStagesByTrackId(
  db: Firestore,
  trackId: string,
  activeOnly = true
): Promise<TrackStage[]> {
  const trackWithCourses = await getTrackWithStagesAndCourses(db, trackId, activeOnly);
  if (!trackWithCourses) return [];
  return trackWithCourses.stages;
}

export async function getTrackCourseLinksByTrackId(
  db: Firestore,
  trackId: string,
  activeOnly = true
): Promise<TrackCourseLink[]> {
  const constraints: QueryConstraint[] = [
    where("trilhaId", "==", trackId),
  ];

  let links: RawTrilhaCurso[] = [];
  try {
    links = await fetchCollection<RawTrilhaCurso>(db, "trilha_cursos", constraints);
  } catch {
    const all = await fetchCollection<RawTrilhaCurso>(db, "trilha_cursos");
    links = all.filter((item) => preserveString(item.trilhaId || item.trackId) === trackId);
  }

  return links
    .map((raw) => ({
      id: raw.id,
      trackId: preserveString(raw.trilhaId || raw.trackId),
      stageId: `${preserveString(raw.trilhaId || raw.trackId)}__stage__default`,
      courseId: preserveString(raw.cursoId || raw.courseId),
      order: normalizeNumber(raw.ordem ?? raw.order),
      required: normalizeBoolean(raw.obrigatorio ?? raw.required, false),
      active: normalizeBoolean(raw.ativo ?? raw.active, true),
    }))
    .filter((link) => (activeOnly ? link.active : true))
    .sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
}

export async function getTrackWithStagesAndCourses(
  db: Firestore,
  trackId: string,
  activeOnly = true
): Promise<TrackWithStagesAndCourses | null> {
  const [rawTrack] = await fetchByIds<RawTrilha>(db, "trilhas", [trackId]);

  if (!rawTrack) return null;

  const baseTrack = normalizeRawTrack(rawTrack, {
    competencyId: preserveString(rawTrack.competenciaPrincipal || rawTrack.mainCompetencyId),
    competencyName: preserveString(rawTrack.competenciaPrincipal || rawTrack.mainCompetencyId),
    competencyAxis: "E4",
  });

  if (activeOnly && !baseTrack.active) return null;

  const links = await getTrackCourseLinksByTrackId(db, trackId, activeOnly);
  const courseIds = links.map((link) => link.courseId).filter(Boolean);
  const rawCourses = await fetchByIds<RawCurso>(db, "cursos", courseIds);

  const courseMap = new Map(
    rawCourses.map((raw) => [
      raw.id,
      mapRawCourse(raw, baseTrack.competencyAxis, baseTrack.levels[0] || "intermediario"),
    ])
  );

  const orderedCourses = links
    .map((link) => courseMap.get(link.courseId))
    .filter(Boolean) as Course[];

  const stage = buildSyntheticStage(baseTrack, orderedCourses, baseTrack.levels[0]);
  const stages: StageWithCourses[] = [
    {
      ...stage,
      courses: orderedCourses.sort(bySortOrder),
    },
  ];

  return {
    ...baseTrack,
    stages,
  };
}

export async function getTracksByAxisWithStagesAndCourses(
  db: Firestore,
  competencyAxis: CompetencyAxis,
  activeOnly = true
): Promise<TrackWithStagesAndCourses[]> {
  const trilhas = await fetchCollection<RawTrilha>(db, "trilhas");
  const filtered = trilhas
    .map((raw) => normalizeRawTrack(raw, {
      competencyId: "",
      competencyName: "",
      competencyAxis,
    }))
    .filter((track) => (activeOnly ? track.active : true) && track.competencyAxis === competencyAxis);

  const result = await Promise.all(
    filtered.map((track) => getTrackWithStagesAndCourses(db, track.id, activeOnly))
  );

  return result.filter(Boolean) as TrackWithStagesAndCourses[];
}

export async function buildRecommendationsFromGaps(
  db: Firestore,
  gaps: GapInput[],
  options: BuildRecommendationsOptions = {}
): Promise<RecommendationItem[]> {
  const {
    maxTracksPerGap = 2,
    preferredLevel,
    preferredModality = "EAD",
    activeOnly = true,
  } = options;

  if (!gaps.length) return [];

  const rawTracks = await fetchCollection<RawTrilha>(db, "trilhas");
  const recommendations: RecommendationItem[] = [];

  for (const gap of gaps) {
    const matchingRawTracks = rawTracks.filter((raw) => {
      const active = normalizeBoolean(raw.ativo ?? raw.active, true);
      return (!activeOnly || active) && matchesCompetency(raw, gap);
    });

    const rankedItems = await Promise.all(
      matchingRawTracks.map(async (rawTrack) => {
        const track = normalizeRawTrack(rawTrack, gap);
        const links = await getTrackCourseLinksByTrackId(db, track.id, activeOnly);
        const rawCourses = await fetchByIds<RawCurso>(
          db,
          "cursos",
          links.map((link) => link.courseId).filter(Boolean)
        );

        const courseMap = new Map(
          rawCourses.map((rawCourse) => [
            rawCourse.id,
            mapRawCourse(rawCourse, gap.competencyAxis, preferredLevel || track.levels[0] || normalizeLevelFromGap(gap)),
          ])
        );

        const orderedCourses = links
          .map((link) => courseMap.get(link.courseId))
          .filter(Boolean) as Course[];

        const selectedStage = buildSyntheticStage(
          {
            ...track,
            competencyAxis: gap.competencyAxis,
          },
          orderedCourses,
          preferredLevel || track.levels[0] || normalizeLevelFromGap(gap)
        );

        const matchScore = buildTrackMatchScore(
          {
            ...track,
            competencyAxis: gap.competencyAxis,
          },
          selectedStage,
          orderedCourses,
          gap,
          preferredModality
        );

        return {
          track: {
            ...track,
            competencyAxis: gap.competencyAxis,
          },
          stage: selectedStage,
          courses: orderedCourses,
          matchScore,
          rationale: buildRationale(track, selectedStage, orderedCourses, gap),
          gap,
        } satisfies RecommendationItem;
      })
    );

    const filteredRanked = rankedItems
      .filter((item) => item.courses.length > 0)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        if ((a.track.sortOrder ?? 999999) !== (b.track.sortOrder ?? 999999)) {
          return (a.track.sortOrder ?? 999999) - (b.track.sortOrder ?? 999999);
        }
        return a.track.title.localeCompare(b.track.title, "pt-BR");
      })
      .slice(0, maxTracksPerGap);

    recommendations.push(...filteredRanked);
  }

  return recommendations;
}

export function filterRecommendationsByLevel(
  recommendations: RecommendationItem[],
  level: TrackLevel
): RecommendationItem[] {
  return recommendations.filter((item) => item.stage.level === level);
}

export function filterRecommendationsByAxis(
  recommendations: RecommendationItem[],
  axis: CompetencyAxis
): RecommendationItem[] {
  return recommendations.filter((item) => item.track.competencyAxis === axis);
}

export function dedupeRecommendationsByTrack(
  recommendations: RecommendationItem[]
): RecommendationItem[] {
  const map = new Map<string, RecommendationItem>();

  for (const item of recommendations) {
    const existing = map.get(item.track.id);
    if (!existing || item.matchScore > existing.matchScore) {
      map.set(item.track.id, item);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.matchScore - a.matchScore);
}
