import { collection, getDocs, type Firestore } from "firebase/firestore";

import type {
  Competency,
  Course,
  LearningTrack,
  TrackCourseLink,
  TrackStage,
} from "@/lib/catalog-types";

export interface CourseCatalogData {
  competencies: Competency[];
  learningTracks: LearningTrack[];
  trackStages: TrackStage[];
  courses: Course[];
  trackCourseLinks: TrackCourseLink[];
}

type FirestoreDoc = Record<string, any>;

type PartialCourse = Course & {
  source?: string;
  provider?: string;
  link?: string | null;
};

function normalizeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
}

function normalizeText(value: unknown): string {
  return normalizeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const text = normalizeText(value);
  if (!text) return fallback;
  if (["false", "0", "nao", "não", "inativo", "inactive"].includes(text)) {
    return false;
  }
  if (["true", "1", "sim", "ativo", "active"].includes(text)) {
    return true;
  }
  return fallback;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const converted = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(converted) ? converted : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) return normalized;
  }
  return "";
}

function normalizeDifficultyLevel(value: unknown): 1 | 2 | 3 {
  const text = normalizeText(value);
  const numeric = normalizeNumber(value, NaN);

  if (numeric === 1 || numeric === 2 || numeric === 3) return numeric as 1 | 2 | 3;
  if (["basico", "básico", "inicial", "beginner"].includes(text)) return 1;
  if (["intermediario", "intermediário", "medio", "médio"].includes(text)) return 2;
  if (["avancado", "avançado", "advanced"].includes(text)) return 3;
  return 2;
}

function normalizeCourseModality(value: unknown): "ead" | "presencial" | "hibrido" {
  const text = normalizeText(value);
  if (text.includes("presencial")) return "presencial";
  if (text.includes("hibrid") || text.includes("blended")) return "hibrido";
  return "ead";
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const id = normalizeString(item.id);
    if (!id) continue;
    if (!map.has(id)) map.set(id, item);
  }
  return Array.from(map.values());
}

function dedupeCourses(items: PartialCourse[]): PartialCourse[] {
  const map = new Map<string, PartialCourse>();

  for (const item of items) {
    const id = normalizeString(item.id);
    if (!id) continue;

    const existing = map.get(id);
    if (!existing) {
      map.set(id, item);
      continue;
    }

    map.set(id, {
      ...existing,
      ...item,
      relatedCompetencyIds: Array.from(
        new Set([...(existing.relatedCompetencyIds || []), ...(item.relatedCompetencyIds || [])])
      ),
      keywords: Array.from(new Set([...(existing.keywords || []), ...(item.keywords || [])])),
    });
  }

  return Array.from(map.values());
}

function deriveAxisFromText(value: unknown): string {
  const text = normalizeText(value);
  if (!text) return "E4";

  if (text.includes("comunic")) return "E1";
  if (text.includes("equipe") || text.includes("interpessoal")) return "E2";
  if (text.includes("etica") || text.includes("responsabilidade")) return "E3";
  if (text.includes("inov") || text.includes("process")) return "E4";
  if (text.includes("planej") || text.includes("gestao") || text.includes("gestão")) return "E5";
  return "E4";
}

function resolveCourseUrl(data: FirestoreDoc): string | null {
  const url = pickFirstString(
    data.url,
    data.link,
    data.courseUrl,
    data.courseLink,
    data.accessUrl,
    data.accessLink,
    data.catalogUrl,
    data.catalogLink
  );
  return url || null;
}

function mapCompetency(docId: string, data: FirestoreDoc): Competency | null {
  const id = pickFirstString(docId, data.id, data.competenciaId, data.competencyId, data.code);
  const name = pickFirstString(data.name, data.nome, data.title);
  if (!id || !name) return null;

  return {
    id,
    code: pickFirstString(data.code, data.competenciaId, data.competencyId, id),
    name,
    description: pickFirstString(data.description, data.descricao, data.summary, data.resumo),
    axis: pickFirstString(data.axis, data.eixo, data.axisCode, deriveAxisFromText(data.eixo || name)),
    keywords: normalizeStringArray(data.keywords || data.palavrasChave),
    active: normalizeBoolean(data.active ?? data.ativo, true),
    type: (pickFirstString(data.type, data.tipo) as any) || undefined,
  };
}

