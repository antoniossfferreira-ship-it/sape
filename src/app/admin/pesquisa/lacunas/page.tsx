"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import DashboardLayout from "@/components/layout/dashboard-layout";
import { useFirestore, useUser } from "@/firebase";
import { getPilotParticipants } from "@/lib/admin/admin-queries";
import type { PilotParticipant } from "@/types/admin";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  AlertTriangle,
  ArrowLeft,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
  Sigma,
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

function getGapLabel(maxGap: number): string {
  if (maxGap >= 3) return "Lacuna elevada";
  if (maxGap >= 1) return "Lacuna moderada";
  return "Sem lacuna detectada";
}

export default function AdminPesquisaLacunasPage() {
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
      console.error("Erro ao carregar análise de lacunas:", err);
      setError(
        "Não foi possível carregar os dados das lacunas. Verifique a coleção pilotParticipants."
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

  const participantsWithGaps = useMemo(() => {
    return participantsWithSearch.filter((participant) => {
      const hasGaps = Boolean(
        (participant as Record<string, unknown>).hasGaps
      );
      const maxGap = getNumber(
        (participant as Record<string, unknown>).maxGap,
        0
      );

      return hasGaps || maxGap > 0;
    });
  }, [participantsWithSearch]);

  const summary = useMemo(() => {
    const totalParticipants = participantsWithSearch.length;
    const comLacunas = participantsWithGaps.length;

    const somaMaxGap = participantsWithGaps.reduce((acc, participant) => {
      return acc + getNumber((participant as Record<string, unknown>).maxGap, 0);
    }, 0);

    const mediaMaxGap =
      comLacunas > 0 ? somaMaxGap / comLacunas : 0;

    const maiorGap = participantsWithGaps.reduce((max, participant) => {
      const current = getNumber(
        (participant as Record<string, unknown>).maxGap,
        0
      );
      return current > max ? current : max;
    }, 0);

    const mediaAtual =
      participantsWithGaps.length > 0
        ? participantsWithGaps.reduce((acc, participant) => {
            return (
              acc +
              getNumber(
                (participant as Record<string, unknown>).averageCurrentLevel,
                0
              )
            );
          }, 0) / participantsWithGaps.length
        : 0;

    const mediaEsperada =
      participantsWithGaps.length > 0
        ? participantsWithGaps.reduce((acc, participant) => {
            return (
              acc +
              getNumber(
                (participant as Record<string, unknown>).averageExpectedLevel,
                0
              )
            );
          }, 0) / participantsWithGaps.length
        : 0;

    return {
      totalParticipants,
      comLacunas,
      mediaMaxGap,
      maiorGap,
      mediaAtual,
      mediaEsperada,
    };
  }, [participantsWithSearch, participantsWithGaps]);

  const gapDistribution = useMemo(() => {
    const groups = new Map<string, number>();

    participantsWithGaps.forEach((participant) => {
      const maxGap = getNumber(
        (participant as Record<string, unknown>).maxGap,
        0
      );
      const label = getGapLabel(maxGap);
      groups.set(label, (groups.get(label) ?? 0) + 1);
    });

    return Array.from(groups.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }, [participantsWithGaps]);

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
                Lacunas de Competências
              </h1>
              <p className="text-sm text-muted-foreground">
                Consolidação analítica das lacunas identificadas no piloto, com
                base nos dados de autoavaliação e nos níveis esperados de competência.
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
              Carregando análise de lacunas...
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
                    <Layers3 className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {summary.totalParticipants}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Com lacunas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{summary.comLacunas}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Maior gap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{summary.maiorGap}</span>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Média do gap máximo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">
                    {summary.mediaMaxGap.toFixed(1)}
                  </span>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Diferença média
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Sigma className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {(summary.mediaEsperada - summary.mediaAtual).toFixed(1)}
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

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="rounded-2xl xl:col-span-2">
                <CardHeader>
                  <CardTitle>Lacunas por participante</CardTitle>
                </CardHeader>
                <CardContent>
                  {participantsWithGaps.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhuma lacuna identificada com os filtros atuais.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1100px] border-collapse">
                        <thead>
                          <tr className="border-b text-left text-sm text-muted-foreground">
                            <th className="px-3 py-3 font-medium">Participante</th>
                            <th className="px-3 py-3 font-medium">Unidade</th>
                            <th className="px-3 py-3 font-medium">Setor</th>
                            <th className="px-3 py-3 font-medium">
                              Itens avaliados
                            </th>
                            <th className="px-3 py-3 font-medium">Nível atual</th>
                            <th className="px-3 py-3 font-medium">Nível esperado</th>
                            <th className="px-3 py-3 font-medium">Maior gap</th>
                            <th className="px-3 py-3 font-medium">Leitura</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participantsWithGaps.map((participant) => {
                            const assessmentCompletedItems = getNumber(
                              (participant as Record<string, unknown>)
                                .assessmentCompletedItems,
                              0
                            );
                            const assessmentTotalItems = getNumber(
                              (participant as Record<string, unknown>)
                                .assessmentTotalItems,
                              0
                            );
                            const averageCurrentLevel = getNumber(
                              (participant as Record<string, unknown>)
                                .averageCurrentLevel,
                              0
                            );
                            const averageExpectedLevel = getNumber(
                              (participant as Record<string, unknown>)
                                .averageExpectedLevel,
                              0
                            );
                            const maxGap = getNumber(
                              (participant as Record<string, unknown>).maxGap,
                              0
                            );

                            return (
                              <tr
                                key={participant.userId}
                                className="border-b text-sm hover:bg-muted/40"
                              >
                                <td className="px-3 py-3 align-top">
                                  <div className="font-medium">
                                    {getString(participant.nome)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {getString(participant.matricula)}
                                  </div>
                                </td>

                                <td className="px-3 py-3 align-top">
                                  {getString(
                                    (participant as Record<string, unknown>)
                                      .unidadeNome
                                  )}
                                </td>

                                <td className="px-3 py-3 align-top">
                                  {getString(
                                    (participant as Record<string, unknown>)
                                      .setorNome
                                  )}
                                </td>

                                <td className="px-3 py-3 align-top">
                                  {assessmentCompletedItems}
                                  {assessmentTotalItems > 0
                                    ? ` / ${assessmentTotalItems}`
                                    : ""}
                                </td>

                                <td className="px-3 py-3 align-top">
                                  {averageCurrentLevel.toFixed(1)}
                                </td>

                                <td className="px-3 py-3 align-top">
                                  {averageExpectedLevel.toFixed(1)}
                                </td>

                                <td className="px-3 py-3 align-top font-medium">
                                  {maxGap}
                                </td>

                                <td className="px-3 py-3 align-top">
                                  {getGapLabel(maxGap)}
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
                    <CardTitle>Distribuição das lacunas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {gapDistribution.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Nenhuma distribuição disponível.
                      </div>
                    ) : (
                      gapDistribution.map((item) => (
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
                      A análise das lacunas foi estruturada com base na diferença
                      entre os níveis atuais informados pelos participantes e os
                      níveis esperados de competência no sistema.
                    </p>
                    <p>
                      Esta leitura permite identificar, de forma sintética, a
                      intensidade das lacunas detectadas no piloto e apoiar a
                      redação da seção 7.2 da dissertação.
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
                  Esta página organiza dados analíticos relacionados às lacunas de
                  competências, favorecendo a interpretação das diferenças entre
                  níveis atuais e esperados identificadas no piloto do SAPE.
                </p>
                <p>
                  Os dados consolidados auxiliam a compreensão do perfil formativo
                  dos participantes e oferecem suporte à análise das necessidades de
                  desenvolvimento observadas na pesquisa.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}