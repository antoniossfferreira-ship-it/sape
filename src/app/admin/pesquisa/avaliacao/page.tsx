"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, type Firestore } from "firebase/firestore";

import DashboardLayout from "@/components/layout/dashboard-layout";
import { useUser } from "@/firebase";
import { db } from "@/lib/firebase";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Search,
  UserCheck,
  Users,
} from "lucide-react";

type JsonRecord = Record<string, unknown>;

type PilotParticipant = {
  id: string;
  userId?: string;
  nome?: string;
  email?: string;
  matricula?: string;
  cargo?: string;
  funcao?: string;
  unidadeNome?: string;
  setorNome?: string;
  etapaAtual?: string;
  percentualConclusao?: number;
  recomendacaoRecebida?: boolean;
  hasGaps?: boolean;
};

type ResearchParticipant = {
  id: string;
  participantKey?: string;
  identity?: {
    name?: string;
    email?: string;
    matricula?: string;
  };
  pilotParticipantLink?: {
    status?: string;
    matchedBy?: string;
    pilotParticipantId?: string | null;
  };
  profileSnapshot?: {
    unidade?: string;
    setor?: string;
    areaDepartamentoSetor?: string;
    cargo?: string;
    funcao?: string;
    escolaridade?: string;
    tempoServicoUNEB?: string;
    areaFormacao?: string;
  };
  responseStatus?: {
    competencySurvey?: boolean;
    prototypeEvaluation?: boolean;
  };
  responseRefs?: {
    competencySurvey?: string | null;
    prototypeEvaluation?: string | null;
  };
  summary?: {
    competencySurvey?: {
      averageSpecific?: number;
      averageTransversal?: number;
      answeredSpecificCount?: number;
      answeredTransversalCount?: number;
    };
    prototypeEvaluation?: {
      averageScore?: number;
      respondedScoreCount?: number;
    };
  };
};