function mapLearningTrack(docId: string, data: FirestoreDoc): LearningTrack | null {
  const id = pickFirstString(docId, data.id, data.trilhaId, data.trackId);
  const title = pickFirstString(data.title, data.nome, data.name);
  if (!id || !title) return null;

  return {
    id,
    code: pickFirstString(data.code, data.trilhaId, id),
    title,
    description: pickFirstString(data.description, data.descricao, data.summary),
    objective: pickFirstString(data.objective, data.objetivo),
    mainCompetencyId: pickFirstString(
      data.mainCompetencyId,
      data.competenciaPrincipal,
      data.competencyId,
      data.linkedCompetencyId
    ),
    relatedCompetencyIds: normalizeStringArray(
      data.relatedCompetencyIds || data.competenciasSecundarias || data.secondaryCompetencies
    ),
    targetAudience: normalizeStringArray(data.targetAudience || data.publicoAlvo || data.publicoAlvoIds),
    recommendedCargoIds: normalizeStringArray(
      data.recommendedCargoIds || data.cargoIds || data.funcoesAlvo || data.appliesToCargoIds
    ),
    recommendedSetorIds: normalizeStringArray(
      data.recommendedSetorIds || data.recommendedSectorIds || data.setoresAlvo || data.setorIds || data.sectorIds || data.appliesToSetorIds
    ),
    recommendedFuncaoIds: normalizeStringArray(
      data.recommendedFuncaoIds || data.funcaoIds || data.funcoesAlvo || data.appliesToFuncaoIds
    ),
    recommendedUnidadeIds: normalizeStringArray(
      data.recommendedUnidadeIds || data.unidadesAlvo || data.unidadeIds || data.unitIds || data.appliesToUnidadeIds
    ),
    entryLevel: normalizeDifficultyLevel(data.entryLevel || data.nivel || data.level),
    exitLevel: normalizeDifficultyLevel(data.exitLevel || data.nivel || data.level),
    estimatedWorkloadHours: normalizeNumber(data.estimatedWorkloadHours, 0),
    estimatedDurationText: pickFirstString(data.estimatedDurationText, data.duracaoEstimada),
    trackType: pickFirstString(data.trackType, data.tipo),
    tags: normalizeStringArray(data.tags || data.palavrasChave),
    active: normalizeBoolean(data.active ?? data.ativo, true),
    version: normalizeNumber(data.version, 1),
  };
}

function mapCourse(docId: string, data: FirestoreDoc): PartialCourse | null {
  const id = pickFirstString(docId, data.id, data.cursoId, data.courseId, data.code);
  const title = pickFirstString(data.title, data.titulo, data.name);
  if (!id || !title) return null;

  const competencies = normalizeStringArray(
    data.relatedCompetencyIds || data.competencias || data.secondaryCompetencies
  );
  const mainCompetencyId = pickFirstString(
    data.mainCompetencyId,
    data.competencyId,
    data.linkedCompetencyId,
    competencies[0]
  );

  return {
    id,
    code: pickFirstString(data.code, data.cursoId, id),
    title,
    description: pickFirstString(data.description, data.descricao, data.summary, data.resumo),
    providerName: pickFirstString(data.providerName, data.provider, data.fonte),
    providerType: normalizeText(data.fonte) === "uneb" ? "internal" : "external",
    modality: normalizeCourseModality(data.modality || data.modalidade),
    format: "curso",
    workloadHours: normalizeNumber(data.workloadHours, data.cargaHoraria || data.hours || 0),
    difficultyLevel: normalizeDifficultyLevel(data.difficultyLevel || data.nivel || data.level),
    mainCompetencyId,
    relatedCompetencyIds: competencies,
    keywords: normalizeStringArray(data.keywords || data.palavrasChave),
    expectedOutcome: pickFirstString(data.expectedOutcome, data.publicoAlvo),
    prerequisiteCourseIds: normalizeStringArray(data.prerequisiteCourseIds),
    certificateAvailable: true,
    url: resolveCourseUrl(data) || undefined,
    source: pickFirstString(data.source, data.fonte, data.provider),
    status: pickFirstString(data.status, data.situacao),
    active: normalizeBoolean(data.active ?? data.ativo, true),
    sourceRecommendationId: undefined as any,
  };
}

