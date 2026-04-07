import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from "firebase/firestore";
import type { DiagnosticItem, Priority } from "@/types/diagnostic";

export type RecommendationType = "TRILHA" | "CURSO";
export type ProgressStatus =
  | "NAO_INICIADO"
  | "EM_DESENVOLVIMENTO"
  | "AGUARDANDO_REAVALIACAO";

export type CourseSource = "UNEB" | "EVG";

export type SuggestedCourse = {
  id: string;
  title: string;
  description: string;
  url?: string | null;
  source: CourseSource;
  modality?: string;
  workloadHours?: number;
  difficultyLevel?: string;
};

export type MicrolearningAction = {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
};

export type RecommendationItem = {
  recommendationId: string;
  type: RecommendationType;
  title: string;
  description: string;
  linkedCompetencyId: string;
  linkedCompetencyName: string;
  axisCode: string;
  axisName: string;
  priority: Priority;
  reason: string;
  estimatedWorkloadHours: number;
  modality: string;
  suggestedCourses: SuggestedCourse[];
  microlearningActions: MicrolearningAction[];
  progressStatus: ProgressStatus;
  progressPercent: number;
  completedCoursesCount: number;
  totalCoursesCount: number;
  hasRelatedEvidenceOutsideTrail: boolean;
};

export type CatalogItemDoc = {
  title?: string;
  description?: string;
  source?: string;
  provider?: string;
  competencyAxis?: string;
  difficultyLevel?: string;
  workloadHours?: number;
  modality?: string;
  url?: string | null;
  active?: boolean;
  catalogType?: string;
  priority?: string;
  recommendedSetorIds?: string[];
  recommendedSectorIds?: string[];
  appliesToSetorIds?: string[];
  recommendedFuncaoIds?: string[];
  recommendedRoleIds?: string[];
  appliesToFuncaoIds?: string[];
  recommendedUnidadeIds?: string[];
  recommendedUnitIds?: string[];
  appliesToUnidadeIds?: string[];
  keywords?: string[];
};

export type ContextSnapshot = {
  unitId?: string;
  sectorId?: string;
  roleId?: string;
  unitName?: string;
  sectorName?: string;
  roleName?: string;
};

function normalizeId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
}

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

function getMacroSetor(value?: string): string {
  const normalized = normalizeLookup(value);
  if (!normalized) return "";

  const parts = normalized
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);

  const all = new Set(parts);

  if (all.has("seconf")) return "seconf";
  if (all.has("proad")) return "proad";
  if (all.has("proplan")) return "proplan";
  if (all.has("pgdp")) return "pgdp";
  if (all.has("dcht")) return "dcht";
  if (all.has("dedc")) return "dedc";
  if (all.has("dcv")) return "dcv";

  return parts[0] || "";
}

function buildTrailTitle(
  item: DiagnosticItem,
  contextSnapshot?: ContextSnapshot | null
): string {
  const sectorName = normalizeString(contextSnapshot?.sectorName);

  if (sectorName) {
    return `Percurso para desenvolver ${item.competencyName} no seu setor`;
  }

  return `Percurso para desenvolver ${item.competencyName}`;
}

function buildRecommendationReason(
  item: DiagnosticItem,
  contextSnapshot?: ContextSnapshot | null
): string {
  const sectorName = normalizeString(contextSnapshot?.sectorName);

  if (item.priority === "ALTA") {
    return sectorName
      ? `Esta trilha foi sugerida porque "${item.competencyName}" precisa de atenção agora e foi priorizada considerando seu setor (${sectorName}).`
      : `Esta trilha foi sugerida porque "${item.competencyName}" precisa de atenção agora.`;
  }

  if (item.priority === "MÉDIA") {
    return sectorName
      ? `Esta trilha foi sugerida para fortalecer "${item.competencyName}" com foco no seu contexto de trabalho no setor ${sectorName}.`
      : `Esta trilha foi sugerida para fortalecer a competência "${item.competencyName}".`;
  }

  return sectorName
    ? `Esta trilha foi sugerida para apoiar o desenvolvimento contínuo de "${item.competencyName}" considerando o contexto do seu setor (${sectorName}).`
    : `Esta trilha foi sugerida para apoiar o desenvolvimento contínuo da competência "${item.competencyName}".`;
}

