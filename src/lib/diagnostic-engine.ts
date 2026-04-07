import {
  AssessmentCompetency,
  CompletedCourseEvidence,
  DiagnosticItem,
  DiagnosticSummary,
  ExpectedCompetency,
  Priority,
} from "@/types/diagnostic";

export const AXIS_LABELS: Record<string, string> = {
  E1: "Competências Institucionais",
  E2: "Competências Organizacionais e de Gestão Universitária",
  E3: "Competências Técnico-Profissionais",
  E4: "Competências Relacionais e Comunicacionais",
  E5: "Competências para a Formação Continuada",
};

export function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeId(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
}

export function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampLevel(value: number): number {
  if (value < 0) return 0;
  if (value > 5) return 5;
  return value;
}

export function axisNameFromCode(axisCode?: string, axisName?: string): string {
  const code = normalizeText(axisCode).toUpperCase();
  if (axisName && normalizeText(axisName)) return normalizeText(axisName);
  return AXIS_LABELS[code] || "Eixo não informado";
}

export function levelLabel(level: number): string {
  if (level <= 0) return "Não informado";
  return String(level);
}

export function calculateGap(expectedLevel: number, currentLevel: number): number {
  return Math.max(expectedLevel - currentLevel, 0);
}

/**
 * 🔥 REGRA DE PRIORIDADE AJUSTADA
 * Agora baseada diretamente na lacuna (gap),
 * tornando o diagnóstico mais sensível e coerente.
 */
export function calculatePriority(
  expectedLevel: number,
  currentLevel: number,
  gap: number
): Priority {
  if (gap <= 0) return "BAIXA";
  if (gap >= 2) return "ALTA";
  if (gap === 1) return "MÉDIA";
  return "BAIXA";
}

export function calculatePriorityScore(priority: Priority, gap: number): number {
  if (priority === "ALTA") return 90 + Math.min(gap, 2) * 5;
  if (priority === "MÉDIA") return 60 + Math.min(gap, 2) * 5;
  if (gap === 0) return 0;
  return 30;
}

export function calculateEvidenceBonus(evidenceHours: number): number {
  if (evidenceHours >= 60) return 2;
  if (evidenceHours >= 20) return 1;
  return 0;
}

export function buildExplanation(item: {
  competencyName: string;
  axisName: string;
  expectedLevel: number;
  currentLevel: number;
  adjustedCurrentLevel: number;
  evidenceHours: number;
  evidenceBonus: number;
  supportingCoursesCount: number;
  gap: number;
  priority: Priority;
}): string {
  const {
    competencyName,
    axisName,
    expectedLevel,
    currentLevel,
    adjustedCurrentLevel,
    evidenceHours,
    evidenceBonus,
    supportingCoursesCount,
    gap,
    priority,
  } = item;

  const evidenceText =
    evidenceHours > 0
      ? ` O sistema identificou ${supportingCoursesCount} curso(s) vinculado(s) a esta competência, totalizando ${evidenceHours}h e gerando bônus formativo de ${evidenceBonus} nível(is).`
      : " Não foram identificadas evidências formativas registradas para esta competência.";

  if (gap === 0) {
    return `A competência "${competencyName}" (${axisName}) atende ao nível esperado após considerar a autoavaliação (${currentLevel}) e as evidências formativas registradas, resultando em nível ajustado ${adjustedCurrentLevel}.${evidenceText}`;
  }

  if (priority === "ALTA") {
    return `A competência "${competencyName}" (${axisName}) apresenta lacuna crítica. O nível esperado é ${expectedLevel}, a autoavaliação indica ${currentLevel} e o nível ajustado por evidências formativas é ${adjustedCurrentLevel}.${evidenceText} Por isso, a recomendação permanece prioritária.`;
  }

  if (priority === "MÉDIA") {
    return `A competência "${competencyName}" (${axisName}) apresenta lacuna relevante. O nível esperado é ${expectedLevel}, a autoavaliação indica ${currentLevel} e o nível ajustado por evidências formativas é ${adjustedCurrentLevel}.${evidenceText} Recomenda-se continuidade do desenvolvimento.`;
  }

  return `A competência "${competencyName}" (${axisName}) apresenta lacuna de menor intensidade. O nível esperado é ${expectedLevel}, a autoavaliação indica ${currentLevel} e o nível ajustado por evidências formativas é ${adjustedCurrentLevel}.${evidenceText}`;
}