function inferStageId(trackId: string, courseLevel: 1 | 2 | 3): string {
  return `${trackId}__stage_${courseLevel}`;
}

function mapTrackCourseLink(docId: string, data: FirestoreDoc, coursesById: Map<string, PartialCourse>): TrackCourseLink | null {
  const trackId = pickFirstString(data.trackId, data.trilhaId, data.learningTrackId);
  const courseId = pickFirstString(data.courseId, data.cursoId, data.catalogItemId);
  const id = pickFirstString(docId, data.id, `${trackId}__${courseId}`);
  if (!id || !trackId || !courseId) return null;

  const course = coursesById.get(courseId);
  const stageId = pickFirstString(data.stageId, data.trackStageId) || inferStageId(trackId, course?.difficultyLevel || 2);

  return {
    id,
    trackId,
    stageId,
    courseId,
    competencyId: course?.mainCompetencyId || pickFirstString(data.competencyId, data.competenciaId),
    isRequired: normalizeBoolean(data.isRequired ?? data.obrigatorio, false),
    recommendedOrder: normalizeNumber(data.recommendedOrder, data.ordem || data.order || 1),
    relevanceWeight: normalizeNumber(data.relevanceWeight, 1),
    roleInStage: normalizeBoolean(data.obrigatorio, false) ? "core" : "optional",
    active: normalizeBoolean(data.active ?? data.ativo, true),
  };
}

async function loadCollectionDocs(db: Firestore, collectionName: string): Promise<Array<{ id: string; data: FirestoreDoc }>> {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as FirestoreDoc }));
  } catch (error) {
    console.warn(`Não foi possível carregar a coleção ${collectionName}:`, error);
    return [];
  }
}

function buildStagesFromTracksAndLinks(
  tracks: LearningTrack[],
  links: TrackCourseLink[],
  coursesById: Map<string, PartialCourse>
): TrackStage[] {
  const map = new Map<string, TrackStage>();

  for (const track of tracks) {
    const trackLinks = links.filter((link) => link.trackId === track.id && link.active);
    if (!trackLinks.length) {
      const fallbackId = inferStageId(track.id, track.entryLevel || 2);
      map.set(fallbackId, {
        id: fallbackId,
        trackId: track.id,
        order: 1,
        level: track.entryLevel || 2,
        title: "Etapa inicial",
        description: "Etapa derivada automaticamente a partir dos cursos da trilha.",
        estimatedWorkloadHours: 0,
        active: true,
      });
      continue;
    }

    const grouped = new Map<string, TrackCourseLink[]>();
    for (const link of trackLinks) {
      const arr = grouped.get(link.stageId) || [];
      arr.push(link);
      grouped.set(link.stageId, arr);
    }

    const orderedStageIds = Array.from(grouped.keys()).sort((a, b) => {
      const aOrder = Math.min(...(grouped.get(a) || []).map((item) => item.recommendedOrder || 999));
      const bOrder = Math.min(...(grouped.get(b) || []).map((item) => item.recommendedOrder || 999));
      return aOrder - bOrder;
    });

    orderedStageIds.forEach((stageId, index) => {
      const stageLinks = grouped.get(stageId) || [];
      const stageCourses = stageLinks
        .map((link) => coursesById.get(link.courseId))
        .filter(Boolean) as PartialCourse[];
      const level = stageCourses[0]?.difficultyLevel || track.entryLevel || 2;
      const hours = stageCourses.reduce((sum, item) => sum + Number(item.workloadHours || 0), 0);

      map.set(stageId, {
        id: stageId,
        trackId: track.id,
        order: index + 1,
        level,
        title: `Etapa ${index + 1}`,
        description: "Etapa derivada automaticamente da ordenação dos cursos da trilha.",
        estimatedWorkloadHours: hours,
        active: true,
      });
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.trackId !== b.trackId) return a.trackId.localeCompare(b.trackId, "pt-BR");
    return a.order - b.order;
  });
}

