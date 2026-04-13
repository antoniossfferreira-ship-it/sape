"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/layout/dashboard-layout";
import { useFirestore, useUser } from "@/firebase";
import { getPilotParticipants } from "@/lib/admin/admin-queries";
import { getPilotStatusLabel } from "@/lib/admin/pilot-status";
import type { PilotParticipant } from "@/types/admin";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Route,
} from "lucide-react";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getString(value: unknown, fallback = "-"): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function RecommendationBadge({
  hasRecommendation,
}: {
  hasRecommendation: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        hasRecommendation
          ? "border-blue-200 bg-blue-100 text-blue-800"
          : "border-slate-200 bg-slate-100 text-slate-700"
      }`}
    >
      {hasRecommendation ? "Recomendação registrada" : "Sem recomendação"}
    </span>
  );
}

function getRecommendationReading(params: {
  hasRecommendation: boolean;
  percentualConclusao: number;
  maxGap: number;
}): string {
  const { hasRecommendation, percentualConclusao, maxGap } = params;

  if (!hasRecommendation) {
    return "Sem evidência consolidada de recomendação";
  }

  if (percentualConclusao >= 70 && maxGap >= 1) {
    return "Recomendação associada a lacunas identificadas";
  }

  if (percentualConclusao >= 70) {
    return "Recomendação consolidada no percurso";
  }

  return "Recomendação em consolidação";
}

export default function AdminPesquisaRecomendacoesPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const [participants, setParticipants] = useState<PilotParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  async function loadParticipants() {
    if (!db) return;

    setIsLoading(true);
    setError("");

    try {
      const data = await getPilotParticipants(db);
      setParticipants(data);
    } catch (err) {
      console.error("Erro ao carregar recomendações geradas:", err);
      setError(
        "Não foi possível carregar os dados das recomendações. Verifique a coleção pilotParticipants."
      );
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

    loadParticipants();
  }, [db, user, isUserLoading]);

  const participantsWithSearch = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    if (!normalizedSearch) return participants;

    return participants.filter((participant) => {
      const nome = normalizeText(getString(participant.nome, ""));
      const matricula = normalizeText(getString(participant.matricula, ""));
      const email = normalizeText(getString(participant.email, ""));
      const unidade = normalizeText(
        getString((participant as Record<string, unknown>).unidadeNome, "")
      );
      const setor = normalizeText(
        getString((participant as Record<string, unknown>).setorNome, "")
      );

      return (
        nome.includes(normalizedSearch) ||
        matricula.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        unidade.includes(normalizedSearch) ||
        setor.includes(normalizedSearch)
      );
    });
  }, [participants, searchTerm]);

  const participantsWithRecommendations = useMemo(() => {
    return participantsWithSearch.filter((participant) => {
      return Boolean(participant.recomendacaoRecebida);
    });
  }, [participantsWithSearch]);

  const summary = useMemo(() => {
    const total = participantsWithSearch.length;
    const comRecomendacao = participantsWithRecommendations.length;
    const semRecomendacao = total - comRecomendacao;

    const mediaConclusao =
      participantsWithRecommendations.length > 0
        ? participantsWithRecommendations.reduce((acc, participant) => {
            return acc + getNumber(participant.percentualConclusao, 0);
          }, 0) / participantsWithRecommendations.length
        : 0;

    const mediaGap =
      participantsWithRecommendations.length > 0
        ? participantsWithRecommendations.reduce((acc, participant) => {
            return (
              acc +
              getNumber((participant as Record<string, unknown>).maxGap, 0)
            );
          }, 0) / participantsWithRecommendations.length
        : 0;

    return {
      total,
      comRecomendacao,
      semRecomendacao,
      mediaConclusao,
      mediaGap,
    };
  }, [participantsWithSearch, participantsWithRecommendations]);

  const statusDistribution = useMemo(() => {
    const map = new Map<string, number>();

    participantsWithRecommendations.forEach((participant) => {
      const status = getPilotStatusLabel(participant.statusPiloto);
      map.set(status, (map.get(status) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }, [participantsWithRecommendations]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="space-y-3">
          <Link href="/admin/pesquisa">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o painel analítico
            </Button>
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Recomendações Geradas
              </h1>
              <p className="text-sm text-muted-foreground">
                Consolidação das recomendações registradas ao longo do piloto, com
                foco na relação entre lacunas identificadas e encaminhamento formativo.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={loadParticipants}
              disabled={isLoading || !db}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar dados
            </Button>
          </div>
        </div>

        {isUserLoading || isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando recomendações geradas...
            </div>
          </div>
        ) : error ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Participantes analisados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{summary.total}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Com recomendação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {summary.comRecomendacao}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Sem recomendação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">
                    {summary.semRecomendacao}
                  </span>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Média de conclusão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Route className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {summary.mediaConclusao.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Gap médio associado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {summary.mediaGap.toFixed(1)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Busca</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, matrícula, e-mail, unidade ou setor"
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2.5fr)_300px]">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Participantes com recomendação consolidada</CardTitle>
                </CardHeader>
                <CardContent>
                  {participantsWithRecommendations.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhuma recomendação encontrada com os filtros atuais.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[820px] border-collapse">
                        <thead>
                          <tr className="border-b text-left text-sm text-muted-foreground">
                            <th className="px-3 py-3 font-medium">Participante</th>
                            <th className="px-3 py-3 font-medium">Unidade</th>
                            <th className="px-3 py-3 font-medium">Setor</th>
                            <th className="px-3 py-3 font-medium">Status</th>
                            <th className="px-3 py-3 font-medium">Conclusão</th>
                            <th className="px-3 py-3 font-medium">Maior gap</th>
                            <th className="px-3 py-3 font-medium">Leitura analítica</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participantsWithRecommendations.map((participant) => {
                            const maxGap = getNumber(
                              (participant as Record<string, unknown>).maxGap,
                              0
                            );
                            const percentualConclusao = getNumber(
                              participant.percentualConclusao,
                              0
                            );

                            return (
                              <tr
                                key={participant.userId}
                                className="border-b text-sm hover:bg-muted/40"
                              >
                                <td className="px-3 py-3 align-top">
                                  <div className="max-w-[180px] font-medium break-words">
                                    {getString(participant.nome)}
                                  </div>
                                  <div className="text-xs text-muted-foreground break-all">
                                    {getString(participant.email)}
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <div className="max-w-[180px] break-words">
                                    {getString(
                                      (participant as Record<string, unknown>)
                                        .unidadeNome
                                    )}
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <div className="max-w-[170px] break-words">
                                    {getString(
                                      (participant as Record<string, unknown>)
                                        .setorNome
                                    )}
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <RecommendationBadge hasRecommendation />
                                  <div className="mt-2 max-w-[150px] text-xs text-muted-foreground break-words">
                                    {getPilotStatusLabel(participant.statusPiloto)}
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <div className="flex min-w-[120px] items-center gap-2">
                                    <div className="h-2 flex-1 rounded-full bg-slate-100">
                                      <div
                                        className="h-2 rounded-full bg-slate-900 transition-all"
                                        style={{
                                          width: `${Math.max(
                                            0,
                                            Math.min(100, percentualConclusao)
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="w-10 text-xs text-muted-foreground">
                                      {percentualConclusao}%
                                    </span>
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top font-medium">
                                  {maxGap}
                                </td>

                                <td className="px-3 py-3 align-top">
                                  <div className="max-w-[200px] break-words text-sm">
                                    {getRecommendationReading({
                                      hasRecommendation: true,
                                      percentualConclusao,
                                      maxGap,
                                    })}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Distribuição por status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {statusDistribution.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Nenhuma distribuição disponível.
                      </div>
                    ) : (
                      statusDistribution.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-3 rounded-xl border p-3"
                        >
                          <span className="text-sm">{item.label}</span>
                          <span className="text-sm font-semibold">{item.count}</span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Leitura consolidada</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Esta página sintetiza as recomendações consolidadas no piloto,
                      permitindo observar em que medida as lacunas identificadas
                      resultaram em encaminhamentos formativos no sistema.
                    </p>
                    <p>
                      Os dados aqui apresentados contribuem diretamente para a
                      redação da seção 7.3 da dissertação, especialmente no que se
                      refere à relação entre diagnóstico e recomendação.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Leitura metodológica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  A análise das recomendações foi construída a partir da consolidação
                  dos dados do piloto, articulando a identificação de lacunas com o
                  encaminhamento do participante para a etapa de recomendações.
                </p>
                <p>
                  Ainda que parte das recomendações detalhadas esteja distribuída em
                  estruturas específicas do sistema, a base consolidada permite
                  observar de forma objetiva quais participantes alcançaram essa etapa
                  e com que intensidade de lacuna formativa isso ocorreu.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}