export function normalizeExpectedProfile(raw: any): ExpectedCompetency[] {
  const source =
    raw?.competencies ||
    raw?.expectedProfile ||
    raw?.profile ||
    raw?.items ||
    raw?.expectedCompetencies ||
    [];

  const list = Array.isArray(source) ? source : [];

  return list
    .map((item: any) => {
      const competencyName =
        normalizeText(item?.competencyName) ||
        normalizeText(item?.name) ||
        normalizeText(item?.competencia) ||
        normalizeText(item?.title);

      if (!competencyName) return null;

      const competencyId =
        normalizeText(item?.competencyId) ||
        normalizeText(item?.id) ||
        normalizeText(item?.competenciaId) ||
        normalizeId(competencyName);

      const axisCode =
        normalizeText(item?.axisCode) ||
        normalizeText(item?.axis) ||
        normalizeText(item?.eixoCode) ||
        normalizeText(item?.eixo) ||
        "E3";

      const axisName = axisNameFromCode(
        axisCode,
        normalizeText(item?.axisName) || normalizeText(item?.eixoNome)
      );

      const expectedLevel = clampLevel(
        safeNumber(
          item?.expectedLevel ??
            item?.requiredLevel ??
            item?.nivelEsperado ??
            item?.targetLevel,
          0
        )
      );

      return {
        competencyId,
        competencyName,
        axisCode: axisCode.toUpperCase(),
        axisName,
        expectedLevel,
      } as ExpectedCompetency;
    })
    .filter(Boolean) as ExpectedCompetency[];
}

export function normalizeAssessment(raw: any): AssessmentCompetency[] {
  const source =
    raw?.competencies ||
    raw?.responses ||
    raw?.assessment ||
    raw?.autoAssessment ||
    raw?.items ||
    [];

  const list = Array.isArray(source) ? source : [];

  return list
    .map((item: any) => {
      const competencyName =
        normalizeText(item?.competencyName) ||
        normalizeText(item?.name) ||
        normalizeText(item?.competencia) ||
        normalizeText(item?.title);

      const competencyId =
        normalizeText(item?.competencyId) ||
        normalizeText(item?.id) ||
        normalizeText(item?.competenciaId) ||
        normalizeId(competencyName);

      if (!competencyId && !competencyName) return null;

      const axisCode =
        normalizeText(item?.axisCode) ||
        normalizeText(item?.axis) ||
        normalizeText(item?.eixoCode) ||
        normalizeText(item?.eixo);

      const axisName = axisNameFromCode(
        axisCode,
        normalizeText(item?.axisName) || normalizeText(item?.eixoNome)
      );

      const currentLevel = clampLevel(
        safeNumber(
          item?.currentLevel ??
            item?.selfLevel ??
            item?.level ??
            item?.nivelAtual ??
            item?.nivel,
          0
        )
      );

      return {
        competencyId: competencyId || normalizeId(competencyName),
        competencyName: competencyName || competencyId,
        axisCode: axisCode ? axisCode.toUpperCase() : undefined,
        axisName: axisName || undefined,
        currentLevel,
      } as AssessmentCompetency;
    })
    .filter(Boolean) as AssessmentCompetency[];
}

export function normalizeCompletedCourses(rawList: any[]): CompletedCourseEvidence[] {
  if (!Array.isArray(rawList)) return [];

  return rawList.map((item: any) => ({
    id: item?.id,
    name: normalizeText(item?.name),
    hours: safeNumber(item?.hours, 0),
    linkedCompetencyId: normalizeText(item?.linkedCompetencyId) || null,
    linkedCompetencyName: normalizeText(item?.linkedCompetencyName) || null,
    axisCode: normalizeText(item?.axisCode) || null,
    axisName: normalizeText(item?.axisName) || null,
    sourceRecommendationId: normalizeText(item?.sourceRecommendationId) || null,
    sourceRecommendationTitle: normalizeText(item?.sourceRecommendationTitle) || null,
    recognizedBySystem: !!item?.recognizedBySystem,
  }));
}