export async function loadCourseCatalog(db: Firestore): Promise<CourseCatalogData> {
  const [
    competenciasPt,
    competenciasEn,
    trilhasPt,
    trilhasEn,
    cursosPt,
    cursosEn,
    trilhaCursosPt,
    trilhaCursosEn,
    trackStagesEn,
  ] = await Promise.all([
    loadCollectionDocs(db, "competencias"),
    loadCollectionDocs(db, "competencies"),
    loadCollectionDocs(db, "trilhas"),
    loadCollectionDocs(db, "learningTracks"),
    loadCollectionDocs(db, "cursos"),
    loadCollectionDocs(db, "courses"),
    loadCollectionDocs(db, "trilha_cursos"),
    loadCollectionDocs(db, "trackCourseLinks"),
    loadCollectionDocs(db, "trackStages"),
  ]);

  const competencies = dedupeById(
    [...competenciasPt, ...competenciasEn]
      .map(({ id, data }) => mapCompetency(id, data))
      .filter(Boolean) as Competency[]
  );

  const learningTracks = dedupeById(
    [...trilhasPt, ...trilhasEn]
      .map(({ id, data }) => mapLearningTrack(id, data))
      .filter(Boolean) as LearningTrack[]
  );

  const courses = dedupeCourses(
    [...cursosPt, ...cursosEn]
      .map(({ id, data }) => mapCourse(id, data))
      .filter(Boolean) as PartialCourse[]
  );
  const coursesById = new Map(courses.map((item) => [item.id, item]));

  const directLinks = dedupeById(
    [...trilhaCursosPt, ...trilhaCursosEn]
      .map(({ id, data }) => mapTrackCourseLink(id, data, coursesById))
      .filter(Boolean) as TrackCourseLink[]
  );

  const derivedLinksFromCourses = dedupeById(
    courses
      .filter((course) => normalizeString((course as any).trilhaId))
      .map((course, index) => {
        const raw = course as any;
        return mapTrackCourseLink(
          `${course.id}__derived_link_${index}`,
          {
            trilhaId: raw.trilhaId,
            cursoId: course.id,
            ordem: index + 1,
            obrigatorio: false,
          },
          coursesById
        );
      })
      .filter(Boolean) as TrackCourseLink[]
  );

  const trackCourseLinks = dedupeById([...directLinks, ...derivedLinksFromCourses]);

  const explicitStages = dedupeById(
    trackStagesEn
      .map(({ id, data }) => {
        const stageId = pickFirstString(id, data.id, data.stageId);
        const trackId = pickFirstString(data.trackId, data.trilhaId, data.learningTrackId);
        if (!stageId || !trackId) return null;
        return {
          id: stageId,
          trackId,
          order: normalizeNumber(data.order, data.sortOrder || 1),
          level: normalizeDifficultyLevel(data.level),
          title: pickFirstString(data.title, data.name, `Etapa ${normalizeNumber(data.order, 1)}`),
          description: pickFirstString(data.description, data.summary),
          estimatedWorkloadHours: normalizeNumber(data.estimatedWorkloadHours, data.recommendedTotalHours || 0),
          active: normalizeBoolean(data.active, true),
        } as TrackStage;
      })
      .filter(Boolean) as TrackStage[]
  );

  const derivedStages = buildStagesFromTracksAndLinks(learningTracks, trackCourseLinks, coursesById);
  const trackStages = dedupeById([...explicitStages, ...derivedStages]);

  return {
    competencies,
    learningTracks,
    trackStages,
    courses,
    trackCourseLinks,
  };
}
