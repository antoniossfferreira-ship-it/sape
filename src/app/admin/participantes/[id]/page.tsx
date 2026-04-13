// src/app/admin/participantes/[id]/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import DashboardLayout from "@/components/layout/dashboard-layout";
import { useFirestore, useUser } from "@/firebase";

import { getParticipantDetailBundle } from "@/lib/admin/admin-queries";
import {
  getPilotStatusLabel,
  getPilotStepLabel,
} from "@/lib/admin/pilot-status";

import type {
  PilotParticipant,
  ResearchEvent,
  UserContextSummary,
} from "@/types/admin";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  ClipboardList,
  GraduationCap,
  Loader2,
  MessageSquare,
  UserRound,
} from "lucide-react";

type DetailBundle = {
  participant: PilotParticipant | null;
  context: UserContextSummary | null;
  assessments: Record<string, unknown>[];
  gaps: Record<string, unknown>[];
  recommendations: Record<string, unknown>[];
  feedbacks: Record<string, unknown>[];
  courses: Record<string, unknown>[];
  events: ResearchEvent[];
};

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

function getString(value: unknown, fallback = "-"): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

function StepBadge({ step }: { step: PilotParticipant["etapaAtual"] }) {
  return (
    <span className="inline-flex rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
      {getPilotStepLabel(step)}
    </span>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr] sm:gap-3">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export default function AdminParticipantDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const [data, setData] = useState<DetailBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!db || !userId) return;

      setIsLoading(true);
      setError("");

      try {
        const result = await getParticipantDetailBundle(db, userId);
        setData(result);
      } catch (err) {
        console.error("Erro ao carregar detalhe do participante:", err);
        setError("Não foi possível carregar os dados do participante.");
      } finally {
        setIsLoading(false);
      }
    }

    if (!db || isUserLoading) return;

    if (!user) {
      setIsLoading(false);
      setError("Usuário não autenticado.");
      return;
    }

    loadData();
  }, [db, user, isUserLoading, userId]);

  const derivedContext = useMemo(() => {
    const participant = data?.participant;
    if (!participant) return null;

    return {
      unidadeNome: getString(
        data?.context?.unidadeNome,
        getString((participant as Record<string, unknown>).unidadeNome)
      ),
      setorNome: getString(
        data?.context?.setorNome,
        getString((participant as Record<string, unknown>).setorNome)
      ),
      funcaoNome: getString(
        data?.context?.funcaoNome,
        getString((participant as Record<string, unknown>).funcaoNome)
      ),
      updatedAt:
        (data?.context as Record<string, unknown> | null)?.updatedAt ??
        (participant as Record<string, unknown>).updatedAt ??
        null,
    };
  }, [data]);

  const metrics = useMemo(() => {
    const participantRecord = (data?.participant ??
      {}) as Record<string, unknown>;

    const assessmentCompletedItems = getNumber(
      participantRecord.assessmentCompletedItems,
      0
    );
    const assessmentTotalItems = getNumber(
      participantRecord.assessmentTotalItems,
      0
    );
    const averageCurrentLevel = getNumber(
      participantRecord.averageCurrentLevel,
      0
    );
    const averageExpectedLevel = getNumber(
      participantRecord.averageExpectedLevel,
      0
    );
    const maxGapFromParticipant = getNumber(participantRecord.maxGap, 0);
    const hasGapsFromParticipant = Boolean(participantRecord.hasGaps);

    const assessmentLevels = (data?.assessments ?? [])
      .map((item) => getNumber(item.nivelAtual, NaN))
      .filter((n) => !Number.isNaN(n));

    const mediaNivelAutoavaliacao =
      assessmentLevels.length > 0
        ? assessmentLevels.reduce((acc, curr) => acc + curr, 0) /
          assessmentLevels.length
        : averageCurrentLevel;

    const gapValues = (data?.gaps ?? [])
      .map((item) => getNumber(item.gap, 0))
      .filter((n) => Number.isFinite(n));

    const maiorGap = gapValues.length
      ? Math.max(...gapValues)
      : maxGapFromParticipant;

    const eixoCount = new Map<string, number>();
    (data?.gaps ?? []).forEach((item) => {
      const eixo = getString(item.eixoNome, "");
      if (!eixo) return;
      eixoCount.set(eixo, (eixoCount.get(eixo) ?? 0) + 1);
    });

    let eixoPredominante = "-";
    let maxCount = 0;
    eixoCount.forEach((count, eixo) => {
      if (count > maxCount) {
        maxCount = count;
        eixoPredominante = eixo;
      }
    });

    if (
      eixoPredominante === "-" &&
      hasGapsFromParticipant &&
      getString((data?.participant as Record<string, unknown> | undefined)?.statusPiloto) ===
        "recomendacao_recebida"
    ) {
      eixoPredominante = "Detectado na consolidação do piloto";
    }

    const cargaHorariaTotal = (data?.courses ?? []).reduce((acc, course) => {
      return acc + getNumber(course.cargaHoraria, 0);
    }, 0);

    const competenciasAvaliadas =
      (data?.assessments?.length ?? 0) > 0
        ? data?.assessments.length ?? 0
        : assessmentCompletedItems;

    const totalLacunas =
      (data?.gaps?.length ?? 0) > 0
        ? data?.gaps.length ?? 0
        : hasGapsFromParticipant
        ? assessmentTotalItems > 0
          ? assessmentTotalItems
          : 1
        : 0;

    return {
      mediaNivelAutoavaliacao,
      maiorGap,
      eixoPredominante,
      cargaHorariaTotal,
      competenciasAvaliadas,
      totalLacunas,
      assessmentCompletedItems,
      assessmentTotalItems,
      averageExpectedLevel,
      hasGapsFromParticipant,
    };
  }, [data]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Link href="/admin/participantes">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para participantes
              </Button>
            </Link>

            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Detalhe do Participante
              </h1>
              <p className="text-sm text-muted-foreground">
                Visão consolidada da trajetória do participante no piloto da
                pesquisa.
              </p>
            </div>
          </div>
        </div>

        {isUserLoading || isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando dados do participante...
            </div>
          </div>
        ) : error ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              {error}
            </CardContent>
          </Card>
        ) : !data?.participant ? (
          <Card className="rounded-2xl">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Participante não encontrado em{" "}
              <span className="font-medium">pilotParticipants</span>.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StatusBadge status={data.participant.statusPiloto} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Etapa atual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <StepBadge step={data.participant.etapaAtual} />
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Conclusão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900 transition-all"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, data.participant.percentualConclusao || 0)
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {data.participant.percentualConclusao ?? 0}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Última atividade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">
                    {formatDate(data.participant.ultimoAcessoEm)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard title="Identificação" icon={<UserRound className="h-4 w-4" />}>
                <div className="divide-y">
                  <DataRow label="Nome" value={getString(data.participant.nome)} />
                  <DataRow
                    label="Matrícula"
                    value={getString(data.participant.matricula)}
                  />
                  <DataRow label="E-mail" value={getString(data.participant.email)} />
                  <DataRow
                    label="Unidade"
                    value={getString(
                      (data.participant as Record<string, unknown>).unidadeNome
                    )}
                  />
                  <DataRow
                    label="Setor"
                    value={getString(
                      (data.participant as Record<string, unknown>).setorNome
                    )}
                  />
                  <DataRow
                    label="Função"
                    value={getString(
                      (data.participant as Record<string, unknown>).funcaoNome
                    )}
                  />
                  <DataRow
                    label="Primeiro acesso"
                    value={formatDate(data.participant.primeiroAcessoEm)}
                  />
                  <DataRow
                    label="Ativo no piloto"
                    value={data.participant.ativoNoPiloto ? "Sim" : "Não"}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Contexto de trabalho"
                icon={<Briefcase className="h-4 w-4" />}
              >
                <div className="divide-y">
                  <DataRow
                    label="Unidade informada"
                    value={getString(derivedContext?.unidadeNome)}
                  />
                  <DataRow
                    label="Setor informado"
                    value={getString(derivedContext?.setorNome)}
                  />
                  <DataRow
                    label="Função informada"
                    value={getString(derivedContext?.funcaoNome)}
                  />
                  <DataRow
                    label="Atualizado em"
                    value={formatDate(derivedContext?.updatedAt)}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Autoavaliação"
                icon={<ClipboardList className="h-4 w-4" />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Competências avaliadas
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {metrics.competenciasAvaliadas}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Média dos níveis informados
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {metrics.mediaNivelAutoavaliacao.toFixed(1)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {(data.assessments?.length ?? 0) === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      {metrics.competenciasAvaliadas > 0 ? (
                        <>
                          Autoavaliação consolidada no piloto com{" "}
                          <span className="font-medium">
                            {metrics.competenciasAvaliadas}
                          </span>{" "}
                          competências preenchidas.
                        </>
                      ) : (
                        "Nenhuma autoavaliação encontrada."
                      )}
                    </div>
                  ) : (
                    <table className="w-full min-w-[700px] border-collapse">
                      <thead>
                        <tr className="border-b text-left text-sm text-muted-foreground">
                          <th className="px-3 py-3 font-medium">Competência</th>
                          <th className="px-3 py-3 font-medium">Eixo</th>
                          <th className="px-3 py-3 font-medium">Nível atual</th>
                          <th className="px-3 py-3 font-medium">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.assessments.map((item, index) => (
                          <tr key={String(item.id ?? index)} className="border-b text-sm">
                            <td className="px-3 py-3">
                              {getString(item.competenciaNome)}
                            </td>
                            <td className="px-3 py-3">
                              {getString(item.eixoNome)}
                            </td>
                            <td className="px-3 py-3">
                              {getNumber(item.nivelAtual, 0)}
                            </td>
                            <td className="px-3 py-3">
                              {formatDate(item.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Diagnóstico de lacunas"
                icon={<BookOpen className="h-4 w-4" />}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Total de lacunas
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {metrics.totalLacunas}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">Maior gap</div>
                      <div className="mt-1 text-2xl font-bold">
                        {metrics.maiorGap}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Eixo predominante
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {metrics.eixoPredominante}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {(data.gaps?.length ?? 0) === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      {metrics.totalLacunas > 0 ? (
                        <>
                          Diagnóstico consolidado no piloto com lacunas detectadas.
                          Média esperada:{" "}
                          <span className="font-medium">
                            {metrics.averageExpectedLevel.toFixed(1)}
                          </span>
                          .
                        </>
                      ) : (
                        "Nenhuma lacuna encontrada."
                      )}
                    </div>
                  ) : (
                    <table className="w-full min-w-[800px] border-collapse">
                      <thead>
                        <tr className="border-b text-left text-sm text-muted-foreground">
                          <th className="px-3 py-3 font-medium">Competência</th>
                          <th className="px-3 py-3 font-medium">Eixo</th>
                          <th className="px-3 py-3 font-medium">
                            Nível esperado
                          </th>
                          <th className="px-3 py-3 font-medium">Nível atual</th>
                          <th className="px-3 py-3 font-medium">Gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.gaps.map((item, index) => (
                          <tr key={String(item.id ?? index)} className="border-b text-sm">
                            <td className="px-3 py-3">
                              {getString(item.competenciaNome)}
                            </td>
                            <td className="px-3 py-3">
                              {getString(item.eixoNome)}
                            </td>
                            <td className="px-3 py-3">
                              {getNumber(item.nivelEsperado, 0)}
                            </td>
                            <td className="px-3 py-3">
                              {getNumber(item.nivelAtual, 0)}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {getNumber(item.gap, 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Recomendações e feedback"
                icon={<MessageSquare className="h-4 w-4" />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Total de recomendações
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {(data.recommendations?.length ?? 0) > 0
                          ? data.recommendations.length
                          : data.participant.recomendacaoRecebida
                          ? 1
                          : 0}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Feedbacks registrados
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {data.feedbacks.length}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {(data.recommendations?.length ?? 0) === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      {data.participant.recomendacaoRecebida ? (
                        "Recomendação inferida pela consolidação analítica do piloto, a partir das lacunas identificadas."
                      ) : (
                        "Nenhuma recomendação encontrada."
                      )}
                    </div>
                  ) : (
                    <table className="w-full min-w-[900px] border-collapse">
                      <thead>
                        <tr className="border-b text-left text-sm text-muted-foreground">
                          <th className="px-3 py-3 font-medium">Curso/Trilha</th>
                          <th className="px-3 py-3 font-medium">Tipo</th>
                          <th className="px-3 py-3 font-medium">Justificativa</th>
                          <th className="px-3 py-3 font-medium">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recommendations.map((item, index) => (
                          <tr key={String(item.id ?? index)} className="border-b text-sm">
                            <td className="px-3 py-3">
                              {getString(item.cursoNome, getString(item.trilhaNome))}
                            </td>
                            <td className="px-3 py-3">{getString(item.tipo)}</td>
                            <td className="px-3 py-3">
                              {getString(item.justificativa)}
                            </td>
                            <td className="px-3 py-3">
                              {formatDate(item.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {data.feedbacks.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {data.feedbacks.map((item, index) => (
                      <div
                        key={String(item.id ?? index)}
                        className="rounded-xl border bg-slate-50 p-4"
                      >
                        <div className="text-sm font-medium">
                          {getString(item.tipoFeedback)}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {getString(item.comentario, "Sem comentário.")}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Cursos realizados"
                icon={<GraduationCap className="h-4 w-4" />}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Cursos registrados
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {data.courses.length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-xl">
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground">
                        Carga horária total
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {metrics.cargaHorariaTotal}h
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {data.courses.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhum curso realizado registrado.
                    </div>
                  ) : (
                    <table className="w-full min-w-[850px] border-collapse">
                      <thead>
                        <tr className="border-b text-left text-sm text-muted-foreground">
                          <th className="px-3 py-3 font-medium">Curso</th>
                          <th className="px-3 py-3 font-medium">Modalidade</th>
                          <th className="px-3 py-3 font-medium">Carga horária</th>
                          <th className="px-3 py-3 font-medium">
                            Data de conclusão
                          </th>
                          <th className="px-3 py-3 font-medium">Certificado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.courses.map((item, index) => (
                          <tr key={String(item.id ?? index)} className="border-b text-sm">
                            <td className="px-3 py-3">
                              {getString(item.cursoNome)}
                            </td>
                            <td className="px-3 py-3">
                              {getString(item.modalidade)}
                            </td>
                            <td className="px-3 py-3">
                              {getNumber(item.cargaHoraria, 0)}h
                            </td>
                            <td className="px-3 py-3">
                              {formatDate(item.dataConclusao || item.createdAt)}
                            </td>
                            <td className="px-3 py-3">
                              {item.certificadoUrl ? (
                                <a
                                  href={String(item.certificadoUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-medium text-blue-700 hover:underline"
                                >
                                  Abrir certificado
                                </a>
                              ) : (
                                <span className="text-muted-foreground">
                                  Não anexado
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Eventos de pesquisa"
              icon={<MessageSquare className="h-4 w-4" />}
            >
              {data.events.length === 0 ? (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum evento registrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.events.map((event, index) => (
                    <div
                      key={String(event.id ?? index)}
                      className="rounded-xl border bg-white p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-medium">
                            {getString(event.tipoEvento)}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {getString(event.descricao, "Sem descrição.")}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Página: {getString(event.pagina)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(event.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}