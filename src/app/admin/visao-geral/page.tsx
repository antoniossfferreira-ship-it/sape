// src/app/admin/visao-geral/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import DashboardLayout from "@/components/layout/dashboard-layout";
import { useFirestore, useUser } from "@/firebase";

import {
  getPilotParticipants,
  getRecentPilotParticipants,
} from "@/lib/admin/admin-queries";
import {
  getPilotStatusLabel,
  getPilotStepLabel,
} from "@/lib/admin/pilot-status";

import type { PilotParticipant } from "@/types/admin";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

function formatDate(value: unknown): string {
  if (!value) return "-";

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toLocaleString("pt-BR");
    } catch {
      return "-";
    }
  }

  if (value instanceof Date) {
    return value.toLocaleString("pt-BR");
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString("pt-BR");
    }
  }

  return "-";
}

function getDaysWithoutActivity(value: unknown): number | null {
  if (!value) return null;

  let date: Date | null = null;

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      date = (value as { toDate: () => Date }).toDate();
    } catch {
      date = null;
    }
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  }

  if (!date) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 ? diffDays : 0;
}

function OverviewCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function FunnelRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value} / {total} ({percent}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-slate-900 transition-all"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PilotParticipant["statusPiloto"] }) {
  const label = getPilotStatusLabel(status);

  const className =
    status === "piloto_concluido"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "recomendacao_recebida"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : status === "diagnostico_gerado"
      ? "bg-purple-100 text-purple-800 border-purple-200"
      : status === "autoavaliacao_concluida"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : status === "contexto_preenchido"
      ? "bg-cyan-100 text-cyan-800 border-cyan-200"
      : status === "inativo"
      ? "bg-zinc-100 text-zinc-700 border-zinc-200"
      : "bg-slate-100 text-slate-800 border-slate-200";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export default function AdminVisaoGeralPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const [participants, setParticipants] = useState<PilotParticipant[]>([]);
  const [recentParticipants, setRecentParticipants] = useState<PilotParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    if (!db) return;

    setIsLoading(true);
    setError("");

    try {
      const [allParticipants, recent] = await Promise.all([
        getPilotParticipants(db),
        getRecentPilotParticipants(db, 8),
      ]);

      setParticipants(allParticipants);
      setRecentParticipants(recent);
    } catch (err) {
      console.error("Erro ao carregar visão geral do admin:", err);
      setError("Não foi possível carregar a visão geral do piloto.");
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

  const metrics = useMemo(() => {
    const total = participants.length;

    const contexto = participants.filter((item) => item.contextoPreenchido).length;
    const autoavaliacao = participants.filter(
      (item) => item.autoavaliacaoConcluida
    ).length;
    const diagnostico = participants.filter((item) => item.diagnosticoGerado).length;
    const recomendacoes = participants.filter(
      (item) => item.recomendacaoRecebida
    ).length;
    const cursos = participants.filter((item) => item.cursoRegistrado).length;
    const concluidos = participants.filter(
      (item) => item.statusPiloto === "piloto_concluido"
    ).length;
    const ativos = participants.filter((item) => item.ativoNoPiloto).length;

    const mediaLacunas =
      total > 0
        ? (
            participants.reduce((acc, item) => acc + (item.totalLacunas || 0), 0) /
            total
          ).toFixed(1)
        : "0.0";

    const mediaRecomendacoes =
      total > 0
        ? (
            participants.reduce(
              (acc, item) => acc + (item.totalRecomendacoes || 0),
              0
            ) / total
          ).toFixed(1)
        : "0.0";

    const mediaCursos =
      total > 0
        ? (
            participants.reduce(
              (acc, item) => acc + (item.totalCursosRealizados || 0),
              0
            ) / total
          ).toFixed(1)
        : "0.0";

    return {
      total,
      ativos,
      contexto,
      autoavaliacao,
      diagnostico,
      recomendacoes,
      cursos,
      concluidos,
      mediaLacunas,
      mediaRecomendacoes,
      mediaCursos,
    };
  }, [participants]);

  const alerts = useMemo(() => {
    const semAtividade = participants
      .filter((item) => {
        const days = getDaysWithoutActivity(item.ultimoAcessoEm);
        return days !== null && days >= 7 && item.ativoNoPiloto;
      })
      .slice(0, 5);

    const paradosNaAutoavaliacao = participants
      .filter(
        (item) =>
          item.contextoPreenchido &&
          !item.autoavaliacaoConcluida &&
          item.ativoNoPiloto
      )
      .slice(0, 5);

    const comRecomendacaoSemCurso = participants
      .filter(
        (item) =>
          item.recomendacaoRecebida &&
          !item.cursoRegistrado &&
          item.ativoNoPiloto
      )
      .slice(0, 5);

    return {
      semAtividade,
      paradosNaAutoavaliacao,
      comRecomendacaoSemCurso,
    };
  }, [participants]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
            <p className="text-sm text-muted-foreground">
              Panorama do piloto da pesquisa com base na coleção consolidada{" "}
              <span className="font-medium">pilotParticipants</span>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadData} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar
            </Button>

            <Link href="/admin/participantes">
              <Button variant="outline">
                Participantes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>

            <Link href="/admin/exportacoes">
              <Button>
                Exportações
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {isUserLoading || isLoading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando visão geral...
            </div>
          </div>
        ) : error ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                title="Participantes no piloto"
                value={metrics.total}
                description="Total de documentos consolidados em pilotParticipants."
                icon={<Users className="h-4 w-4" />}
              />

              <OverviewCard
                title="Ativos no piloto"
                value={metrics.ativos}
                description="Participantes atualmente marcados como ativos."
                icon={<Activity className="h-4 w-4" />}
              />

              <OverviewCard
                title="Autoavaliações concluídas"
                value={metrics.autoavaliacao}
                description="Participantes que já concluíram a autoavaliação."
                icon={<ClipboardList className="h-4 w-4" />}
              />

              <OverviewCard
                title="Piloto concluído"
                value={metrics.concluidos}
                description="Participantes com o fluxo marcado como concluído."
                icon={<GraduationCap className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <OverviewCard
                title="Média de lacunas"
                value={metrics.mediaLacunas}
                description="Média de lacunas por participante."
                icon={<BookOpen className="h-4 w-4" />}
              />

              <OverviewCard
                title="Média de recomendações"
                value={metrics.mediaRecomendacoes}
                description="Média de recomendações por participante."
                icon={<ClipboardList className="h-4 w-4" />}
              />

              <OverviewCard
                title="Média de cursos registrados"
                value={metrics.mediaCursos}
                description="Média de cursos realizados por participante."
                icon={<GraduationCap className="h-4 w-4" />}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Funil do piloto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <FunnelRow
                    label="Contexto preenchido"
                    value={metrics.contexto}
                    total={metrics.total}
                  />
                  <FunnelRow
                    label="Autoavaliação concluída"
                    value={metrics.autoavaliacao}
                    total={metrics.total}
                  />
                  <FunnelRow
                    label="Diagnóstico gerado"
                    value={metrics.diagnostico}
                    total={metrics.total}
                  />
                  <FunnelRow
                    label="Recomendação recebida"
                    value={metrics.recomendacoes}
                    total={metrics.total}
                  />
                  <FunnelRow
                    label="Curso registrado"
                    value={metrics.cursos}
                    total={metrics.total}
                  />
                  <FunnelRow
                    label="Piloto concluído"
                    value={metrics.concluidos}
                    total={metrics.total}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Participantes recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentParticipants.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                      Nenhum participante recente encontrado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentParticipants.map((participant) => (
                        <div
                          key={participant.userId}
                          className="rounded-xl border bg-white p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {participant.nome || "-"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {participant.unidadeNome || "-"} •{" "}
                                {participant.setorNome || "-"}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <StatusBadge status={participant.statusPiloto} />
                                <span className="inline-flex rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
                                  {getPilotStepLabel(participant.etapaAtual)}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 md:items-end">
                              <div className="text-xs text-muted-foreground">
                                Última atividade:{" "}
                                {formatDate(participant.ultimoAcessoEm)}
                              </div>
                              <Link href={`/admin/participantes/${participant.userId}`}>
                                <Button size="sm" variant="outline">
                                  Ver detalhes
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Alertas simples de acompanhamento
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="text-sm font-semibold">
                    Sem atividade há 7 dias ou mais
                  </h3>
                  <div className="mt-3 space-y-3">
                    {alerts.semAtividade.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum participante nesta condição.
                      </p>
                    ) : (
                      alerts.semAtividade.map((item) => (
                        <div key={item.userId} className="rounded-lg border p-3">
                          <div className="font-medium">{item.nome || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            Última atividade: {formatDate(item.ultimoAcessoEm)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4">
                  <h3 className="text-sm font-semibold">
                    Parados antes da autoavaliação
                  </h3>
                  <div className="mt-3 space-y-3">
                    {alerts.paradosNaAutoavaliacao.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum participante nesta condição.
                      </p>
                    ) : (
                      alerts.paradosNaAutoavaliacao.map((item) => (
                        <div key={item.userId} className="rounded-lg border p-3">
                          <div className="font-medium">{item.nome || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            Status: {getPilotStatusLabel(item.statusPiloto)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4">
                  <h3 className="text-sm font-semibold">
                    Com recomendação e sem curso registrado
                  </h3>
                  <div className="mt-3 space-y-3">
                    {alerts.comRecomendacaoSemCurso.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum participante nesta condição.
                      </p>
                    ) : (
                      alerts.comRecomendacaoSemCurso.map((item) => (
                        <div key={item.userId} className="rounded-lg border p-3">
                          <div className="font-medium">{item.nome || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            Etapa atual: {getPilotStepLabel(item.etapaAtual)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}