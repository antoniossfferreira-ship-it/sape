// src/app/admin/participantes/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import DashboardLayout from "@/components/layout/dashboard-layout";
import { useFirestore, useUser } from "@/firebase";

import { getPilotParticipants } from "@/lib/admin/admin-queries";
import {
  getPilotStatusLabel,
  getPilotStepLabel,
} from "@/lib/admin/pilot-status";

import type { PilotParticipant } from "@/types/admin";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Loader2, Search, Users, RefreshCw } from "lucide-react";

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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
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

export default function AdminParticipantsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const [participants, setParticipants] = useState<PilotParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedStep, setSelectedStep] = useState("");
  const [selectedActive, setSelectedActive] = useState("");

  async function loadParticipants() {
    if (!db) return;

    setIsLoading(true);
    setError("");

    try {
      const data = await getPilotParticipants(db);
      setParticipants(data);
    } catch (err) {
      console.error("Erro ao carregar participantes do piloto:", err);
      setError(
        "Não foi possível carregar os participantes do piloto. Verifique as permissões e a coleção pilotParticipants."
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, user, isUserLoading]);

  const unitOptions = useMemo(() => {
    return Array.from(
      new Set(
        participants
          .map((item) => item.unidadeNome)
          .filter((value) => value && value.trim() !== "")
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [participants]);

  const sectorOptions = useMemo(() => {
    return Array.from(
      new Set(
        participants
          .map((item) => item.setorNome)
          .filter((value) => value && value.trim() !== "")
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [participants]);

  const roleOptions = useMemo(() => {
    return Array.from(
      new Set(
        participants
          .map((item) => item.funcaoNome)
          .filter((value) => value && value.trim() !== "")
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [participants]);

  const filteredParticipants = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return participants.filter((participant) => {
      const matchesSearch =
        !normalizedSearch ||
        normalizeText(participant.nome || "").includes(normalizedSearch) ||
        normalizeText(participant.matricula || "").includes(normalizedSearch) ||
        normalizeText(participant.email || "").includes(normalizedSearch);

      const matchesUnit =
        !selectedUnit || participant.unidadeNome === selectedUnit;

      const matchesSector =
        !selectedSector || participant.setorNome === selectedSector;

      const matchesRole =
        !selectedRole || participant.funcaoNome === selectedRole;

      const matchesStatus =
        !selectedStatus || participant.statusPiloto === selectedStatus;

      const matchesStep =
        !selectedStep || participant.etapaAtual === selectedStep;

      const matchesActive =
        !selectedActive ||
        (selectedActive === "ativos" && participant.ativoNoPiloto === true) ||
        (selectedActive === "inativos" && participant.ativoNoPiloto === false);

      return (
        matchesSearch &&
        matchesUnit &&
        matchesSector &&
        matchesRole &&
        matchesStatus &&
        matchesStep &&
        matchesActive
      );
    });
  }, [
    participants,
    searchTerm,
    selectedUnit,
    selectedSector,
    selectedRole,
    selectedStatus,
    selectedStep,
    selectedActive,
  ]);

  const summary = useMemo(() => {
    const total = filteredParticipants.length;
    const concluidos = filteredParticipants.filter(
      (item) => item.statusPiloto === "piloto_concluido"
    ).length;
    const comRecomendacao = filteredParticipants.filter(
      (item) => item.recomendacaoRecebida
    ).length;
    const ativos = filteredParticipants.filter(
      (item) => item.ativoNoPiloto
    ).length;

    return {
      total,
      concluidos,
      comRecomendacao,
      ativos,
    };
  }, [filteredParticipants]);

  function clearFilters() {
    setSearchTerm("");
    setSelectedUnit("");
    setSelectedSector("");
    setSelectedRole("");
    setSelectedStatus("");
    setSelectedStep("");
    setSelectedActive("");
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Participantes do Piloto
            </h1>
            <p className="text-sm text-muted-foreground">
              Acompanhamento básico dos participantes da pesquisa com base na
              coleção consolidada <span className="font-medium">pilotParticipants</span>.
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
              Atualizar
            </Button>

            <Link href="/admin/exportacoes">
              <Button type="button">Ir para Exportações</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total filtrado
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
                Ativos no piloto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{summary.ativos}</span>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Com recomendação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{summary.comRecomendacao}</span>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Piloto concluído
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{summary.concluidos}</span>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Busca e filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, matrícula ou e-mail"
                className="pl-9"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todas as unidades</option>
                {unitOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos os setores</option>
                {sectorOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todas as funções</option>
                {roleOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos os status</option>
                <option value="ativo">Ativo</option>
                <option value="contexto_preenchido">Contexto preenchido</option>
                <option value="autoavaliacao_concluida">
                  Autoavaliação concluída
                </option>
                <option value="diagnostico_gerado">Diagnóstico gerado</option>
                <option value="recomendacao_recebida">
                  Recomendação recebida
                </option>
                <option value="piloto_concluido">Piloto concluído</option>
                <option value="inativo">Inativo</option>
              </select>

              <select
                value={selectedStep}
                onChange={(e) => setSelectedStep(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todas as etapas</option>
                <option value="contexto">Contexto</option>
                <option value="autoavaliacao">Autoavaliação</option>
                <option value="diagnostico">Diagnóstico</option>
                <option value="recomendacoes">Recomendações</option>
                <option value="registro_cursos">Registro de cursos</option>
                <option value="concluido">Concluído</option>
              </select>

              <select
                value={selectedActive}
                onChange={(e) => setSelectedActive(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                <option value="ativos">Somente ativos</option>
                <option value="inativos">Somente inativos</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Lista de participantes</CardTitle>
          </CardHeader>
          <CardContent>
            {isUserLoading || isLoading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando participantes...
                </div>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            ) : filteredParticipants.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhum participante encontrado com os filtros atuais.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse">
                  <thead>
                    <tr className="border-b text-left text-sm text-muted-foreground">
                      <th className="px-3 py-3 font-medium">Nome</th>
                      <th className="px-3 py-3 font-medium">Unidade</th>
                      <th className="px-3 py-3 font-medium">Setor</th>
                      <th className="px-3 py-3 font-medium">Função</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Etapa</th>
                      <th className="px-3 py-3 font-medium">% Conclusão</th>
                      <th className="px-3 py-3 font-medium">Última atividade</th>
                      <th className="px-3 py-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((participant) => (
                      <tr
                        key={participant.userId}
                        className="border-b text-sm hover:bg-muted/40"
                      >
                        <td className="px-3 py-3 align-top">
                          <div className="font-medium">{participant.nome || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {participant.matricula || "-"}
                          </div>
                        </td>

                        <td className="px-3 py-3 align-top">
                          {participant.unidadeNome || "-"}
                        </td>

                        <td className="px-3 py-3 align-top">
                          {participant.setorNome || "-"}
                        </td>

                        <td className="px-3 py-3 align-top">
                          {participant.funcaoNome || "-"}
                        </td>

                        <td className="px-3 py-3 align-top">
                          <StatusBadge status={participant.statusPiloto} />
                        </td>

                        <td className="px-3 py-3 align-top">
                          <StepBadge step={participant.etapaAtual} />
                        </td>

                        <td className="px-3 py-3 align-top">
                          <div className="flex min-w-[140px] items-center gap-3">
                            <div className="h-2 flex-1 rounded-full bg-slate-100">
                              <div
                                className="h-2 rounded-full bg-slate-900 transition-all"
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, participant.percentualConclusao || 0)
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="w-10 text-xs text-muted-foreground">
                              {participant.percentualConclusao ?? 0}%
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-top">
                          {formatDate(participant.ultimoAcessoEm)}
                        </td>

                        <td className="px-3 py-3 align-top text-right">
                          <Link href={`/admin/participantes/${participant.userId}`}>
                            <Button variant="outline" size="sm">
                              Ver detalhes
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}