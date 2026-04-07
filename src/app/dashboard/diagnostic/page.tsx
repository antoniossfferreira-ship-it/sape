"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type ProgressStatus =
  | "NAO_INICIADO"
  | "EM_DESENVOLVIMENTO"
  | "AGUARDANDO_REAVALIACAO";

type SuggestedCourse = {
  id: string;
  title: string;
  description?: string;
  modality?: string;
  workloadHours?: number;
  source?: string;
  url?: string;
};

type RecommendationItem = {
  recommendationId: string;
  title: string;
  linkedCompetencyId?: string;
  linkedCompetencyName: string;
  progressStatus: ProgressStatus;
  progressPercent: number;
  completedCoursesCount?: number;
  totalCoursesCount?: number;
  hasRelatedEvidenceOutsideTrail?: boolean;
  suggestedCourses?: SuggestedCourse[];
};

type RecommendationDocument = {
  userId: string;
  generatedAt?: unknown;
  version?: string;
  source?: string;
  diagnosticRef?: string;
  summary?: {
    totalRecommendations: number;
    highPriorityRecommendations: number;
    mediumPriorityRecommendations: number;
    lowPriorityRecommendations: number;
  };
  recommendations?: RecommendationItem[];
  needsUpdate?: boolean;
};

type CompletedCourseDoc = {
  id: string;
  name?: string;
  linkedCompetencyId?: string | null;
  linkedCompetencyName?: string | null;
  sourceRecommendationId?: string | null;
  sourceRecommendationTitle?: string | null;
};

