// src/app/admin/exportacoes/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/layout/dashboard-layout";
import { useFirestore, useUser } from "@/firebase";

import {
  countCollectionDocuments,
  getPilotParticipants,
  getParticipantCourses,
  getParticipantGaps,
  getParticipantRecommendationFeedback,
} from "@/lib/admin/admin-queries";

import {
  buildConsolidatedDataset,
  convertToCSV,
  downloadCSV,
  exportPilotParticipantsCSV,
  formatTimestamp,
} from "@/lib/admin/export-utils";

import type { ExportMode, PilotParticipant } from "@/types/admin";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Download, FileSpreadsheet, Loader2 } from "lucide-react";

type CollectionCounts = {
  pilotParticipants: number;
  userContexts: number;
  assessments: number;
  gapDiagnostics: number;
  recommendations: number;
  recommendationFeedback: number;
  completedCourses: number;
  researchEvents: number;
};

const INITIAL_COUNTS: CollectionCounts = {
  pilotParticipants: 0,
  userContexts: 0,
  assessments: 0,
  gapDiagnostics: 0,
  recommendations: 0,
  recommendationFeedback: 0,
  completedCourses: 0,
  researchEvents: 0,
};

function CollectionCard({
  title,
  description,
  count,
  onExport,
  disabled,
}: {
  title: string;
  description: string;
  count: number;
  onExport: () => void;
  disabled?: boolean;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="text-2xl font-bold">{count}</div>
        <Button onClick={onExport} disabled={disabled} className="w-full">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </CardContent>
    </Card>
  );
}

function mapGenericRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};

  Object.entries(row).forEach(([key, value]) => {
    mapped[key] = formatTimestamp(value) || value;
  });

  return mapped;
}