function buildMicrolearningActions(item: DiagnosticItem): MicrolearningAction[] {
  const base = item.competencyName;
  const idBase = normalizeId(base);

  return [
    {
      id: `${idBase}_micro_1`,
      title: `Leitura rápida sobre ${base}`,
      description: `Leia um material curto sobre ${base} e destaque os pontos mais importantes.`,
      estimatedMinutes: 15,
    },
    {
      id: `${idBase}_micro_2`,
      title: "Aplicação no trabalho",
      description: `Pense em uma atividade do seu trabalho em que ${base} possa ser aplicada.`,
      estimatedMinutes: 10,
    },
    {
      id: `${idBase}_micro_3`,
      title: "Pequeno plano de ação",
      description: `Escolha uma ação simples para começar a desenvolver ${base} no seu dia a dia.`,
      estimatedMinutes: 15,
    },
  ];
}

function estimatedHoursByPriority(priority: Priority): number {
  if (priority === "ALTA") return 40;
  if (priority === "MÉDIA") return 20;
  return 10;
}

function modalityByPriority(priority: Priority): string {
  if (priority === "ALTA") return "híbrida";
  if (priority === "MÉDIA") return "ead";
  return "ead";
}

function normalizeModalityLabel(modality?: string): string {
  const value = normalizeLookup(modality);

  if (!value) return "";

  if (value.includes("hibrid")) return "híbrida";
  if (value.includes("presencial")) return "presencial";
  if (value.includes("ead")) return "ead";
  if (value.includes("online")) return "online";
  if (value.includes("remoto")) return "remota";

  return normalizeString(modality).toLowerCase();
}

function calculateTrailModality(
  courses: SuggestedCourse[],
  priority: Priority
): string {
  const modalities = Array.from(
    new Set(
      courses
        .map((course) => normalizeModalityLabel(course.modality))
        .filter(Boolean)
    )
  );

  if (modalities.length === 0) {
    return modalityByPriority(priority);
  }

  if (modalities.length === 1) {
    return modalities[0];
  }

  return "mista";
}

function normalizeCatalogCourse(
  id: string,
  data: CatalogItemDoc,
  source: CourseSource
): SuggestedCourse {
  return {
    id,
    title:
      data.title ||
      (source === "UNEB"
        ? "Curso institucional UNEB"
        : "Curso complementar EVG"),
    description:
      data.description ||
      (source === "UNEB"
        ? "Curso recomendado para o desenvolvimento da competência."
        : "Curso complementar para reforçar o desenvolvimento da competência."),
    url: data.url || null,
    source,
    modality: data.modality || "ead",
    workloadHours: Number(data.workloadHours || 0),
    difficultyLevel: data.difficultyLevel || "intermediario",
  };
}

function buildSearchTextFromCourse(course: CatalogItemDoc): string {
  const keywordsText = Array.isArray(course.keywords)
    ? course.keywords.join(" ")
    : "";

  return normalizeLookup(
    `${course.title || ""} ${course.description || ""} ${course.provider || ""} ${keywordsText}`
  );
}

function getKeywordsFromText(text: string): string[] {
  const stopwords = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "em",
    "para",
    "por",
    "com",
    "sem",
    "no",
    "na",
    "nos",
    "nas",
    "a",
    "o",
    "as",
    "os",
    "um",
    "uma",
    "ao",
    "aos",
    "às",
    "ou",
    "que",
    "se",
    "sua",
    "seu",
    "suas",
    "seus",
    "sobre",
  ]);

  return normalizeLookup(text)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && !stopwords.has(part));
}

function hasAnyIdMatch(list: unknown, value?: string): boolean {
  if (!Array.isArray(list) || !value) return false;

  const target = normalizeLookup(value);

  return list.some((item) => normalizeLookup(item) === target);
}

function hasAnySetorMatch(
  list: unknown,
  unitId?: string,
  sectorId?: string
): boolean {
  if (!Array.isArray(list)) return false;

  const targetMacro = getMacroSetor(unitId || sectorId);
  if (!targetMacro) return false;

  return list.some((item) => {
    const itemMacro = getMacroSetor(normalizeString(item));
    return itemMacro === targetMacro;
  });
}

