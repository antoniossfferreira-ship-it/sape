import {
  Firestore,
  collection,
  documentId,
  getDocs,
  query,
  where,
  QueryConstraint,
} from 'firebase/firestore';

export type CompetencyAxis = 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
export type TrackLevel = 'inicial' | 'intermediario' | 'avancado';
export type CourseModality = 'EAD' | 'PRESENCIAL' | 'HIBRIDO';

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
  mainCompetencyId?: string;
  relatedCompetencyIds?: string[];
  recommendedSetorIds?: string[];
  recommendedUnidadeIds?: string[];
  recommendedFuncaoIds?: string[];
  recommendedCargoIds?: string[];
  tipo?: string;
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

function normalizeString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  return '';
}

function normalizeLookup(value: unknown): string {
  return normalizeString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s:-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function axisFromRaw(raw: unknown): CompetencyAxis {
  const value = normalizeString(raw).toUpperCase();
  if (value === 'E1') return 'E1';
  if (value === 'E2') return 'E2';
  if (value === 'E3') return 'E3';
  if (value === 'E4') return 'E4';
  if (value === 'E5') return 'E5';

  const normalized = normalizeLookup(raw);
  if (normalized.includes('comunic')) return 'E1';
  if (normalized.includes('equipe') || normalized.includes('interpessoal')) return 'E2';
  if (normalized.includes('etica') || normalized.includes('respons')) return 'E3';
  if (normalized.includes('inov') || normalized.includes('process')) return 'E4';
  if (normalized.includes('planej') || normalized.includes('gest')) return 'E5';
  return 'E4';
}

function modalityFromRaw(raw: unknown): CourseModality {
  const value = normalizeLookup(raw);
  if (value.includes('presencial')) return 'PRESENCIAL';
  if (value.includes('hibrid')) return 'HIBRIDO';
  return 'EAD';
}

function levelFromRaw(raw: unknown): TrackLevel {
  const value = normalizeLookup(raw);
  if (value.includes('avanc')) return 'avancado';
  if (value.includes('inici') || value.includes('basic')) return 'inicial';
  return 'intermediario';
}

function bySortOrder<T extends { sortOrder?: number; title?: string }>(a: T, b: T) {
  const orderA = a.sortOrder ?? 999999;
  const orderB = b.sortOrder ?? 999999;
  if (orderA !== orderB) return orderA - orderB;
  return (a.title ?? '').localeCompare(b.title ?? '', 'pt-BR');
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
}

function normalizeLevelFromGap(gap: GapInput): TrackLevel {
  if (typeof gap.gapScore === 'number') {
    if (gap.gapScore >= 2) return 'inicial';
    if (gap.gapScore >= 1) return 'intermediario';
    return 'avancado';
  }

  if (typeof gap.expectedLevel === 'number' && typeof gap.currentLevel === 'number') {
    const diff = gap.expectedLevel - gap.currentLevel;
    if (diff >= 2) return 'inicial';
    if (diff === 1) return 'intermediario';
  }

  return 'intermediario';
}

function buildTrackMatchScore(
  track: LearningTrack,
  stage: TrackStage,
  courses: Course[],
  gap: GapInput,
  preferredModality?: CourseModality
): number {
  let score = 0;

  const sameMain = normalizeLookup(track.mainCompetencyId) === normalizeLookup(gap.competencyId);
  const sameRelated = (track.relatedCompetencyIds || []).some(
    (id) => normalizeLookup(id) === normalizeLookup(gap.competencyId)
  );

  if (sameMain) score += 60;
  else if (sameRelated) score += 35;

  if (track.competencyAxis === gap.competencyAxis) score += 20;
  if (stage.level === normalizeLevelFromGap(gap)) score += 15;
  if (preferredModality && track.preferredModality === preferredModality) score += 8;

  const totalHours = courses.reduce((sum, course) => sum + course.workloadHours, 0);
  if (totalHours >= 20 && totalHours <= 60) score += 8;
  else if (totalHours > 0) score += 4;

  score += Math.max(0, 10 - (track.sortOrder ?? 10));

  return score;
}

function buildRationale(track: LearningTrack, stage: TrackStage, courses: Course[], gap: GapInput): string {
  const totalHours = courses.reduce((sum, course) => sum + course.workloadHours, 0);
  return `A trilha "${track.title}" foi priorizada por estar ligada à competência "${gap.competencyName}", com nível ${stage.level} e ${courses.length} curso(s), somando ${totalHours}h.`;
}

async function fetchCollectionRaw(
  db: Firestore,
  collectionName: string,
  constraints: QueryConstraint[] = []
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const ref = collection(db, collectionName);
  const snapshot = await getDocs(query(ref, ...constraints));
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data() as Record<string, unknown>,
  }));
}

