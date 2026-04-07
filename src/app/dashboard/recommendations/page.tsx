"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock3,
  ExternalLink,
  GraduationCap,
  Lightbulb,
  Loader2,
  RefreshCw,
  Route,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";
import type {
  DiagnosticDocument,
  DiagnosticItem,
  Priority,
} from "@/types/diagnostic";
import type {
  ProgressStatus,
  RecommendationItem,
  SuggestedCourse,
} from "@/lib/recommendation-engine-v2";
import { generateRecommendationItemsForUser } from "@/lib/recommendation-service";

type FeedbackType = "POSITIVA" | "NEGATIVA";

type RecommendationSummary = {
  totalRecommendations: number;
  highPriorityRecommendations: number;
  mediumPriorityRecommendations: number;
  lowPriorityRecommendations: number;
};

type RecommendationDocument = {
  userId: string;
  generatedAt?: unknown;
  version: string;
  source: string;
  diagnosticRef: string;
  summary: RecommendationSummary;
  recommendations: RecommendationItem[];
};

type RecommendationFeedbackDocument = {
  recommendationId: string;
  feedbackType: FeedbackType;
  recommendationTitle?: string;
  linkedCompetencyId?: string;
  linkedCompetencyName?: string;
  axisCode?: string;
  axisName?: string;
  priority?: Priority;
  updatedAt?: unknown;
};

type ExpectedProfileCompetency = {
  competencyId: string;
  competencyName?: string;
  competencyAxis?: string;
  axisCode?: string;
  axisName?: string;
  expectedLevel: number;
};

type AssessmentStoredItem = {
  competencyId?: string;
  id?: string;
  competenciaId?: string;
  competencyName?: string;
  competencyAxis?: string;
  expectedLevel?: number;
  currentLevel?: number | null;
  level?: number | null;
  nivelAtual?: number | null;
};

type CompletedCourseDoc = {
  id: string;
  name?: string;
  date?: string;
  hours?: number;
  certificateUrl?: string | null;
  linkedCompetencyId?: string | null;
  linkedCompetencyName?: string | null;
  axisCode?: string | null;
  axisName?: string | null;
  sourceRecommendationId?: string | null;
  sourceRecommendationTitle?: string | null;
  recognizedBySystem?: boolean;
};

function priorityBadgeVariant(
  priority: Priority
): "destructive" | "secondary" | "outline" {
  if (priority === "ALTA") return "destructive";
  if (priority === "MÉDIA") return "secondary";
  return "outline";
}

function getSimplePriorityLabel(priority: Priority): string {
  if (priority === "ALTA") return "Atenção agora";
  if (priority === "MÉDIA") return "Importante";
  return "Pode fazer aos poucos";
}

function getProgressStatusLabel(status: ProgressStatus): string {
  if (status === "EM_DESENVOLVIMENTO") return "Em andamento";
  if (status === "AGUARDANDO_REAVALIACAO") return "Concluída";
  return "Para começar";
}

function getProgressPillClass(status: ProgressStatus): string {
  if (status === "EM_DESENVOLVIMENTO") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "AGUARDANDO_REAVALIACAO") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  return "border-sky-200 bg-sky-50 text-sky-800";
}