function scoreCourseByContext(params: {
  course: CatalogItemDoc;
  competencyName: string;
  axisName: string;
  contextSnapshot?: ContextSnapshot | null;
  preferredCourseKeys?: Set<string>;
}): number {
  const {
    course,
    competencyName,
    axisName,
    contextSnapshot,
    preferredCourseKeys,
  } = params;

  const haystack = buildSearchTextFromCourse(course);
  let score = 0;

  const competencyKeywords = getKeywordsFromText(competencyName);
  const axisKeywords = getKeywordsFromText(axisName);
  const sectorKeywords = getKeywordsFromText(contextSnapshot?.sectorName || "");
  const roleKeywords = getKeywordsFromText(contextSnapshot?.roleName || "");
  const unitKeywords = getKeywordsFromText(contextSnapshot?.unitName || "");

  competencyKeywords.forEach((keyword) => {
    if (haystack.includes(keyword)) score += 6;
  });

  axisKeywords.forEach((keyword) => {
    if (haystack.includes(keyword)) score += 2;
  });

  sectorKeywords.forEach((keyword) => {
    if (haystack.includes(keyword)) score += 10;
  });

  roleKeywords.forEach((keyword) => {
    if (haystack.includes(keyword)) score += 5;
  });

  unitKeywords.forEach((keyword) => {
    if (haystack.includes(keyword)) score += 2;
  });

  const normalizedCompetencyName = normalizeLookup(competencyName);

  if (
    course.title &&
    normalizeLookup(course.title).includes(normalizedCompetencyName)
  ) {
    score += 8;
  }

  if (
    hasAnySetorMatch(
      course.recommendedSetorIds,
      contextSnapshot?.unitId,
      contextSnapshot?.sectorId
    ) ||
    hasAnySetorMatch(
      course.recommendedSectorIds,
      contextSnapshot?.unitId,
      contextSnapshot?.sectorId
    ) ||
    hasAnySetorMatch(
      course.appliesToSetorIds,
      contextSnapshot?.unitId,
      contextSnapshot?.sectorId
    )
  ) {
    score += 30;
  }

  if (
    hasAnyIdMatch(course.recommendedFuncaoIds, contextSnapshot?.roleId) ||
    hasAnyIdMatch(course.recommendedRoleIds, contextSnapshot?.roleId) ||
    hasAnyIdMatch(course.appliesToFuncaoIds, contextSnapshot?.roleId)
  ) {
    score += 18;
  }

  if (
    hasAnyIdMatch(course.recommendedUnidadeIds, contextSnapshot?.unitId) ||
    hasAnyIdMatch(course.recommendedUnitIds, contextSnapshot?.unitId) ||
    hasAnyIdMatch(course.appliesToUnidadeIds, contextSnapshot?.unitId)
  ) {
    score += 8;
  }

  if (course.priority && normalizeLookup(course.priority).includes("alta")) {
    score += 1;
  }

  if (course.url) {
    score += 1;
  }

  if (preferredCourseKeys?.size) {
    const courseKey = buildCourseUniquenessKey(
      normalizeString(course.title),
      normalizeString(course.provider),
      normalizeString(course.source)
    );

    if (preferredCourseKeys.has(courseKey)) {
      score -= 1000;
    }
  }

  return score;
}

function buildCourseUniquenessKey(
  title?: string,
  provider?: string,
  source?: string
): string {
  return [normalizeLookup(source), normalizeLookup(provider), normalizeLookup(title)]
    .filter(Boolean)
    .join("|");
}

function getSuggestedCourseKey(course: SuggestedCourse): string {
  return buildCourseUniquenessKey(course.title, undefined, course.source);
}

export async function fetchRankedCatalogCourses(params: {
  db: Firestore | null | undefined;
  axisCode: string;
  source: CourseSource;
  maxItems: number;
  competencyName: string;
  axisName: string;
  contextSnapshot?: ContextSnapshot | null;
  excludedCourseKeys?: Set<string>;
}): Promise<SuggestedCourse[]> {
  const {
    db,
    axisCode,
    source,
    maxItems,
    competencyName,
    axisName,
    contextSnapshot,
    excludedCourseKeys,
  } = params;

  if (!db) return [];

  try {
    const q = query(
      collection(db, "catalogItems"),
      where("source", "==", source),
      where("competencyAxis", "==", axisCode),
      where("active", "==", true),
      limit(50)
    );

    const snap = await getDocs(q);

    const ranked = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() as CatalogItemDoc;

        return {
          id: docSnap.id,
          data,
          score: scoreCourseByContext({
            course: data,
            competencyName,
            axisName,
            contextSnapshot,
            preferredCourseKeys: excludedCourseKeys,
          }),
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const aHours = Number(a.data.workloadHours || 0);
        const bHours = Number(b.data.workloadHours || 0);

        if (aHours !== bHours) return aHours - bHours;

        return normalizeString(a.data.title).localeCompare(
          normalizeString(b.data.title),
          "pt-BR"
        );
      });

    const uniqueUnused = ranked.filter((item) => {
      if (!excludedCourseKeys?.size) return true;

      const key = buildCourseUniquenessKey(
        normalizeString(item.data.title),
        normalizeString(item.data.provider),
        source
      );

      return !excludedCourseKeys.has(key);
    });

    const chosenPool = uniqueUnused.length >= maxItems ? uniqueUnused : uniqueUnused;

    return chosenPool
      .slice(0, maxItems)
      .map((item) => normalizeCatalogCourse(item.id, item.data, source));
  } catch (error) {
    console.error(
      `Erro ao buscar cursos ${source} ranqueados por contexto:`,
      error
    );
    return [];
  }
}