async function fetchByIdsRaw(
  db: Firestore,
  collectionName: string,
  ids: string[]
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  if (!ids.length) return [];

  const chunks = chunkArray(uniqueById(ids.map((id) => ({ id }))).map((item) => item.id), 30);
  const results: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const group of chunks) {
    const snapshot = await getDocs(
      query(collection(db, collectionName), where(documentId(), 'in', group))
    );
    results.push(
      ...snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data() as Record<string, unknown>,
      }))
    );
  }

  return results;
}

function mapTrack(raw: { id: string; data: Record<string, unknown> }): LearningTrack {
  const data = raw.data;
  const title =
    normalizeString(data.nome) ||
    normalizeString(data.title) ||
    normalizeString(data.titulo) ||
    raw.id;

  const description =
    normalizeString(data.descricao) ||
    normalizeString(data.description) ||
    '';

  const level = levelFromRaw(data.nivel ?? data.level);

  const code =
    normalizeString(data.codigo) ||
    normalizeString(data.code) ||
    raw.id;

  return {
    id: raw.id,
    code,
    title,
    description,
    competencyAxis: axisFromRaw(data.eixo ?? data.competencyAxis ?? data.axis),
    targetAudience:
      normalizeString(data.publicoAlvo) ||
      normalizeString(data.targetAudience) ||
      'tecnico_administrativo',
    preferredModality: modalityFromRaw(data.modalidadePreferencial ?? data.preferredModality ?? 'EAD'),
    levels: [level],
    active: data.ativo === undefined ? true : Boolean(data.ativo ?? data.active),
    sortOrder: normalizeNumber(data.ordem ?? data.sortOrder, 999999),
    mainCompetencyId:
      normalizeString(data.competenciaPrincipal) ||
      normalizeString(data.mainCompetencyId),
    relatedCompetencyIds: Array.isArray(data.competenciasSecundarias)
      ? (data.competenciasSecundarias as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : Array.isArray(data.relatedCompetencyIds)
      ? (data.relatedCompetencyIds as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : [],
    recommendedSetorIds: Array.isArray(data.setoresAlvo)
      ? (data.setoresAlvo as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : Array.isArray(data.recommendedSetorIds)
      ? (data.recommendedSetorIds as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : [],
    recommendedUnidadeIds: Array.isArray(data.unidadesAlvo)
      ? (data.unidadesAlvo as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : Array.isArray(data.recommendedUnidadeIds)
      ? (data.recommendedUnidadeIds as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : [],
    recommendedFuncaoIds: Array.isArray(data.funcoesAlvo)
      ? (data.funcoesAlvo as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : Array.isArray(data.recommendedFuncaoIds)
      ? (data.recommendedFuncaoIds as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : [],
    recommendedCargoIds: Array.isArray(data.cargosAlvo)
      ? (data.cargosAlvo as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : Array.isArray(data.recommendedCargoIds)
      ? (data.recommendedCargoIds as unknown[]).map((item) => normalizeString(item)).filter(Boolean)
      : [],
    tipo: normalizeString(data.tipo),
  };
}

function mapSyntheticStage(track: LearningTrack, courses: Course[]): TrackStage {
  return {
    id: `${track.id}__stage__${track.levels[0] || 'intermediario'}`,
    trackId: track.id,
    level: track.levels[0] || 'intermediario',
    title: `Etapa ${track.levels[0] || 'intermediario'}`,
    description: `Etapa da trilha ${track.title}`,
    recommendedTotalHours: courses.reduce((sum, course) => sum + course.workloadHours, 0),
    sortOrder: 1,
    active: true,
  };
}

function mapCourse(raw: { id: string; data: Record<string, unknown> }): Course {
  const data = raw.data;
  return {
    id: raw.id,
    code:
      normalizeString(data.codigo) ||
      normalizeString(data.code) ||
      raw.id,
    title:
      normalizeString(data.nome) ||
      normalizeString(data.title) ||
      normalizeString(data.titulo) ||
      raw.id,
    description:
      normalizeString(data.descricao) ||
      normalizeString(data.description) ||
      '',
    competencyAxis: axisFromRaw(data.eixo ?? data.competencyAxis ?? data.axis),
    modality: modalityFromRaw(data.modalidade ?? data.modality),
    workloadHours: normalizeNumber(
      data.cargaHoraria ?? data.workloadHours ?? data.hours,
      0
    ),
    level: levelFromRaw(data.nivel ?? data.level),
    active: data.ativo === undefined ? true : Boolean(data.ativo ?? data.active),
    sortOrder: normalizeNumber(data.ordem ?? data.sortOrder, 999999),
  };
}

function mapTrackCourseLink(raw: { id: string; data: Record<string, unknown> }, stageId: string): TrackCourseLink {
  const data = raw.data;
  return {
    id: raw.id,
    trackId:
      normalizeString(data.trilhaId) ||
      normalizeString(data.trackId),
    stageId,
    courseId:
      normalizeString(data.cursoId) ||
      normalizeString(data.courseId),
    order: normalizeNumber(data.ordem ?? data.order, 999999),
    required: Boolean(data.obrigatorio ?? data.required),
    active: data.ativo === undefined ? true : Boolean(data.ativo ?? data.active),
  };
}

export async function getLearningTracksByAxis(
  db: Firestore,
  competencyAxis: CompetencyAxis,
  activeOnly = true
): Promise<LearningTrack[]> {
  const rows = await fetchCollectionRaw(db, 'trilhas');
  return rows
    .map(mapTrack)
    .filter((item) => (activeOnly ? item.active : true))
    .filter((item) => item.competencyAxis === competencyAxis)
    .sort(bySortOrder);
}

export async function getCoursesByLevel(
  db: Firestore,
  level: TrackLevel,
  activeOnly = true
): Promise<Course[]> {
  const rows = await fetchCollectionRaw(db, 'cursos');
  return rows
    .map(mapCourse)
    .filter((item) => (activeOnly ? item.active : true))
    .filter((item) => item.level === level)
    .sort(bySortOrder);
}

export async function getStagesByTrackId(
  db: Firestore,
  trackId: string,
  activeOnly = true
): Promise<TrackStage[]> {
  const track = await getTrackWithStagesAndCourses(db, trackId, activeOnly);
  return track ? track.stages.map(({ courses, ...stage }) => stage).sort(bySortOrder) : [];
}

export async function getTrackCourseLinksByTrackId(
  db: Firestore,
  trackId: string,
  activeOnly = true
): Promise<TrackCourseLink[]> {
  const linkRows = await fetchCollectionRaw(db, 'trilha_cursos', [
    where('trilhaId', '==', trackId),
  ]);
  const trackRows = await fetchByIdsRaw(db, 'trilhas', [trackId]);
  const track = trackRows[0] ? mapTrack(trackRows[0]) : null;
  if (!track || (activeOnly && !track.active)) return [];
  const stage = mapSyntheticStage(track, []);
  return linkRows
    .map((row) => mapTrackCourseLink(row, stage.id))
    .filter((item) => (activeOnly ? item.active : true))
    .sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
}

export async function getTrackWithStagesAndCourses(
  db: Firestore,
  trackId: string,
  activeOnly = true
): Promise<TrackWithStagesAndCourses | null> {
  const [trackRow] = await fetchByIdsRaw(db, 'trilhas', [trackId]);
  if (!trackRow) return null;

  const track = mapTrack(trackRow);
  if (activeOnly && !track.active) return null;

  const linkRows = await fetchCollectionRaw(db, 'trilha_cursos', [where('trilhaId', '==', trackId)]);
  const stage = mapSyntheticStage(track, []);
  const links = linkRows
    .map((row) => mapTrackCourseLink(row, stage.id))
    .filter((item) => (activeOnly ? item.active : true))
    .sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));

  const courseIds = links.map((link) => link.courseId).filter(Boolean);
  const courseRows = await fetchByIdsRaw(db, 'cursos', courseIds);
  const courseMap = new Map(courseRows.map((row) => {
    const course = mapCourse(row);
    return [course.id, course] as const;
  }));

  const stageCourses = links
    .map((link) => courseMap.get(link.courseId))
    .filter((item): item is Course => Boolean(item))
    .filter((item) => (activeOnly ? item.active : true))
    .sort(bySortOrder);

  const stageWithCourses: StageWithCourses = {
    ...mapSyntheticStage(track, stageCourses),
    courses: stageCourses,
  };

  return {
    ...track,
    stages: [stageWithCourses],
  };
}

export async function getTracksByAxisWithStagesAndCourses(
  db: Firestore,
  competencyAxis: CompetencyAxis,
  activeOnly = true
): Promise<TrackWithStagesAndCourses[]> {
  const rows = await fetchCollectionRaw(db, 'trilhas');
  const mapped = rows
    .map(mapTrack)
    .filter((item) => (activeOnly ? item.active : true))
    .filter((item) => item.competencyAxis === competencyAxis);

  const result = await Promise.all(
    mapped.map((track) => getTrackWithStagesAndCourses(db, track.id, activeOnly))
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
    preferredModality = 'EAD',
    activeOnly = true,
  } = options;

  if (!gaps.length) return [];

  const trackRows = await fetchCollectionRaw(db, 'trilhas');
  const allTracks = trackRows
    .map(mapTrack)
    .filter((item) => (activeOnly ? item.active : true));

  const recommendations: RecommendationItem[] = [];

  for (const gap of gaps) {
    let relatedTracks = allTracks.filter((track) => {
      const sameMain = normalizeLookup(track.mainCompetencyId) === normalizeLookup(gap.competencyId);
      const sameRelated = (track.relatedCompetencyIds || []).some(
        (id) => normalizeLookup(id) === normalizeLookup(gap.competencyId)
      );
      return sameMain || sameRelated;
    });

    // Fallback inteligente: se não houver trilha por competência exata,
    // tenta buscar trilhas do mesmo eixo para evitar cair sempre nas mesmas genéricas.
    if (relatedTracks.length === 0) {
      relatedTracks = allTracks.filter(
        (track) => track.competencyAxis === gap.competencyAxis
      );
    }

    const hydratedTracks = await Promise.all(
      relatedTracks.map((track) => getTrackWithStagesAndCourses(db, track.id, activeOnly))
    );

    const ranked = hydratedTracks
      .filter(Boolean)
      .map((track) => {
        const safeTrack = track as TrackWithStagesAndCourses;
        const targetLevel = preferredLevel ?? normalizeLevelFromGap(gap);
        const matchingStage =
          safeTrack.stages.find((stage) => stage.level === targetLevel) ??
          safeTrack.stages[0];

        if (!matchingStage) return null;

        const matchScore = buildTrackMatchScore(
          safeTrack,
          matchingStage,
          matchingStage.courses,
          gap,
          preferredModality
        );

        return {
          track: safeTrack,
          stage: matchingStage,
          courses: matchingStage.courses,
          matchScore,
          rationale: buildRationale(safeTrack, matchingStage, matchingStage.courses, gap),
          gap,
        } satisfies RecommendationItem;
      })
      .filter(Boolean)
      .sort((a, b) => b!.matchScore - a!.matchScore)
      .slice(0, maxTracksPerGap) as RecommendationItem[];

    recommendations.push(...ranked);
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