type IntegratedRow = {
  id: string;
  participantKey: string;
  nome: string;
  email: string;
  matricula: string;
  cargo: string;
  funcao: string;
  unidade: string;
  setor: string;
  etapaAtual: string;
  percentualConclusao: number;
  recomendacaoRecebida: boolean;
  hasGaps: boolean;
  respondeuLevantamento: boolean;
  respondeuAvaliacao: boolean;
  mediaCompetenciasEspecificas: number | null;
  mediaCompetenciasTransversais: number | null;
  mediaAvaliacaoPrototipo: number | null;
  itensRespondidosAvaliacao: number;
  linkageStatus: string;
  matchedBy: string;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getString(value: unknown, fallback = "-"): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function formatMaybeNumber(value: number | null, digits = 1): string {
  return value === null ? "-" : value.toFixed(digits);
}

function getParticipantReading(row: IntegratedRow): string {
  if (row.respondeuLevantamento && row.respondeuAvaliacao) {
    return "Participante com instrumentos principais completos, apto para leitura integrada da pesquisa.";
  }

  if (row.respondeuLevantamento) {
    return "Participante com diagnóstico registrado, ainda sem avaliação final consolidada.";
  }

  if (row.respondeuAvaliacao) {
    return "Participante avaliou o protótipo, mas o vínculo com o diagnóstico requer cautela interpretativa.";
  }

  return "Participante ainda sem instrumentos suficientes para leitura integrada.";
}

async function loadPilotParticipants(firestore: Firestore): Promise<PilotParticipant[]> {
  const snapshot = await getDocs(collection(firestore, "pilotParticipants"));

  return snapshot.docs.map((doc) => {
    const data = doc.data() as JsonRecord;
    return {
      id: doc.id,
      userId: getNullableString(data.userId),
      nome: getNullableString(data.nome),
      email: getNullableString(data.email),
      matricula: getNullableString(data.matricula),
      cargo: getNullableString(data.cargo),
      funcao: getNullableString(data.funcao),
      unidadeNome: getNullableString(data.unidadeNome),
      setorNome: getNullableString(data.setorNome),
      etapaAtual: getNullableString(data.etapaAtual),
      percentualConclusao: getNumber(data.percentualConclusao, 0),
      recomendacaoRecebida: getBoolean(data.recomendacaoRecebida, false),
      hasGaps: getBoolean(data.hasGaps, false),
    };
  });
}

async function loadResearchParticipants(firestore: Firestore): Promise<ResearchParticipant[]> {
  const snapshot = await getDocs(collection(firestore, "researchParticipants"));

  return snapshot.docs.map((doc) => {
    const data = doc.data() as JsonRecord;
    return {
      id: doc.id,
      participantKey: getNullableString(data.participantKey) ?? doc.id,
      identity: (data.identity as ResearchParticipant["identity"]) ?? {},
      pilotParticipantLink:
        (data.pilotParticipantLink as ResearchParticipant["pilotParticipantLink"]) ?? {},
      profileSnapshot:
        (data.profileSnapshot as ResearchParticipant["profileSnapshot"]) ?? {},
      responseStatus:
        (data.responseStatus as ResearchParticipant["responseStatus"]) ?? {},
      responseRefs: (data.responseRefs as ResearchParticipant["responseRefs"]) ?? {},
      summary: (data.summary as ResearchParticipant["summary"]) ?? {},
    };
  });
}

export default function AdminPesquisaAvaliacaoPage() {
  const { user, isUserLoading } = useUser();
  const firestore = db;

  const [pilotParticipants, setPilotParticipants] = useState<PilotParticipant[]>([]);
  const [researchParticipants, setResearchParticipants] = useState<ResearchParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  async function loadData() {
    if (!firestore) return;

    setIsLoading(true);
    setError("");

    try {
      const [pilotData, researchData] = await Promise.all([
        loadPilotParticipants(firestore),
        loadResearchParticipants(firestore),
      ]);

      setPilotParticipants(pilotData);
      setResearchParticipants(researchData);
    } catch (err) {
      console.error("Erro ao carregar avaliação integrada da pesquisa:", err);
      setError(
        "Não foi possível carregar os dados integrados da pesquisa. Verifique as coleções pilotParticipants e researchParticipants."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!firestore || isUserLoading) return;

    if (!user) {
      setIsLoading(false);
      setError("Usuário não autenticado.");
      return;
    }

    loadData();
  }, [firestore, user, isUserLoading]);

  const integratedRows = useMemo<IntegratedRow[]>(() => {
    const pilotById = new Map<string, PilotParticipant>();
    const pilotByEmail = new Map<string, PilotParticipant>();
    const pilotByMatricula = new Map<string, PilotParticipant>();

    pilotParticipants.forEach((item) => {
      pilotById.set(item.id, item);

      const normalizedEmail = item.email ? normalizeText(item.email) : "";
      const normalizedMatricula = item.matricula ? normalizeText(item.matricula) : "";

      if (normalizedEmail) pilotByEmail.set(normalizedEmail, item);
      if (normalizedMatricula) pilotByMatricula.set(normalizedMatricula, item);
    });

    return researchParticipants.map((research) => {
      const identityName = getNullableString(research.identity?.name);
      const identityEmail = getNullableString(research.identity?.email);
      const identityMatricula = getNullableString(research.identity?.matricula);

      const linkedPilotId = getNullableString(research.pilotParticipantLink?.pilotParticipantId);
      const linkedPilot =
        (linkedPilotId ? pilotById.get(linkedPilotId) : undefined) ??
        (identityEmail ? pilotByEmail.get(normalizeText(identityEmail)) : undefined) ??
        (identityMatricula ? pilotByMatricula.get(normalizeText(identityMatricula)) : undefined);

      return {
        id: research.id,
        participantKey: getString(research.participantKey, research.id),
        nome: getString(identityName ?? linkedPilot?.nome),
        email: getString(identityEmail ?? linkedPilot?.email),
        matricula: getString(identityMatricula ?? linkedPilot?.matricula),
        cargo: getString(research.profileSnapshot?.cargo ?? linkedPilot?.cargo),
        funcao: getString(research.profileSnapshot?.funcao ?? linkedPilot?.funcao),
        unidade: getString(research.profileSnapshot?.unidade ?? linkedPilot?.unidadeNome),
        setor: getString(
          research.profileSnapshot?.setor ??
            research.profileSnapshot?.areaDepartamentoSetor ??
            linkedPilot?.setorNome
        ),
        etapaAtual: getString(linkedPilot?.etapaAtual, "instrumentos_importados"),
        percentualConclusao: getNumber(linkedPilot?.percentualConclusao, 0),
        recomendacaoRecebida: getBoolean(linkedPilot?.recomendacaoRecebida, false),
        hasGaps: getBoolean(linkedPilot?.hasGaps, false),
        respondeuLevantamento: getBoolean(research.responseStatus?.competencySurvey, false),
        respondeuAvaliacao: getBoolean(research.responseStatus?.prototypeEvaluation, false),
        mediaCompetenciasEspecificas: getNullableNumber(
          research.summary?.competencySurvey?.averageSpecific
        ),
        mediaCompetenciasTransversais: getNullableNumber(
          research.summary?.competencySurvey?.averageTransversal
        ),
        mediaAvaliacaoPrototipo: getNullableNumber(
          research.summary?.prototypeEvaluation?.averageScore
        ),
        itensRespondidosAvaliacao: getNumber(
          research.summary?.prototypeEvaluation?.respondedScoreCount,
          0
        ),
        linkageStatus: getString(research.pilotParticipantLink?.status, "-"),
        matchedBy: getString(research.pilotParticipantLink?.matchedBy, "-"),
      };
    });
  }, [pilotParticipants, researchParticipants]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    if (!normalizedSearch) return integratedRows;

    return integratedRows.filter((row) => {
      return [
        row.nome,
        row.email,
        row.matricula,
        row.cargo,
        row.funcao,
        row.unidade,
        row.setor,
        row.participantKey,
      ]
        .map((value) => normalizeText(value === "-" ? "" : value))
        .some((value) => value.includes(normalizedSearch));
    });
  }, [integratedRows, searchTerm]);

  const summary = useMemo(() => {
    const total = filteredRows.length;
    const responderamLevantamento = filteredRows.filter((row) => row.respondeuLevantamento).length;
    const responderamAvaliacao = filteredRows.filter((row) => row.respondeuAvaliacao).length;
    const participacaoCompleta = filteredRows.filter(
      (row) => row.respondeuLevantamento && row.respondeuAvaliacao
    ).length;

    const mediasAvaliacao = filteredRows
      .map((row) => row.mediaAvaliacaoPrototipo)
      .filter((value): value is number => value !== null);

    const mediasEspecificas = filteredRows
      .map((row) => row.mediaCompetenciasEspecificas)
      .filter((value): value is number => value !== null);

    const mediasTransversais = filteredRows
      .map((row) => row.mediaCompetenciasTransversais)
      .filter((value): value is number => value !== null);

    const avg = (values: number[]) =>
      values.length > 0 ? values.reduce((acc, value) => acc + value, 0) / values.length : null;

    return {
      total,
      responderamLevantamento,
      responderamAvaliacao,
      participacaoCompleta,
      mediaAvaliacao: avg(mediasAvaliacao),
      mediaEspecificas: avg(mediasEspecificas),
      mediaTransversais: avg(mediasTransversais),
    };
  }, [filteredRows]);

  const evaluationDistribution = useMemo(() => {
    const buckets = [
      { label: "4,5 a 5,0", min: 4.5, max: 5.01, count: 0 },
      { label: "3,5 a 4,4", min: 3.5, max: 4.5, count: 0 },
      { label: "2,5 a 3,4", min: 2.5, max: 3.5, count: 0 },
      { label: "abaixo de 2,5", min: 0, max: 2.5, count: 0 },
    ];

    filteredRows.forEach((row) => {
      const score = row.mediaAvaliacaoPrototipo;
      if (score === null) return;

      const bucket = buckets.find((item) => score >= item.min && score < item.max);
      if (bucket) bucket.count += 1;
    });

    return buckets;
  }, [filteredRows]);

  const stageDistribution = useMemo(() => {
    const map = new Map<string, number>();

    filteredRows.forEach((row) => {
      map.set(row.etapaAtual, (map.get(row.etapaAtual) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }, [filteredRows]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="space-y-3">
          <Link href="/admin/pesquisa">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para pesquisa
            </Button>
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-4xl space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Avaliação integrada da pesquisa
              </h1>
              <p className="text-sm text-muted-foreground">
                Leitura integrada entre percurso no protótipo, levantamento de competências
                e avaliação do sistema, com foco analítico para a dissertação.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={loadData}
              disabled={isLoading || !firestore}
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
              Carregando avaliação integrada...
            </div>
          </div>
        ) : error ? (
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Participantes integrados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{summary.total}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Responderam levantamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {summary.responderamLevantamento}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Responderam avaliação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {summary.responderamAvaliacao}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Participação completa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">
                      {summary.participacaoCompleta}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Média avaliação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">
                    {formatMaybeNumber(summary.mediaAvaliacao)}
                  </span>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Média competências
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div>
                      Esp.:{" "}
                      <span className="font-semibold">
                        {formatMaybeNumber(summary.mediaEspecificas)}
                      </span>
                    </div>
                    <div>
                      Transv.:{" "}
                      <span className="font-semibold">
                        {formatMaybeNumber(summary.mediaTransversais)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Busca</CardTitle>
                <CardDescription>
                  Pesquise por nome, matrícula, e-mail, cargo, função, unidade ou setor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar participante"
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2.5fr)_340px]">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Base integrada da pesquisa</CardTitle>
                  <CardDescription>
                    Articulação entre identidade do participante, percurso no sistema e instrumentos aplicados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredRows.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhum participante encontrado com os filtros atuais.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1480px] border-collapse">
                        <thead>
                          <tr className="border-b text-left text-sm text-muted-foreground">
                            <th className="px-3 py-3 font-medium">Participante</th>
                            <th className="px-3 py-3 font-medium">Perfil</th>
                            <th className="px-3 py-3 font-medium">Percurso</th>
                            <th className="px-3 py-3 font-medium">Levantamento</th>
                            <th className="px-3 py-3 font-medium">Avaliação</th>
                            <th className="px-3 py-3 font-medium">Vínculo</th>
                            <th className="px-3 py-3 font-medium">Leitura analítica</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row) => (
                            <tr key={row.id} className="border-b text-sm hover:bg-muted/40">
                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[220px] space-y-1">
                                  <div className="font-medium break-words">{row.nome}</div>
                                  <div className="text-xs text-muted-foreground break-all">
                                    {row.email}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Matrícula: {row.matricula}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[220px] space-y-1 text-sm">
                                  <div>
                                    <span className="font-medium">Cargo:</span> {row.cargo}
                                  </div>
                                  <div>
                                    <span className="font-medium">Função:</span> {row.funcao}
                                  </div>
                                  <div>
                                    <span className="font-medium">Unidade:</span> {row.unidade}
                                  </div>
                                  <div>
                                    <span className="font-medium">Setor:</span> {row.setor}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[180px] space-y-2">
                                  <div className="text-sm">{row.etapaAtual}</div>
                                  <div className="flex min-w-[120px] items-center gap-2">
                                    <div className="h-2 flex-1 rounded-full bg-slate-100">
                                      <div
                                        className="h-2 rounded-full bg-slate-900 transition-all"
                                        style={{
                                          width: `${Math.max(
                                            0,
                                            Math.min(100, row.percentualConclusao)
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="w-10 text-xs text-muted-foreground">
                                      {row.percentualConclusao}%
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Recomendação: {row.recomendacaoRecebida ? "sim" : "não"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Lacunas: {row.hasGaps ? "sim" : "não"}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[180px] space-y-1">
                                  <div className="text-sm">
                                    Status:{" "}
                                    <span className="font-medium">
                                      {row.respondeuLevantamento ? "respondeu" : "não respondeu"}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Média específica:{" "}
                                    {formatMaybeNumber(row.mediaCompetenciasEspecificas)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Média transversal:{" "}
                                    {formatMaybeNumber(row.mediaCompetenciasTransversais)}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[180px] space-y-1">
                                  <div className="text-sm">
                                    Status:{" "}
                                    <span className="font-medium">
                                      {row.respondeuAvaliacao ? "respondeu" : "não respondeu"}
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Média geral: {formatMaybeNumber(row.mediaAvaliacaoPrototipo)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Itens pontuados: {row.itensRespondidosAvaliacao}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[150px] space-y-1 text-xs text-muted-foreground">
                                  <div>
                                    <span className="font-medium text-foreground">Status:</span>{" "}
                                    {row.linkageStatus}
                                  </div>
                                  <div>
                                    <span className="font-medium text-foreground">Critério:</span>{" "}
                                    {row.matchedBy}
                                  </div>
                                  <div>
                                    <span className="font-medium text-foreground">Chave:</span>{" "}
                                    {row.participantKey}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                <div className="max-w-[260px] break-words text-sm">
                                  {getParticipantReading(row)}
                                </div>
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
                    <CardTitle>Distribuição da avaliação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {evaluationDistribution.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-3 rounded-xl border p-3"
                      >
                        <span className="text-sm">{item.label}</span>
                        <span className="text-sm font-semibold">{item.count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Distribuição por etapa</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stageDistribution.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Nenhuma distribuição disponível.
                      </div>
                    ) : (
                      stageDistribution.map((item) => (
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
                    <CardTitle>Leitura metodológica</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Esta página articula duas dimensões da pesquisa: o percurso registrado
                      no protótipo e as respostas obtidas nos instrumentos complementares.
                    </p>
                    <p>
                      Com isso, a análise deixa de observar apenas uso do sistema e passa a
                      considerar também diagnóstico de competências e percepção dos participantes.
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle>Leitura consolidada</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      O painel favorece uma interpretação mais robusta dos resultados da pesquisa,
                      especialmente na articulação entre perfil, lacunas, recomendações e avaliação
                      do protótipo.
                    </p>
                    <p>
                      Para a dissertação, esta área funciona como base de conferência e apoio à
                      redação da análise final.
                    </p>
                    <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      Vínculo dos participantes consolidado com sucesso.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Síntese analítica do painel</CardTitle>
                <CardDescription>
                  Indicadores diretamente úteis para a interpretação dos resultados da pesquisa.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <BarChart3 className="h-4 w-4" />
                    Dados quantitativos
                  </div>
                  <p className="text-sm text-muted-foreground">
                    O painel reúne médias do levantamento de competências e da avaliação do
                    protótipo, permitindo observar tendências gerais do grupo participante.
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <ClipboardList className="h-4 w-4" />
                    Dados de percurso
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A presença de etapa atual, conclusão, lacunas e recomendação recebida ajuda a
                    situar cada participante no fluxo real de uso do sistema.
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <MessageSquareQuote className="h-4 w-4" />
                    Integração metodológica
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A junção entre dados operacionais e instrumentos da pesquisa fortalece a
                    consistência analítica do protótipo para a dissertação.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}