function buildInstitutionalFallbackCourses(
  item: DiagnosticItem
): SuggestedCourse[] {
  const base = item.competencyName;

  if (item.priority === "ALTA") {
    return [
      {
        id: `fallback_uneb_${normalizeId(base)}_1`,
        title: `Fundamentos de ${base}`,
        description: "Curso inicial para entender os principais pontos do tema.",
        url: null,
        source: "UNEB",
        modality: "ead",
        workloadHours: 20,
        difficultyLevel: "inicial",
      },
      {
        id: `fallback_uneb_${normalizeId(base)}_2`,
        title: `Prática de ${base}`,
        description: "Curso com foco em aplicação da competência no trabalho.",
        url: null,
        source: "UNEB",
        modality: "híbrida",
        workloadHours: 20,
        difficultyLevel: "intermediario",
      },
      {
        id: `fallback_uneb_${normalizeId(base)}_3`,
        title: `Aprofundamento em ${base}`,
        description: "Curso para ampliar o domínio da competência.",
        url: null,
        source: "UNEB",
        modality: "híbrida",
        workloadHours: 30,
        difficultyLevel: "avancado",
      },
    ];
  }

  if (item.priority === "MÉDIA") {
    return [
      {
        id: `fallback_uneb_${normalizeId(base)}_1`,
        title: `Introdução a ${base}`,
        description:
          "Curso de base para começar o desenvolvimento da competência.",
        url: null,
        source: "UNEB",
        modality: "ead",
        workloadHours: 20,
        difficultyLevel: "inicial",
      },
      {
        id: `fallback_uneb_${normalizeId(base)}_2`,
        title: `Práticas de ${base}`,
        description:
          "Curso voltado para uso da competência na rotina profissional.",
        url: null,
        source: "UNEB",
        modality: "ead",
        workloadHours: 20,
        difficultyLevel: "intermediario",
      },
      {
        id: `fallback_uneb_${normalizeId(base)}_3`,
        title: `Estudo aplicado de ${base}`,
        description:
          "Curso para reforçar o aprendizado com exemplos práticos.",
        url: null,
        source: "UNEB",
        modality: "ead",
        workloadHours: 30,
        difficultyLevel: "intermediario",
      },
    ];
  }

  return [
    {
      id: `fallback_uneb_${normalizeId(base)}_1`,
      title: `Atualização em ${base}`,
      description: "Curso breve de atualização.",
      url: null,
      source: "UNEB",
      modality: "ead",
      workloadHours: 10,
      difficultyLevel: "inicial",
    },
    {
      id: `fallback_uneb_${normalizeId(base)}_2`,
      title: `Boas práticas em ${base}`,
      description: "Curso de reforço para o dia a dia.",
      url: null,
      source: "UNEB",
      modality: "ead",
      workloadHours: 10,
      difficultyLevel: "inicial",
    },
    {
      id: `fallback_uneb_${normalizeId(base)}_3`,
      title: `Revisão guiada de ${base}`,
      description: "Percurso simples para revisar conceitos e aplicação.",
      url: null,
      source: "UNEB",
      modality: "ead",
      workloadHours: 10,
      difficultyLevel: "inicial",
    },
  ];
}

function dedupeCourses(courses: SuggestedCourse[]): SuggestedCourse[] {
  const seen = new Set<string>();
  const unique: SuggestedCourse[] = [];

  for (const course of courses) {
    const key = getSuggestedCourseKey(course);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(course);
  }

  return unique;
}