export default function AdminExportacoesPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const [participants, setParticipants] = useState<PilotParticipant[]>([]);
  const [counts, setCounts] = useState<CollectionCounts>(INITIAL_COUNTS);
  const [mode, setMode] = useState<ExportMode>("anonimizado");
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingConsolidated, setIsExportingConsolidated] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    if (!db) return;

    setIsLoading(true);
    setError("");

    try {
      const [pilotParticipants, pilotParticipantsCount, userContextsCount, assessmentsCount, gapsCount, recommendationsCount, feedbacksCount, coursesCount, eventsCount] =
        await Promise.all([
          getPilotParticipants(db),
          countCollectionDocuments(db, "pilotParticipants"),
          countCollectionDocuments(db, "userContexts"),
          countCollectionDocuments(db, "assessments"),
          countCollectionDocuments(db, "gapDiagnostics"),
          countCollectionDocuments(db, "recommendations"),
          countCollectionDocuments(db, "recommendationFeedback"),
          countCollectionDocuments(db, "completedCourses"),
          countCollectionDocuments(db, "researchEvents"),
        ]);

      setParticipants(pilotParticipants);
      setCounts({
        pilotParticipants: pilotParticipantsCount,
        userContexts: userContextsCount,
        assessments: assessmentsCount,
        gapDiagnostics: gapsCount,
        recommendations: recommendationsCount,
        recommendationFeedback: feedbacksCount,
        completedCourses: coursesCount,
        researchEvents: eventsCount,
      });
    } catch (err) {
      console.error("Erro ao carregar exportações:", err);
      setError("Não foi possível carregar os dados para exportação.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!db || isUserLoading) return;

    if (!user) {
      setIsLoading(false);
      setError("Usuário não autenticado.");
      return;
    }

    loadData();
  }, [db, user, isUserLoading]);

  const filenameSuffix = useMemo(() => {
    const date = new Date();
    const safeDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return `${mode}_${safeDate}`;
  }, [mode]);

  async function exportGenericCollection(collectionName: string) {
    if (!db) return;

    try {
      const { getDocs, collection, query, orderBy } = await import("firebase/firestore");
      const ref = collection(db, collectionName);
      const q = query(ref, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const rows = snapshot.docs.map((docSnap) =>
        mapGenericRow({
          id: docSnap.id,
          ...docSnap.data(),
        })
      );

      const csv = convertToCSV(rows);
      downloadCSV(`${collectionName}_${filenameSuffix}.csv`, csv);
    } catch (err) {
      console.error(`Erro ao exportar ${collectionName}:`, err);
      alert(`Não foi possível exportar a coleção ${collectionName}.`);
    }
  }

  async function handleExportConsolidated() {
    if (!db || !participants.length) return;

    setIsExportingConsolidated(true);

    try {
      const consolidatedItems = await Promise.all(
        participants.map(async (participant) => {
          const [feedbacks, courses, gaps] = await Promise.all([
            getParticipantRecommendationFeedback(db, participant.userId),
            getParticipantCourses(db, participant.userId),
            getParticipantGaps(db, participant.userId),
          ]);

          const cargaHorariaTotalRegistrada = courses.reduce((acc, item) => {
            const value =
              typeof item.cargaHoraria === "number" ? item.cargaHoraria : 0;
            return acc + value;
          }, 0);

          const eixoCount = new Map<string, number>();
          gaps.forEach((gap) => {
            const eixoNome =
              typeof gap.eixoNome === "string" ? gap.eixoNome : "";
            if (!eixoNome) return;
            eixoCount.set(eixoNome, (eixoCount.get(eixoNome) ?? 0) + 1);
          });

          let eixoPredominanteLacuna = "";
          let maxCount = 0;

          eixoCount.forEach((count, eixo) => {
            if (count > maxCount) {
              maxCount = count;
              eixoPredominanteLacuna = eixo;
            }
          });

          return {
            participant,
            qtdFeedbacks: feedbacks.length,
            cargaHorariaTotalRegistrada,
            eixoPredominanteLacuna,
          };
        })
      );

      const rows = buildConsolidatedDataset(consolidatedItems, mode);
      const csv = convertToCSV(rows);
      downloadCSV(`dataset_consolidado_${filenameSuffix}.csv`, csv);
    } catch (err) {
      console.error("Erro ao exportar dataset consolidado:", err);
      alert("Não foi possível exportar o dataset consolidado.");
    } finally {
      setIsExportingConsolidated(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Exportações</h1>
            <p className="text-sm text-muted-foreground">
              Extração dos datasets da pesquisa para análise do piloto.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ExportMode)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="anonimizado">Modo anonimizado</option>
              <option value="nominal">Modo nominal</option>
            </select>

            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Atualizar contagens
            </Button>
          </div>
        </div>

        {isUserLoading || isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando dados de exportação...
            </div>
          </div>
        ) : error ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        ) : (
          <>
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Dataset consolidado da pesquisa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Gera um CSV analítico com uma linha por participante, incluindo
                  progresso no piloto, quantidade de lacunas, recomendações,
                  feedbacks, cursos realizados e carga horária total registrada.
                </p>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Participantes considerados
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {participants.length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Modo atual</div>
                      <div className="mt-1 text-sm font-semibold capitalize">
                        {mode}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Arquivo de saída
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {`dataset_consolidado_${filenameSuffix}.csv`}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button
                  onClick={handleExportConsolidated}
                  disabled={!participants.length || isExportingConsolidated}
                >
                  {isExportingConsolidated ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exportar dataset consolidado
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CollectionCard
                title="Participantes"
                description="Coleção consolidada pilotParticipants."
                count={counts.pilotParticipants}
                onExport={() =>
                  exportPilotParticipantsCSV(
                    participants,
                    mode,
                    `pilotParticipants_${filenameSuffix}.csv`
                  )
                }
                disabled={!participants.length}
              />

              <CollectionCard
                title="Contextos"
                description="Dados de contexto de trabalho informados pelos participantes."
                count={counts.userContexts}
                onExport={() => exportGenericCollection("userContexts")}
              />

              <CollectionCard
                title="Autoavaliações"
                description="Respostas registradas na autoavaliação de competências."
                count={counts.assessments}
                onExport={() => exportGenericCollection("assessments")}
              />

              <CollectionCard
                title="Diagnósticos"
                description="Lacunas identificadas pelo sistema."
                count={counts.gapDiagnostics}
                onExport={() => exportGenericCollection("gapDiagnostics")}
              />

              <CollectionCard
                title="Recomendações"
                description="Cursos ou trilhas recomendados aos participantes."
                count={counts.recommendations}
                onExport={() => exportGenericCollection("recommendations")}
              />

              <CollectionCard
                title="Feedbacks"
                description="Feedback sobre as recomendações recebidas."
                count={counts.recommendationFeedback}
                onExport={() => exportGenericCollection("recommendationFeedback")}
              />

              <CollectionCard
                title="Cursos realizados"
                description="Registros de cursos realizados no protótipo."
                count={counts.completedCourses}
                onExport={() => exportGenericCollection("completedCourses")}
              />

              <CollectionCard
                title="Eventos de pesquisa"
                description="Logs e eventos relevantes para acompanhamento do piloto."
                count={counts.researchEvents}
                onExport={() => exportGenericCollection("researchEvents")}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}