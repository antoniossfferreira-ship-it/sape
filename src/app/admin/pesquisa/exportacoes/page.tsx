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
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Table2,
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

function buildCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const escapeValue = (value: unknown) => {
    const str =
      value === null || value === undefined ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.join(";"),
    ...rows.map((row) =>
      headers.map((header) => escapeValue(row[header])).join(";")
    ),
  ];

  return lines.join("\n");
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  const csv = buildCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export default function AdminPesquisaExportacoesPage() {
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
      console.error("Erro ao carregar base para exportação:", err);
      setError(
        "Não foi possível carregar os dados de exportação. Verifique a coleção pilotParticipants."
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

  const filteredParticipants = useMemo(() => {
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

  const exportRows = useMemo(() => {
    return filteredParticipants.map((participant) => ({
      userId: participant.userId,
      nome: getString(participant.nome, ""),
      matricula: getString(participant.matricula, ""),
      email: getString(participant.email, ""),
      unidadeNome: getString(
        (participant as Record<string, unknown>).unidadeNome,
        ""
      ),
      setorNome: getString(
        (participant as Record<string, unknown>).setorNome,
        ""
      ),
      funcaoNome: getString(
        (participant as Record<string, unknown>).funcaoNome,
        ""
      ),
      statusPiloto: getPilotStatusLabel(participant.statusPiloto),
      etapaAtual: getString(participant.etapaAtual, ""),
      percentualConclusao: getNumber(participant.percentualConclusao, 0),
      ativoNoPiloto: participant.ativoNoPiloto ? "Sim" : "Não",
      recomendacaoRecebida: participant.recomendacaoRecebida ? "Sim" : "Não",
      assessmentCompletedItems: getNumber(
        (participant as Record<string, unknown>).assessmentCompletedItems,
        0
      ),
      assessmentTotalItems: getNumber(
        (participant as Record<string, unknown>).assessmentTotalItems,
        0
      ),
      hasGaps: Boolean((participant as Record<string, unknown>).hasGaps)
        ? "Sim"
        : "Não",
      maxGap: getNumber((participant as Record<string, unknown>).maxGap, 0),
      averageCurrentLevel: getNumber(
        (participant as Record<string, unknown>).averageCurrentLevel,
        0
      ),
      averageExpectedLevel: getNumber(
        (participant as Record<string, unknown>).averageExpectedLevel,
        0
      ),
    }));
  }, [filteredParticipants]);

  const summary = useMemo(() => {
    const total = filteredParticipants.length;

    const comRecomendacao = filteredParticipants.filter(
      (participant) => participant.recomendacaoRecebida
    ).length;

    const comLacunas = filteredParticipants.filter((participant) =>
      Boolean((participant as Record<string, unknown>).hasGaps)
    ).length;

    const mediaConclusao =
      filteredParticipants.length > 0
        ? filteredParticipants.reduce((acc, participant) => {
            return acc + getNumber(participant.percentualConclusao, 0);
          }, 0) / filteredParticipants.length
        : 0;

    return {
      total,
      comRecomendacao,
      comLacunas,
      mediaConclusao,
    };
  }, [filteredParticipants]);

  function handleExportCSV() {
    downloadCSV("base_analitica_sape.csv", exportRows);
  }

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
                Exportações da Pesquisa
              </h1>
              <p className="text-sm text-muted-foreground">
                Consolidação da base analítica do piloto para apoiar tabelas,
                quadros, gráficos e análises da dissertação.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
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

              <Button
                type="button"
                onClick={handleExportCSV}
                disabled={exportRows.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </div>

        {isUserLoading || isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando base de exportação...
            </div>
          </div>
        ) : error ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Registros prontos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-muted-foreground" />
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
                  <span className="text-2xl font-bold">
                    {summary.comRecomendacao}
                  </span>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Com lacunas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{summary.comLacunas}</span>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Média de conclusão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">
                    {summary.mediaConclusao.toFixed(1)}%
                  </span>
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

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2.3fr)_320px]">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Base consolidada para exportação</CardTitle>
                </CardHeader>
                <CardContent>
                  {exportRows.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhum dado disponível para exportação.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] border-collapse">
                        <thead>
                          <tr className="border-b text-left text-sm text-muted-foreground">
                            <th className="px-3 py-3 font-medium">Nome</th>
                            <th className="px-3 py-3 font-medium">Unidade</th>
                            <th className="px-3 py-3 font-medium">Setor</th>
                            <th className="px-3 py-3 font-medium">Status</th>
                            <th className="px-3 py-3 font-medium">Conclusão</th>
                            <th className="px-3 py-3 font-medium">Lacunas</th>
                            <th className="px-3 py-3 font-medium">Gap máximo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exportRows.map((row) => (
                            <tr
                              key={String(row.userId)}
                              className="border-b text-sm hover:bg-muted/40"
                            >
                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[180px] font-medium break-words">
                                  {getString(row.nome)}
                                </div>
                                <div className="text-xs text-muted-foreground break-all">
                                  {getString(row.email)}
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[180px] break-words">
                                  {getString(row.unidadeNome)}
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[170px] break-words">
                                  {getString(row.setorNome)}
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                {getString(row.statusPiloto)}
                              </td>

                              <td className="px-3 py-3 align-top">
                                {getNumber(row.percentualConclusao, 0)}%
                              </td>

                              <td className="px-3 py-3 align-top">
                                {getString(row.hasGaps)}
                              </td>

                              <td className="px-3 py-3 align-top">
                                {getNumber(row.maxGap, 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Conjuntos disponíveis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-xl border p-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Base geral dos participantes
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Inclui identificação, unidade, setor, função, status,
                        percentual de conclusão e métricas analíticas do piloto.
                      </p>
                    </div>

                    <div className="rounded-xl border p-3">
                      <div className="flex items-center gap-2">
                        <Table2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Base para tabelas do Capítulo 7
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Pronta para apoiar análises de perfil, lacunas,
                        recomendações e participação no protótipo.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Leitura consolidada</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Esta página organiza a base analítica final do piloto em
                      formato adequado para exportação e uso na redação da
                      dissertação.
                    </p>
                    <p>
                      A exportação em CSV facilita o tratamento externo dos dados,
                      permitindo a elaboração de tabelas, gráficos e quadros
                      interpretativos com base na consolidação do SAPE.
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
                  A base consolidada de exportação reúne informações centrais do
                  percurso dos participantes no piloto, favorecendo a organização
                  dos dados para análise acadêmica.
                </p>
                <p>
                  Essa estrutura permite que os resultados sejam trabalhados tanto
                  no próprio sistema quanto em ferramentas externas, contribuindo
                  para a construção das análises do Capítulo 7 e para a elaboração
                  de sínteses quantitativas e qualitativas da pesquisa.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}