function getProgressBarClass(status: ProgressStatus): string {
  if (status === "EM_DESENVOLVIMENTO") return "bg-amber-500";
  if (status === "AGUARDANDO_REAVALIACAO") return "bg-emerald-600";
  return "bg-sky-500";
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

function axisNameFromCode(axisCode: string): string {
  const axis = normalizeString(axisCode).toUpperCase();

  if (axis === "E1") return "Comunicação institucional";
  if (axis === "E2") return "Trabalho em equipe";
  if (axis === "E3") return "Ética e responsabilidade pública";
  if (axis === "E4") return "Inovação e melhoria de processos";
  if (axis === "E5") return "Planejamento e gestão do trabalho";

  return axis || "Competências profissionais";
}

function getPriorityFromGap(gap: number): Priority {
  if (gap >= 2) return "ALTA";
  if (gap === 1) return "MÉDIA";
  return "BAIXA";
}

function toDiagnosticItems(params: {
  expectedProfile: ExpectedProfileCompetency[];
  assessmentItems: AssessmentStoredItem[];
}): DiagnosticItem[] {
  const { expectedProfile, assessmentItems } = params;

  const assessmentMap = new Map<string, AssessmentStoredItem>();

  for (const item of assessmentItems) {
    const competencyId = normalizeString(
      item?.competencyId ?? item?.id ?? item?.competenciaId
    );
    if (!competencyId) continue;
    assessmentMap.set(normalizeLookup(competencyId), item);
  }

  return expectedProfile.map((comp) => {
    const saved = assessmentMap.get(normalizeLookup(comp.competencyId));

    const currentLevelRaw =
      saved?.currentLevel ?? saved?.level ?? saved?.nivelAtual ?? 0;

    const currentLevel =
      currentLevelRaw == null || currentLevelRaw === ""
        ? 0
        : Number(currentLevelRaw) || 0;

    const expectedLevel = Number(comp.expectedLevel) || 0;
    const gap = Math.max(expectedLevel - currentLevel, 0);

    const axisCode =
      normalizeString(comp.competencyAxis || comp.axisCode).toUpperCase() || "E1";

    const axisName =
      normalizeString(comp.axisName) || axisNameFromCode(axisCode);

    return {
      competencyId: comp.competencyId,
      competencyName: normalizeString(comp.competencyName) || comp.competencyId,
      axisCode,
      axisName,
      expectedLevel,
      currentLevel,
      gap,
      priority: getPriorityFromGap(gap),
    } as DiagnosticItem;
  });
}

async function ensureDiagnosticDocument(
  db: ReturnType<typeof useFirestore>,
  uid: string
): Promise<DiagnosticDocument | null> {
  const diagnosticRef = doc(db, "users", uid, "diagnostics", "current");
  const diagnosticSnap = await getDoc(diagnosticRef);

  if (diagnosticSnap.exists()) {
    return diagnosticSnap.data() as DiagnosticDocument;
  }

  const expectedProfileRef = doc(db, "users", uid, "context", "expectedProfile");
  const assessmentRef = doc(db, "users", uid, "assessment", "competencies");
  const contextRef = doc(db, "users", uid, "context", "professionalContext");

  const [expectedProfileSnap, assessmentSnap, contextSnap] = await Promise.all([
    getDoc(expectedProfileRef),
    getDoc(assessmentRef),
    getDoc(contextRef),
  ]);

  if (!expectedProfileSnap.exists() || !assessmentSnap.exists()) {
    return null;
  }

  const expectedProfileData = expectedProfileSnap.data() as Record<string, any>;
  const assessmentData = assessmentSnap.data() as Record<string, any>;
  const contextData = contextSnap.exists()
    ? (contextSnap.data() as Record<string, any>)
    : null;

  const expectedProfile = Array.isArray(expectedProfileData?.competencies)
    ? (expectedProfileData.competencies as ExpectedProfileCompetency[])
    : [];

  const assessmentItems = Array.isArray(assessmentData?.items)
    ? (assessmentData.items as AssessmentStoredItem[])
    : [];

  if (!expectedProfile.length || !assessmentItems.length) {
    return null;
  }

  const items = toDiagnosticItems({
    expectedProfile,
    assessmentItems,
  });

  const diagnosticPayload: DiagnosticDocument = {
    userId: uid,
    version: "1.1",
    generatedAt: new Date().toISOString(),
    source: "auto_generated_from_expectedProfile_and_assessment",
    diagnosticRef: `users/${uid}/diagnostics/current`,
    items,
    summary: {
      totalCompetencies: items.length,
      withGap: items.filter((item) => item.gap > 0).length,
      highPriority: items.filter((item) => item.priority === "ALTA").length,
      mediumPriority: items.filter((item) => item.priority === "MÉDIA").length,
      lowPriority: items.filter((item) => item.priority === "BAIXA").length,
    },
    contextSnapshot: {
      unitId:
        contextData?.unitId ||
        contextData?.unidadeId ||
        expectedProfileData?.unitId ||
        expectedProfileData?.unidadeId ||
        "",
      sectorId:
        contextData?.sectorId ||
        contextData?.setorId ||
        expectedProfileData?.sectorId ||
        expectedProfileData?.setorId ||
        "",
      roleId:
        contextData?.roleId ||
        contextData?.funcaoFormalId ||
        expectedProfileData?.roleId ||
        expectedProfileData?.funcaoFormalId ||
        "",
      unitName:
        contextData?.unitName ||
        contextData?.unidadeNome ||
        expectedProfileData?.unitName ||
        expectedProfileData?.unidadeNome ||
        "",
      sectorName:
        contextData?.sectorName ||
        contextData?.setorNome ||
        expectedProfileData?.sectorName ||
        expectedProfileData?.setorNome ||
        "",
      roleName:
        contextData?.roleName ||
        contextData?.funcaoNome ||
        expectedProfileData?.roleName ||
        expectedProfileData?.funcaoNome ||
        "",
    },
  } as DiagnosticDocument;

  await setDoc(
    diagnosticRef,
    {
      ...diagnosticPayload,
      generatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const newSnap = await getDoc(diagnosticRef);
  return newSnap.exists() ? (newSnap.data() as DiagnosticDocument) : null;
}

async function fetchCompletedCourses(
  db: ReturnType<typeof useFirestore>,
  uid: string
): Promise<CompletedCourseDoc[]> {
  if (!db || !uid) return [];

  try {
    const snap = await getDocs(collection(db, "users", uid, "completedCourses"));

    return snap.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, any>;

      return {
        id: docSnap.id,
        name: data?.name || "",
        date: data?.date || "",
        hours: Number(data?.hours || 0),
        certificateUrl: data?.certificateUrl || null,
        linkedCompetencyId: data?.linkedCompetencyId || null,
        linkedCompetencyName: data?.linkedCompetencyName || null,
        axisCode: data?.axisCode || null,
        axisName: data?.axisName || null,
        sourceRecommendationId: data?.sourceRecommendationId || null,
        sourceRecommendationTitle: data?.sourceRecommendationTitle || null,
        recognizedBySystem: !!data?.recognizedBySystem,
      };
    });
  } catch (error) {
    console.error("Erro ao carregar cursos realizados:", error);
    return [];
  }
}

function titlesMatch(a?: string | null, b?: string | null): boolean {
  const aa = normalizeLookup(a);
  const bb = normalizeLookup(b);

  if (!aa || !bb) return false;

  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function getMatchedTrailCourseIds(
  recommendation: RecommendationItem,
  completedCourses: CompletedCourseDoc[]
): string[] {
  const matched = new Set<string>();

  for (const course of completedCourses) {
    const sameRecommendationId =
      normalizeLookup(course.sourceRecommendationId) ===
      normalizeLookup(recommendation.recommendationId);

    const sameRecommendationTitle = titlesMatch(
      course.sourceRecommendationTitle,
      recommendation.title
    );

    if (sameRecommendationId || sameRecommendationTitle) {
      matched.add(course.id);
      continue;
    }

    const sameCompetencyId =
      normalizeLookup(course.linkedCompetencyId) ===
      normalizeLookup(recommendation.linkedCompetencyId);

    const sameCompetencyName =
      normalizeLookup(course.linkedCompetencyName) ===
      normalizeLookup(recommendation.linkedCompetencyName);

    const sameCompetency = sameCompetencyId || sameCompetencyName;

    if (!sameCompetency) continue;

    const matchesSuggestedTitle = recommendation.suggestedCourses.some(
      (suggested) => titlesMatch(course.name, suggested.title)
    );

    if (matchesSuggestedTitle) {
      matched.add(course.id);
    }
  }

  return Array.from(matched);
}

function hasRelatedEvidenceOutsideTrail(
  recommendation: RecommendationItem,
  completedCourses: CompletedCourseDoc[],
  matchedIds: string[]
): boolean {
  const matchedSet = new Set(matchedIds);

  return completedCourses.some((course) => {
    if (matchedSet.has(course.id)) return false;

    const sameCompetencyId =
      normalizeLookup(course.linkedCompetencyId) ===
      normalizeLookup(recommendation.linkedCompetencyId);

    const sameCompetencyName =
      normalizeLookup(course.linkedCompetencyName) ===
      normalizeLookup(recommendation.linkedCompetencyName);

    return sameCompetencyId || sameCompetencyName;
  });
}

function applyProgressFromCompletedCourses(
  recommendations: RecommendationItem[],
  completedCourses: CompletedCourseDoc[]
): RecommendationItem[] {
  return recommendations.map((item) => {
    const totalCoursesCount = item.suggestedCourses.length;
    const matchedIds = getMatchedTrailCourseIds(item, completedCourses);
    const completedCoursesCount = matchedIds.length;
    const relatedOutsideTrail = hasRelatedEvidenceOutsideTrail(
      item,
      completedCourses,
      matchedIds
    );

    let progressStatus: ProgressStatus = "NAO_INICIADO";

    if (totalCoursesCount > 0 && completedCoursesCount >= totalCoursesCount) {
      progressStatus = "AGUARDANDO_REAVALIACAO";
    } else if (completedCoursesCount > 0 || relatedOutsideTrail) {
      progressStatus = "EM_DESENVOLVIMENTO";
    }

    let progressPercent = 0;

    if (totalCoursesCount > 0) {
      progressPercent = Math.min(
        100,
        Math.round((completedCoursesCount / totalCoursesCount) * 100)
      );
    } else if (progressStatus === "AGUARDANDO_REAVALIACAO") {
      progressPercent = 100;
    } else if (progressStatus === "EM_DESENVOLVIMENTO") {
      progressPercent = 50;
    }

    return {
      ...item,
      progressStatus,
      progressPercent,
      completedCoursesCount,
      totalCoursesCount,
      hasRelatedEvidenceOutsideTrail: relatedOutsideTrail,
    };
  });
}

function buildSummary(
  recommendations: RecommendationItem[]
): RecommendationSummary {
  return {
    totalRecommendations: recommendations.length,
    highPriorityRecommendations: recommendations.filter(
      (r) => r.priority === "ALTA"
    ).length,
    mediumPriorityRecommendations: recommendations.filter(
      (r) => r.priority === "MÉDIA"
    ).length,
    lowPriorityRecommendations: recommendations.filter(
      (r) => r.priority === "BAIXA"
    ).length,
  };
}

function formatCourseMetadata(course: SuggestedCourse): string {
  const parts: string[] = [];

  if (course.workloadHours && course.workloadHours > 0) {
    parts.push(`${course.workloadHours}h`);
  }

  if (course.modality) {
    parts.push(course.modality.toUpperCase());
  }

  return parts.join(" • ");
}

function getMainActionText(item: RecommendationItem): string {
  if (item.progressStatus === "AGUARDANDO_REAVALIACAO") {
    return "Sua trilha foi concluída. Agora você pode revisar sua autoavaliação.";
  }

  if (item.completedCoursesCount > 0) {
    return `Você já concluiu ${item.completedCoursesCount} de ${item.totalCoursesCount} cursos. Continue a trilha.`;
  }

  if (item.hasRelatedEvidenceOutsideTrail) {
    return "Você já começou esse desenvolvimento. Agora vale iniciar esta trilha.";
  }

  return "Comece pelo primeiro curso da trilha.";
}

function getFriendlyProgressText(item: RecommendationItem): string {
  if (item.progressStatus === "AGUARDANDO_REAVALIACAO") {
    return "Trilha concluída";
  }

  if (item.completedCoursesCount > 0) {
    return `${item.completedCoursesCount} de ${item.totalCoursesCount} cursos concluídos`;
  }

  if (item.hasRelatedEvidenceOutsideTrail) {
    return "Você já tem curso relacionado a este tema";
  }

  return "Você ainda não começou esta trilha";
}

function getNextCourse(item: RecommendationItem): SuggestedCourse | null {
  if (!item.suggestedCourses.length) return null;

  const index = Math.min(
    item.completedCoursesCount,
    item.suggestedCourses.length - 1
  );
  return item.suggestedCourses[index] || item.suggestedCourses[0];
}

function mergeCurrentAndPreviousRecommendations(params: {
  currentRecommendations: RecommendationItem[];
  previousRecommendations: RecommendationItem[];
}): RecommendationItem[] {
  const { currentRecommendations, previousRecommendations } = params;

  const currentMap = new Map<string, RecommendationItem>();
  currentRecommendations.forEach((item) => {
    currentMap.set(item.recommendationId, item);
  });

  const preserved = previousRecommendations.filter((item) => {
    if (currentMap.has(item.recommendationId)) return false;

    return (
      item.completedCoursesCount > 0 ||
      item.progressStatus === "EM_DESENVOLVIMENTO" ||
      item.progressStatus === "AGUARDANDO_REAVALIACAO" ||
      item.hasRelatedEvidenceOutsideTrail
    );
  });

  const merged = [...currentRecommendations, ...preserved];

  const unique = new Map<string, RecommendationItem>();
  merged.forEach((item) => {
    unique.set(item.recommendationId, item);
  });

  return Array.from(unique.values());
}

function sortRecommendations(items: RecommendationItem[]): RecommendationItem[] {
  const priorityOrder: Record<Priority, number> = {
    ALTA: 0,
    MÉDIA: 1,
    BAIXA: 2,
  };

  const statusOrder: Record<ProgressStatus, number> = {
    NAO_INICIADO: 0,
    EM_DESENVOLVIMENTO: 1,
    AGUARDANDO_REAVALIACAO: 2,
  };

  return [...items].sort((a, b) => {
    const pa = priorityOrder[a.priority];
    const pb = priorityOrder[b.priority];

    if (pa !== pb) return pa - pb;

    const sa = statusOrder[a.progressStatus];
    const sb = statusOrder[b.progressStatus];

    if (sa !== sb) return sa - sb;

    return a.title.localeCompare(b.title, "pt-BR");
  });
}

function RecommendationSection({
  title,
  subtitle,
  icon,
  items,
  feedbacks,
  feedbackLoadingId,
  onFeedback,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  items: RecommendationItem[];
  feedbacks: Record<string, FeedbackType>;
  feedbackLoadingId: string | null;
  onFeedback: (item: RecommendationItem, feedbackType: FeedbackType) => void;
}) {
  if (!items.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border bg-white/80 p-4 shadow-sm">
        <div className="mt-0.5 rounded-2xl bg-primary/10 p-2 text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {items.map((item) => {
          const nextCourse = getNextCourse(item);
          const selectedFeedback = feedbacks[item.recommendationId];
          const trailSteps = item.suggestedCourses;

          return (
            <Card
              key={item.recommendationId}
              className="overflow-hidden rounded-3xl border-border/80 shadow-sm transition hover:shadow-md"
            >
              <CardHeader className="bg-gradient-to-r from-white to-slate-50">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Route className="h-5 w-5 text-primary" />
                      <CardTitle className="text-xl">{item.title}</CardTitle>
                    </div>

                    <CardDescription className="text-sm leading-relaxed">
                      {item.reason}
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={priorityBadgeVariant(item.priority)}>
                      {getSimplePriorityLabel(item.priority)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getProgressPillClass(item.progressStatus)}
                    >
                      {getProgressStatusLabel(item.progressStatus)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 p-6">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Competência foco
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {item.linkedCompetencyName}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Carga horária da trilha
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {item.estimatedWorkloadHours} horas
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Modalidade
                    </p>
                    <p className="mt-2 text-sm font-semibold capitalize">
                      {item.modality}
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Situação
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      {getProgressStatusLabel(item.progressStatus)}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">O que fazer agora</p>
                  </div>

                  <p className="mt-3 text-sm text-slate-700">
                    {getMainActionText(item)}
                  </p>

                  {nextCourse &&
                    item.progressStatus !== "AGUARDANDO_REAVALIACAO" && (
                      <div className="mt-4 rounded-2xl border bg-white p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Próximo curso sugerido
                        </p>
                        <p className="mt-2 text-sm font-semibold">
                          {nextCourse.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {nextCourse.description}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {formatCourseMetadata(nextCourse) && (
                            <Badge variant="outline">
                              {formatCourseMetadata(nextCourse)}
                            </Badge>
                          )}

                          <Badge variant="secondary">
                            {nextCourse.source === "UNEB" ? "UNEB" : "EVG"}
                          </Badge>

                          <Button
                            type="button"
                            size="sm"
                            className="rounded-xl"
                            disabled={!nextCourse.url}
                            onClick={() => {
                              if (nextCourse.url) {
                                window.open(
                                  nextCourse.url,
                                  "_blank",
                                  "noopener,noreferrer"
                                );
                              }
                            }}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Acessar curso
                          </Button>
                        </div>
                      </div>
                    )}
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Seu avanço</p>
                    <p className="text-xs text-muted-foreground">
                      {getFriendlyProgressText(item)}
                    </p>
                  </div>

                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${getProgressBarClass(
                        item.progressStatus
                      )}`}
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.progressStatus === "AGUARDANDO_REAVALIACAO"
                      ? "100% da trilha concluída"
                      : item.completedCoursesCount > 0
                      ? `${item.progressPercent}% da trilha concluída`
                      : item.hasRelatedEvidenceOutsideTrail
                      ? "Você já avançou neste tema, mas ainda não iniciou os cursos desta trilha"
                      : "Trilha ainda não iniciada"}
                  </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-rose-700" />
                      <p className="text-sm font-semibold text-rose-900">
                        Etapas da trilha
                      </p>
                    </div>

                    <div className="mt-3 space-y-3">
                      {trailSteps.length > 0 ? (
                        trailSteps.map((course, index) => (
                          <div
                            key={course.id}
                            className="relative rounded-2xl border border-rose-100 bg-white p-4"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">
                                {index + 1}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold">
                                      {course.title}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {course.description}
                                    </p>
                                  </div>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl md:shrink-0"
                                    disabled={!course.url}
                                    onClick={() => {
                                      if (course.url) {
                                        window.open(
                                          course.url,
                                          "_blank",
                                          "noopener,noreferrer"
                                        );
                                      }
                                    }}
                                  >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Acessar curso
                                  </Button>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {formatCourseMetadata(course) && (
                                    <Badge variant="outline">
                                      {formatCourseMetadata(course)}
                                    </Badge>
                                  )}

                                  <Badge variant="secondary">
                                    {course.source === "UNEB" ? "UNEB" : "EVG"}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {index < trailSteps.length - 1 && (
                              <div className="pointer-events-none absolute left-8 top-12 h-6 w-px bg-rose-200" />
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-rose-200 bg-white p-4 text-sm text-muted-foreground">
                          Nenhuma etapa definida para esta trilha no momento.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-700" />
                      <p className="text-sm font-semibold text-amber-900">
                        Ações rápidas
                      </p>
                    </div>

                    <div className="mt-3 space-y-3">
                      {item.microlearningActions.map((action) => (
                        <div
                          key={action.id}
                          className="rounded-2xl border border-amber-100 bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">
                              {action.title}
                            </p>
                            <Badge variant="outline">
                              <Clock3 className="mr-1 h-3.5 w-3.5" />
                              {action.estimatedMinutes} min
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {action.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm font-semibold">Essa trilha foi útil?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sua resposta ajuda a melhorar as próximas recomendações.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant={
                        selectedFeedback === "POSITIVA" ? "default" : "outline"
                      }
                      onClick={() => onFeedback(item, "POSITIVA")}
                      disabled={feedbackLoadingId === item.recommendationId}
                      className="rounded-xl"
                    >
                      {feedbackLoadingId === item.recommendationId &&
                      selectedFeedback !== "NEGATIVA" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="mr-2 h-4 w-4" />
                      )}
                      Sim
                    </Button>

                    <Button
                      type="button"
                      variant={
                        selectedFeedback === "NEGATIVA"
                          ? "destructive"
                          : "outline"
                      }
                      onClick={() => onFeedback(item, "NEGATIVA")}
                      disabled={feedbackLoadingId === item.recommendationId}
                      className="rounded-xl"
                    >
                      {feedbackLoadingId === item.recommendationId &&
                      selectedFeedback !== "POSITIVA" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ThumbsDown className="mr-2 h-4 w-4" />
                      )}
                      Não
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default function RecommendationsPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCompetencyParam = searchParams.get("competencia") || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [diagnostic, setDiagnostic] = useState<DiagnosticDocument | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    []
  );
  const [feedbacks, setFeedbacks] = useState<Record<string, FeedbackType>>({});
  const [feedbackLoadingId, setFeedbackLoadingId] = useState<string | null>(
    null
  );
  const [lastGeneratedAt, setLastGeneratedAt] = useState("");

  const filteredRecommendations = useMemo(() => {
    if (!selectedCompetencyParam) return recommendations;

    const selected = normalizeLookup(selectedCompetencyParam);

    const filtered = recommendations.filter((item) => {
      return (
        normalizeLookup(item.linkedCompetencyId) === selected ||
        normalizeLookup(item.linkedCompetencyName) === selected
      );
    });

    if (filtered.length === 0) {
      console.warn(
        "⚠️ Filtro de competência não encontrou resultados. Exibindo todas as recomendações."
      );
      return recommendations;
    }

    return filtered;
  }, [recommendations, selectedCompetencyParam]);

  const selectedCompetencyName = useMemo(() => {
    if (!selectedCompetencyParam) return "";

    const found = filteredRecommendations.find(
      (item) =>
        normalizeLookup(item.linkedCompetencyId) ===
          normalizeLookup(selectedCompetencyParam) ||
        normalizeLookup(item.linkedCompetencyName) ===
          normalizeLookup(selectedCompetencyParam)
    );

    if (found) return found.linkedCompetencyName;

    const foundInAll = recommendations.find(
      (item) =>
        normalizeLookup(item.linkedCompetencyId) ===
          normalizeLookup(selectedCompetencyParam) ||
        normalizeLookup(item.linkedCompetencyName) ===
          normalizeLookup(selectedCompetencyParam)
    );

    return foundInAll?.linkedCompetencyName || selectedCompetencyParam;
  }, [filteredRecommendations, recommendations, selectedCompetencyParam]);

  const summary = useMemo(
    () => buildSummary(filteredRecommendations),
    [filteredRecommendations]
  );

  const sections = useMemo(() => {
    const sorted = sortRecommendations(filteredRecommendations);

    return {
      now: sorted.filter((item) => item.progressStatus === "NAO_INICIADO"),
      doing: sorted.filter(
        (item) => item.progressStatus === "EM_DESENVOLVIMENTO"
      ),
      done: sorted.filter(
        (item) => item.progressStatus === "AGUARDANDO_REAVALIACAO"
      ),
    };
  }, [filteredRecommendations]);

  const loadFeedbacks = useCallback(async () => {
    if (!db || !user) return;

    try {
      const feedbackCollectionRef = collection(
        db,
        "users",
        user.uid,
        "recommendationFeedback"
      );

      const feedbackSnap = await getDocs(feedbackCollectionRef);
      const feedbackMap: Record<string, FeedbackType> = {};

      feedbackSnap.forEach((docSnap) => {
        const data = docSnap.data() as RecommendationFeedbackDocument;
        if (data?.recommendationId && data?.feedbackType) {
          feedbackMap[data.recommendationId] = data.feedbackType;
        }
      });

      setFeedbacks(feedbackMap);
    } catch (error) {
      console.error("Erro ao carregar feedbacks das recomendações:", error);
    }
  }, [db, user]);

  const handleFeedback = useCallback(
    async (item: RecommendationItem, feedbackType: FeedbackType) => {
      if (!db || !user) return;

      setFeedbackLoadingId(item.recommendationId);

      try {
        await setDoc(
          doc(
            db,
            "users",
            user.uid,
            "recommendationFeedback",
            item.recommendationId
          ),
          {
            recommendationId: item.recommendationId,
            feedbackType,
            recommendationTitle: item.title,
            linkedCompetencyId: item.linkedCompetencyId,
            linkedCompetencyName: item.linkedCompetencyName,
            axisCode: item.axisCode,
            axisName: item.axisName,
            priority: item.priority,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setFeedbacks((prev) => ({
          ...prev,
          [item.recommendationId]: feedbackType,
        }));
      } catch (error) {
        console.error("Erro ao salvar feedback da recomendação:", error);
      } finally {
        setFeedbackLoadingId(null);
      }
    },
    [db, user]
  );

  const loadRecommendations = useCallback(async () => {
    if (!db || !user) return;

    setLoading(true);
    setSaving(true);
    setErrorMessage("");

    try {
      const diagnosticData = await ensureDiagnosticDocument(db, user.uid);

      if (!diagnosticData) {
        setDiagnostic(null);
        setRecommendations([]);
        setErrorMessage(
          "Ainda não foi possível montar suas trilhas. Salve sua autoavaliação para gerar as recomendações."
        );
        return;
      }

      setDiagnostic(diagnosticData);

      const previousRecommendationsRef = doc(
        db,
        "users",
        user.uid,
        "recommendations",
        "current"
      );

      const previousRecommendationsSnap = await getDoc(previousRecommendationsRef);
      const previousRecommendations = previousRecommendationsSnap.exists()
        ? (
            (previousRecommendationsSnap.data() as RecommendationDocument)
              ?.recommendations || []
          )
        : [];

      const generatedRecommendations = await generateRecommendationItemsForUser(
        db,
        user.uid
      );

      console.log("DEBUG FRONT SERVICE GENERATED:", generatedRecommendations);

      const completedCourses = await fetchCompletedCourses(db, user.uid);

      const currentWithProgress = applyProgressFromCompletedCourses(
        generatedRecommendations,
        completedCourses
      );

      const previousWithProgress = applyProgressFromCompletedCourses(
        previousRecommendations,
        completedCourses
      );

      const mergedRecommendations = mergeCurrentAndPreviousRecommendations({
        currentRecommendations: currentWithProgress,
        previousRecommendations: previousWithProgress,
      });

      console.log("DEBUG FRONT FINAL:", mergedRecommendations);

      setRecommendations(mergedRecommendations);

      const payload: RecommendationDocument = {
        userId: user.uid,
        version: "4.0",
        source: "recommendation_service_catalog_engine",
        diagnosticRef: `users/${user.uid}/diagnostics/current`,
        summary: buildSummary(mergedRecommendations),
        recommendations: mergedRecommendations,
      };

      await setDoc(
        doc(db, "users", user.uid, "recommendations", "current"),
        {
          ...payload,
          generatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setLastGeneratedAt(new Date().toLocaleString("pt-BR"));
      await loadFeedbacks();
    } catch (error) {
      console.error("Erro ao carregar recomendações:", error);
      setErrorMessage("Ocorreu um erro ao montar suas recomendações.");
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }, [db, user, loadFeedbacks]);

  useEffect(() => {
    if (!isUserLoading && db && user) {
      loadRecommendations();
    }
  }, [isUserLoading, db, user, loadRecommendations]);

  function clearCompetencyFilter() {
    router.push("/dashboard/recommendations");
  }

  if (isUserLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Preparando suas trilhas.</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="rounded-3xl border bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight">
                  Minhas recomendações
                </h1>
              </div>

              <p className="max-w-3xl text-sm text-slate-700">
                Aqui você vê, de forma simples, o que desenvolver, por onde
                começar e como está evoluindo.
              </p>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {diagnostic?.contextSnapshot?.unitName && (
                  <span>Unidade: {diagnostic.contextSnapshot.unitName}</span>
                )}
                {diagnostic?.contextSnapshot?.sectorName && (
                  <span>Setor: {diagnostic.contextSnapshot.sectorName}</span>
                )}
                {diagnostic?.contextSnapshot?.roleName && (
                  <span>Função: {diagnostic.contextSnapshot.roleName}</span>
                )}
              </div>

              {selectedCompetencyParam && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    Competência filtrada: {selectedCompetencyName}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearCompetencyFilter}
                  >
                    Limpar filtro
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col items-start gap-3 md:items-end">
              <Button
                type="button"
                onClick={loadRecommendations}
                disabled={saving}
                className="rounded-2xl"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Atualizar trilhas
              </Button>

              {lastGeneratedAt && (
                <p className="text-xs text-muted-foreground">
                  Atualizado em: {lastGeneratedAt}
                </p>
              )}
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Para fazer agora</p>
              <p className="mt-3 text-4xl font-bold">{sections.now.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Trilhas que você pode começar
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Em andamento</p>
              <p className="mt-3 text-4xl font-bold">{sections.doing.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Trilhas que você já iniciou
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Concluídas</p>
              <p className="mt-3 text-4xl font-bold">{sections.done.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Trilhas já finalizadas
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-3xl shadow-sm md:col-span-4">
            <CardContent className="grid gap-4 p-6 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total de trilhas
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {summary.totalRecommendations}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Alta prioridade
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {summary.highPriorityRecommendations}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Média prioridade
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {summary.mediumPriorityRecommendations}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Baixa prioridade
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {summary.lowPriorityRecommendations}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <RecommendationSection
          title="Para começar"
          subtitle="Recomendações que ainda não foram iniciadas."
          icon={<Sparkles className="h-5 w-5" />}
          items={sections.now}
          feedbacks={feedbacks}
          feedbackLoadingId={feedbackLoadingId}
          onFeedback={handleFeedback}
        />

        <RecommendationSection
          title="Em andamento"
          subtitle="Trilhas que já possuem avanço registrado."
          icon={<Route className="h-5 w-5" />}
          items={sections.doing}
          feedbacks={feedbacks}
          feedbackLoadingId={feedbackLoadingId}
          onFeedback={handleFeedback}
        />

        <RecommendationSection
          title="Concluídas"
          subtitle="Trilhas que já chegaram ao fim e aguardam reavaliação."
          icon={<GraduationCap className="h-5 w-5" />}
          items={sections.done}
          feedbacks={feedbacks}
          feedbackLoadingId={feedbackLoadingId}
          onFeedback={handleFeedback}
        />

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={() => router.push("/dashboard/completed")}
            className="rounded-2xl"
          >
            Continuar para Cursos Realizados →
          </Button>
        </div>

        {!filteredRecommendations.length && !errorMessage && (
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <Lightbulb className="h-8 w-8 text-primary/60" />
              <p className="text-lg font-semibold">
                Nenhuma recomendação disponível
              </p>
              <p className="max-w-xl text-sm text-muted-foreground">
                No momento, não foi possível montar trilhas para o seu perfil.
                Atualize suas respostas e tente novamente.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}