export function buildDiagnosis(
  expectedProfile: ExpectedCompetency[],
  assessment: AssessmentCompetency[],
  completedCourses: CompletedCourseEvidence[] = []
): DiagnosticItem[] {
  const assessmentMap = new Map<string, AssessmentCompetency>();

  for (const item of assessment) {
    const idKey = normalizeId(item.competencyId);
    const nameKey = normalizeId(item.competencyName);

    if (idKey) assessmentMap.set(idKey, item);
    if (nameKey) assessmentMap.set(nameKey, item);
  }

  const evidenceMap = new Map<
    string,
    { hours: number; count: number }
  >();

  for (const course of completedCourses) {
    const keys = [
      normalizeId(course.linkedCompetencyId || ""),
      normalizeId(course.linkedCompetencyName || ""),
    ].filter(Boolean);

    if (!keys.length) continue;

    for (const key of keys) {
      const current = evidenceMap.get(key) || { hours: 0, count: 0 };
      current.hours += safeNumber(course.hours, 0);
      current.count += 1;
      evidenceMap.set(key, current);
    }
  }

  const items = expectedProfile.map((expected) => {
    const match =
      assessmentMap.get(normalizeId(expected.competencyId)) ||
      assessmentMap.get(normalizeId(expected.competencyName));

    const evidence =
      evidenceMap.get(normalizeId(expected.competencyId)) ||
      evidenceMap.get(normalizeId(expected.competencyName)) || {
        hours: 0,
        count: 0,
      };

    const currentLevel = clampLevel(match?.currentLevel ?? 0);
    const evidenceBonus = calculateEvidenceBonus(evidence.hours);
    const adjustedCurrentLevel = clampLevel(currentLevel + evidenceBonus);
    const gap = calculateGap(expected.expectedLevel, adjustedCurrentLevel);
    const priority = calculatePriority(expected.expectedLevel, adjustedCurrentLevel, gap);
    const priorityScore = calculatePriorityScore(priority, gap);

    return {
      competencyId: expected.competencyId,
      competencyName: expected.competencyName,
      axisCode: expected.axisCode,
      axisName: expected.axisName,
      expectedLevel: expected.expectedLevel,
      currentLevel,
      adjustedCurrentLevel,
      evidenceHours: evidence.hours,
      evidenceBonus,
      supportingCoursesCount: evidence.count,
      gap,
      priority,
      priorityScore,
      explanation: buildExplanation({
        competencyName: expected.competencyName,
        axisName: expected.axisName,
        expectedLevel: expected.expectedLevel,
        currentLevel,
        adjustedCurrentLevel,
        evidenceHours: evidence.hours,
        evidenceBonus,
        supportingCoursesCount: evidence.count,
        gap,
        priority,
      }),
      developmentNeed: gap > 0,
    } as DiagnosticItem;
  });

  const priorityOrder: Record<Priority, number> = {
    ALTA: 0,
    MÉDIA: 1,
    BAIXA: 2,
  };

  return items.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (b.gap !== a.gap) return b.gap - a.gap;
    return a.competencyName.localeCompare(b.competencyName, "pt-BR");
  });
}

export function summarize(items: DiagnosticItem[]): DiagnosticSummary {
  const totalCompetencies = items.length;
  const competenciesWithGap = items.filter((item) => item.gap > 0).length;
  const highPriorityCount = items.filter((item) => item.priority === "ALTA").length;
  const mediumPriorityCount = items.filter((item) => item.priority === "MÉDIA").length;
  const lowPriorityCount = items.filter((item) => item.priority === "BAIXA").length;
  const evidenceBackedCompetencies = items.filter((item) => item.evidenceHours > 0).length;

  const totalExpected = items.reduce((sum, item) => sum + item.expectedLevel, 0);
  const totalCurrent = items.reduce((sum, item) => sum + item.currentLevel, 0);
  const totalAdjustedCurrent = items.reduce(
    (sum, item) => sum + item.adjustedCurrentLevel,
    0
  );

  const averageExpectedLevel =
    totalCompetencies > 0 ? Number((totalExpected / totalCompetencies).toFixed(2)) : 0;

  const averageCurrentLevel =
    totalCompetencies > 0 ? Number((totalCurrent / totalCompetencies).toFixed(2)) : 0;

  const averageAdjustedCurrentLevel =
    totalCompetencies > 0
      ? Number((totalAdjustedCurrent / totalCompetencies).toFixed(2))
      : 0;

  const adherencePercent =
    averageExpectedLevel > 0
      ? Math.round((averageAdjustedCurrentLevel / averageExpectedLevel) * 100)
      : 0;

  return {
    totalCompetencies,
    competenciesWithGap,
    highPriorityCount,
    mediumPriorityCount,
    lowPriorityCount,
    averageExpectedLevel,
    averageCurrentLevel,
    averageAdjustedCurrentLevel,
    adherencePercent,
    evidenceBackedCompetencies,
  };
}