function formatTrailTitle(title: string): string {
  if (!title) return "";

  return title
    .replace("Percurso para desenvolver", "")
    .replace("no seu setor", "")
    .trim();
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLookup(value: unknown): string {
  if (typeof value === "string") {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s:-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (typeof value === "number") {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s:-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "";
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
  const suggestedCourses = Array.isArray(recommendation.suggestedCourses)
    ? recommendation.suggestedCourses
    : [];

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

    if (!sameCompetencyId && !sameCompetencyName) continue;

    const matchesSuggestedTitle = suggestedCourses.some((suggested) =>
      titlesMatch(course.name, suggested.title)
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
    const totalCoursesCount = Array.isArray(item.suggestedCourses)
      ? item.suggestedCourses.length
      : Number(item.totalCoursesCount || 0);

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
    } else if (completedCoursesCount > 0) {
      progressStatus = "EM_DESENVOLVIMENTO";
    }

    let progressPercent = 0;

    if (totalCoursesCount > 0 && completedCoursesCount > 0) {
      progressPercent = Math.min(
        100,
        Math.round((completedCoursesCount / totalCoursesCount) * 100)
      );
    } else if (
      totalCoursesCount === 0 &&
      progressStatus === "AGUARDANDO_REAVALIACAO"
    ) {
      progressPercent = 100;
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

function buildSummary(items: RecommendationItem[]) {
  return {
    totalRecommendations: items.length,
    highPriorityRecommendations: 0,
    mediumPriorityRecommendations: 0,
    lowPriorityRecommendations: 0,
  };
}

export default function DiagnosticPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecommendationItem[]>([]);

  useEffect(() => {
    async function load() {
      if (!db || !user) return;

      try {
        const recommendationsRef = doc(
          db,
          "users",
          user.uid,
          "recommendations",
          "current"
        );

        const [recommendationsSnap, completedSnap] = await Promise.all([
          getDoc(recommendationsRef),
          getDocs(collection(db, "users", user.uid, "completedCourses")),
        ]);

        if (!recommendationsSnap.exists()) {
          setItems([]);
          return;
        }

        const recommendationsData =
          recommendationsSnap.data() as RecommendationDocument;

        const storedRecommendations = Array.isArray(
          recommendationsData?.recommendations
        )
          ? (recommendationsData.recommendations as RecommendationItem[])
          : [];

        const completedCourses: CompletedCourseDoc[] = completedSnap.docs.map(
          (docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            return {
              id: docSnap.id,
              name: data?.name || "",
              linkedCompetencyId: data?.linkedCompetencyId || null,
              linkedCompetencyName: data?.linkedCompetencyName || null,
              sourceRecommendationId: data?.sourceRecommendationId || null,
              sourceRecommendationTitle: data?.sourceRecommendationTitle || null,
            };
          }
        );

        const refreshedRecommendations = applyProgressFromCompletedCourses(
          storedRecommendations,
          completedCourses
        );

        await setDoc(
          recommendationsRef,
          {
            ...recommendationsData,
            recommendations: refreshedRecommendations,
            summary: buildSummary(refreshedRecommendations),
            needsUpdate: false,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setItems(refreshedRecommendations);
      } catch (error) {
        console.error("Erro ao carregar desenvolvimento:", error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    if (!isUserLoading) {
      load();
    }
  }, [db, user, isUserLoading]);

  if (loading || isUserLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[60vh]">
          <Loader2 className="animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const precisaAtencao = items.filter(
    (i) => i.progressStatus === "NAO_INICIADO"
  ).length;

  const emDesenvolvimento = items.filter(
    (i) => i.progressStatus === "EM_DESENVOLVIMENTO"
  ).length;

  const desenvolvidas = items.filter(
    (i) => i.progressStatus === "AGUARDANDO_REAVALIACAO"
  ).length;

  function getSituation(status: ProgressStatus) {
    if (status === "NAO_INICIADO") return "Precisa de atenção";
    if (status === "EM_DESENVOLVIMENTO") return "Em desenvolvimento";
    return "Desenvolvida";
  }

  function getMessage(item: RecommendationItem) {
    if (item.progressStatus === "NAO_INICIADO") {
      if (item.hasRelatedEvidenceOutsideTrail) {
        return "Você já tem experiência relacionada a este tema, mas ainda não iniciou os cursos desta trilha.";
      }
      return "Recomendamos iniciar esta trilha para desenvolver essa competência.";
    }

    if (item.progressStatus === "EM_DESENVOLVIMENTO") {
      return `Você já avançou ${item.progressPercent || 0}% nesta trilha. Continue!`;
    }

    return "Trilha concluída. Você pode revisar sua autoavaliação.";
  }

  function getCardStyle(status: ProgressStatus) {
    if (status === "NAO_INICIADO") return "border-rose-200 bg-rose-50";
    if (status === "EM_DESENVOLVIMENTO") {
      return "border-amber-200 bg-amber-50";
    }
    return "border-emerald-200 bg-emerald-50";
  }

  function getProgressBarColor(status: ProgressStatus) {
    if (status === "NAO_INICIADO") return "bg-rose-500";
    if (status === "EM_DESENVOLVIMENTO") return "bg-amber-500";
    return "bg-emerald-600";
  }

  function handleVerTrilha(item: RecommendationItem) {
    const params = new URLSearchParams({
      competencia: item.linkedCompetencyName,
    });

    router.push(`/dashboard/recommendations?${params.toString()}`);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="space-y-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Meu desenvolvimento
            </h1>
            <p className="text-muted-foreground mt-2 max-w-3xl">
              Veja os pontos que já estão bem e os que merecem mais atenção.
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Etapa 5 de 5 — Diagnóstico
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[100%] bg-primary" />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-rose-50 border-rose-200">
            <CardHeader>
              <CardDescription>Precisa de atenção</CardDescription>
              <CardTitle>{precisaAtencao}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardDescription>Em desenvolvimento</CardDescription>
              <CardTitle>{emDesenvolvimento}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-emerald-50 border-emerald-200">
            <CardHeader>
              <CardDescription>Desenvolvidas</CardDescription>
              <CardTitle>{desenvolvidas}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-lg font-medium">Nenhuma trilha encontrada</p>
              <p className="text-sm text-muted-foreground">
                Gere suas recomendações primeiro.
              </p>
            </CardContent>
          </Card>
        ) : (
          items.map((item) => {
            const trailTitle = formatTrailTitle(item.title);
            const showCompetencyFocus =
              normalizeText(trailTitle) !==
              normalizeText(item.linkedCompetencyName || "");

            return (
              <Card
                key={item.recommendationId}
                className={`rounded-2xl ${getCardStyle(item.progressStatus)}`}
              >
                <CardContent className="p-5 space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Trilha</p>
                    <h3 className="text-lg font-semibold">{trailTitle}</h3>
                  </div>

                  {showCompetencyFocus && (
                    <div className="text-sm text-muted-foreground">
                      Competência foco: <strong>{item.linkedCompetencyName}</strong>
                    </div>
                  )}

                  <div className="text-sm">
                    <strong>Situação:</strong> {getSituation(item.progressStatus)}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {getMessage(item)}
                  </div>

                  <div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressBarColor(
                          item.progressStatus
                        )}`}
                        style={{ width: `${item.progressPercent || 0}%` }}
                      />
                    </div>

                    <p className="text-xs text-muted-foreground mt-1">
                      {item.progressPercent || 0}% concluído
                      {typeof item.completedCoursesCount === "number" &&
                      typeof item.totalCoursesCount === "number" &&
                      item.totalCoursesCount > 0
                        ? ` • ${item.completedCoursesCount} de ${item.totalCoursesCount} cursos`
                        : ""}
                    </p>
                  </div>

                  <Button
                    onClick={() => handleVerTrilha(item)}
                    className="rounded-xl mt-2"
                  >
                    Ver trilha
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}

        <div className="mt-8 flex justify-end">
          <Button
            type="button"
            onClick={() => router.push("/dashboard/recommendations")}
            className="rounded-2xl bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
          >
            Ver recomendações →
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}