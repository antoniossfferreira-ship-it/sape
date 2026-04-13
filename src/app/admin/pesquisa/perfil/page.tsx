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
  Building2,
  Briefcase,
  Loader2,
  RefreshCw,
  Search,
  Users,
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

export default function AdminPesquisaPerfilPage() {
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
      console.error("Erro ao carregar perfil dos participantes:", err);
      setError(
        "Não foi possível carregar os dados dos participantes. Verifique a coleção pilotParticipants."
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
      const funcao = normalizeText(
        getString((participant as Record<string, unknown>).funcaoNome, "")
      );

      return (
        nome.includes(normalizedSearch) ||
        matricula.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        unidade.includes(normalizedSearch) ||
        setor.includes(normalizedSearch) ||
        funcao.includes(normalizedSearch)
      );
    });
  }, [participants, searchTerm]);

  const summary = useMemo(() => {
    const total = filteredParticipants.length;

    const unidades = Array.from(
      new Set(
        filteredParticipants
          .map((item) =>
            getString((item as Record<string, unknown>).unidadeNome, "")
          )
          .filter((value) => value)
      )
    );

    const setores = Array.from(
      new Set(
        filteredParticipants
          .map((item) =>
            getString((item as Record<string, unknown>).setorNome, "")
          )
          .filter((value) => value)
      )
    );

    const funcoes = Array.from(
      new Set(
        filteredParticipants
          .map((item) =>
            getString((item as Record<string, unknown>).funcaoNome, "")
          )
          .filter((value) => value)
      )
    );

    const ativos = filteredParticipants.filter((item) => item.ativoNoPiloto).length;

    return {
      total,
      unidades: unidades.length,
      setores: setores.length,
      funcoes: funcoes.length,
      ativos,
    };
  }, [filteredParticipants]);

  const unitDistribution = useMemo(() => {
    const map = new Map<string, number>();

    filteredParticipants.forEach((item) => {
      const unidade = getString(
        (item as Record<string, unknown>).unidadeNome,
        "Não informada"
      );
      map.set(unidade, (map.get(unidade) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }, [filteredParticipants]);

  const sectorDistribution = useMemo(() => {
    const map = new Map<string, number>();

    filteredParticipants.forEach((item) => {
      const setor = getString(
        (item as Record<string, unknown>).setorNome,
        "Não informado"
      );
      map.set(setor, (map.get(setor) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }, [filteredParticipants]);

  const roleDistribution = useMemo(() => {
    const map = new Map<string, number>();

    filteredParticipants.forEach((item) => {
      const funcao = getString(
        (item as Record<string, unknown>).funcaoNome,
        "Não informada"
      );
      map.set(funcao, (map.get(funcao) ?? 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
  }, [filteredParticipants]);

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
                Perfil dos Participantes
              </h1>
              <p className="text-sm text-muted-foreground">
                Consolidação do perfil dos participantes do piloto, com foco em
                unidade, setor, função e situação no percurso do sistema.
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
              Carregando perfil dos participantes...
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
                    Participantes
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
                    Unidades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{summary.unidades}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Setores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">{summary.setores}</span>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Funções
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold">{summary.funcoes}</span>
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
                    placeholder="Buscar por nome, matrícula, e-mail, unidade, setor ou função"
                    className="pl-9"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="rounded-2xl xl:col-span-2">
                <CardHeader>
                  <CardTitle>Participantes consolidados</CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredParticipants.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhum participante encontrado com os filtros atuais.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1000px] border-collapse">
                        <thead>
                          <tr className="border-b text-left text-sm text-muted-foreground">
                            <th className="px-3 py-3 font-medium">Nome</th>
                            <th className="px-3 py-3 font-medium">Matrícula</th>
                            <th className="px-3 py-3 font-medium">Unidade</th>
                            <th className="px-3 py-3 font-medium">Setor</th>
                            <th className="px-3 py-3 font-medium">Função</th>
                            <th className="px-3 py-3 font-medium">Status</th>
                            <th className="px-3 py-3 font-medium">% Conclusão</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredParticipants.map((participant) => (
                            <tr
                              key={participant.userId}
                              className="border-b text-sm hover:bg-muted/40"
                            >
                              <td className="px-3 py-3 align-top">
                                <div className="font-medium">
                                  {getString(participant.nome)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {getString(participant.email)}
                                </div>
                              </td>

                              <td className="px-3 py-3 align-top">
                                {getString(participant.matricula)}
                              </td>

                              <td className="px-3 py-3 align-top">
                                {getString(
                                  (participant as Record<string, unknown>).unidadeNome
                                )}
                              </td>

                              <td className="px-3 py-3 align-top">
                                {getString(
                                  (participant as Record<string, unknown>).setorNome
                                )}
                              </td>

                              <td className="px-3 py-3 align-top">
                                {getString(
                                  (participant as Record<string, unknown>).funcaoNome
                                )}
                              </td>

                              <td className="px-3 py-3 align-top">
                                <StatusBadge status={participant.statusPiloto} />
                              </td>

                              <td className="px-3 py-3 align-top">
                                <div className="flex min-w-[140px] items-center gap-3">
                                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                                    <div
                                      className="h-2 rounded-full bg-slate-900 transition-all"
                                      style={{
                                        width: `${Math.max(
                                          0,
                                          Math.min(
                                            100,
                                            participant.percentualConclusao || 0
                                          )
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="w-10 text-xs text-muted-foreground">
                                    {participant.percentualConclusao ?? 0}%
                                  </span>
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
                    <CardTitle>Distribuição por unidade</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {unitDistribution.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Nenhuma unidade encontrada.
                      </div>
                    ) : (
                      unitDistribution.map((item) => (
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
                    <CardTitle>Distribuição por setor</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sectorDistribution.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Nenhum setor encontrado.
                      </div>
                    ) : (
                      sectorDistribution.map((item) => (
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
                    <CardTitle>Distribuição por função</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {roleDistribution.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        Nenhuma função encontrada.
                      </div>
                    ) : (
                      roleDistribution.map((item) => (
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
              </div>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Leitura analítica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Esta página consolida informações de perfil dos participantes do
                  piloto, permitindo identificar a diversidade institucional presente
                  na pesquisa em termos de unidade, setor e função.
                </p>
                <p>
                  Os dados aqui apresentados oferecem suporte direto à análise do
                  perfil dos participantes, favorecendo a redação da seção 7.1 da
                  dissertação e a caracterização do grupo envolvido no piloto do SAPE.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}