function excludeAlreadyUsedCourses(
  courses: SuggestedCourse[],
  usedCourseKeys: Set<string>
): SuggestedCourse[] {
  return courses.filter((course) => !usedCourseKeys.has(getSuggestedCourseKey(course)));
}

function reserveUsedCourses(
  courses: SuggestedCourse[],
  usedCourseKeys: Set<string>
): void {
  courses.forEach((course) => usedCourseKeys.add(getSuggestedCourseKey(course)));
}

function calculateTrailWorkloadHours(
  courses: SuggestedCourse[],
  priority: Priority
): number {
  const total = courses.reduce((sum, course) => {
    const hours = Number(course.workloadHours || 0);
    return sum + (hours > 0 ? hours : 0);
  }, 0);

  return total > 0 ? total : estimatedHoursByPriority(priority);
}

function sortDiagnosticItemsForAllocation(items: DiagnosticItem[]): DiagnosticItem[] {
  const priorityWeight = (priority: Priority) => {
    if (priority === "ALTA") return 3;
    if (priority === "MÉDIA") return 2;
    return 1;
  };

  return [...items].sort((a, b) => {
    const priorityDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    if (b.gap !== a.gap) return b.gap - a.gap;
    return normalizeString(a.competencyName).localeCompare(
      normalizeString(b.competencyName),
      "pt-BR"
    );
  });
}

export async function generateRecommendationsFromDiagnostic(params: {
  db: Firestore | null | undefined;
  items: DiagnosticItem[];
  contextSnapshot?: ContextSnapshot | null;
}): Promise<RecommendationItem[]> {
  const { db, items, contextSnapshot } = params;
  const filtered = sortDiagnosticItemsForAllocation(
    items.filter((item) => item.gap > 0)
  );

  const usedCourseKeys = new Set<string>();
  const recommendations: RecommendationItem[] = [];

  for (const [index, item] of filtered.entries()) {
    const unebRealCourses = await fetchRankedCatalogCourses({
      db,
      axisCode: item.axisCode,
      source: "UNEB",
      maxItems: 3,
      competencyName: item.competencyName,
      axisName: item.axisName,
      contextSnapshot,
      excludedCourseKeys: usedCourseKeys,
    });

    const evgCourses = await fetchRankedCatalogCourses({
      db,
      axisCode: item.axisCode,
      source: "EVG",
      maxItems: 2,
      competencyName: item.competencyName,
      axisName: item.axisName,
      contextSnapshot,
      excludedCourseKeys: usedCourseKeys,
    });

    const institutionalCourses =
      unebRealCourses.length > 0
        ? unebRealCourses
        : buildInstitutionalFallbackCourses(item);

    const institutionalUnique = excludeAlreadyUsedCourses(
      institutionalCourses,
      usedCourseKeys
    );

    const evgUnique = excludeAlreadyUsedCourses(evgCourses, usedCourseKeys);

    const combinedSuggestedCourses = dedupeCourses([
      ...institutionalUnique,
      ...evgUnique,
    ]);

    reserveUsedCourses(combinedSuggestedCourses, usedCourseKeys);

    recommendations.push({
      recommendationId: `rec_${item.axisCode}_${normalizeId(
        item.competencyName || item.competencyId
      )}_${index + 1}`,
      type: "TRILHA" as const,
      title: buildTrailTitle(item, contextSnapshot),
      description: `Percurso sugerido para desenvolver "${item.competencyName}".`,
      linkedCompetencyId: item.competencyId,
      linkedCompetencyName: item.competencyName,
      axisCode: item.axisCode,
      axisName: item.axisName,
      priority: item.priority,
      reason: buildRecommendationReason(item, contextSnapshot),
      estimatedWorkloadHours: calculateTrailWorkloadHours(
        combinedSuggestedCourses,
        item.priority
      ),
      modality: calculateTrailModality(combinedSuggestedCourses, item.priority),
      suggestedCourses: combinedSuggestedCourses,
      microlearningActions: buildMicrolearningActions(item),
      progressStatus: "NAO_INICIADO" as const,
      progressPercent: 0,
      completedCoursesCount: 0,
      totalCoursesCount: combinedSuggestedCourses.length,
      hasRelatedEvidenceOutsideTrail: false,
    });
  }

  return recommendations;
}
