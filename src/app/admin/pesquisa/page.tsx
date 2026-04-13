"use client";

import Link from "next/link";

import DashboardLayout from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Layers3,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";

const modules = [
  {
    title: "Perfil dos participantes",
    description:
      "Visualize a caracterização geral dos participantes do piloto, com foco em identificação, contexto institucional e presença na base da pesquisa.",
    href: "/admin/pesquisa/perfil",
    icon: UserRoundSearch,
    badge: "Base do piloto",
  },
  {
    title: "Lacunas de competências",
    description:
      "Acompanhe as lacunas identificadas no diagnóstico e observe como elas se distribuem entre os participantes da pesquisa.",
    href: "/admin/pesquisa/lacunas",
    icon: ClipboardList,
    badge: "Diagnóstico",
  },
  {
    title: "Recomendações geradas",
    description:
      "Analise as recomendações produzidas pelo protótipo e sua relação com as competências e necessidades formativas identificadas.",
    href: "/admin/pesquisa/recomendacoes",
    icon: Sparkles,
    badge: "Motor de recomendação",
  },
  {
    title: "Avaliação integrada da pesquisa",
    description:
      "Reúna, em uma única leitura, o percurso do participante no sistema, o levantamento de competências e a avaliação do protótipo.",
    href: "/admin/pesquisa/avaliacao",
    icon: MessageSquareQuote,
    badge: "Integração analítica",
    highlight: true,
  },
  {
    title: "Exportações e consolidação",
    description:
      "Centralize saídas para relatórios, planilhas e materiais de apoio à análise final da dissertação.",
    href: "/admin/pesquisa/exportacoes",
    icon: FileSpreadsheet,
    badge: "Síntese",
  },
];

const methodologicalPoints = [
  "pilotParticipants como base do percurso de uso do protótipo",
  "researchParticipants como camada de integração analítica da pesquisa",
  "competencySurveyResponses para o levantamento de competências",
  "prototypeEvaluationResponses para a percepção dos participantes sobre o protótipo",
];

export default function AdminPesquisaPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="space-y-3">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para a área administrativa
            </Button>
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-4xl space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Pesquisa e avaliação do protótipo
              </h1>
              <p className="text-sm text-muted-foreground">
                Painel administrativo da pesquisa do SAPE, voltado à leitura integrada
                do perfil dos participantes, das lacunas identificadas, das
                recomendações geradas e da avaliação do protótipo.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border bg-background px-3 py-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Estrutura orientada à dissertação
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_340px]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="h-5 w-5" />
                Organização da área de pesquisa
              </CardTitle>
              <CardDescription>
                Esta área foi organizada para sustentar a análise acadêmica do
                protótipo de forma clara, coerente e rastreável.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                O painel foi pensado para que a pesquisa não fique restrita apenas ao
                uso do sistema, mas avance para uma leitura integrada entre{" "}
                <span className="font-medium text-foreground">perfil do participante</span>,
                {" "}
                <span className="font-medium text-foreground">lacunas de competências</span>,
                {" "}
                <span className="font-medium text-foreground">recomendações geradas</span> e{" "}
                <span className="font-medium text-foreground">avaliação do protótipo</span>.
              </p>
              <p>
                Com isso, a área administrativa passa a apoiar tanto a observação
                operacional do piloto quanto a consolidação dos resultados da pesquisa
                para a dissertação.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">Destaque metodológico</CardTitle>
              <CardDescription>
                Núcleo da integração analítica da pesquisa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border bg-background p-3">
                <div className="font-medium">Página-chave</div>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Avaliação integrada da pesquisa
                  </span>{" "}
                  é o espaço central para cruzar percurso, instrumentos e percepção
                  dos participantes.
                </div>
              </div>

              <Link href="/admin/pesquisa/avaliacao">
                <Button className="w-full">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Abrir avaliação integrada
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <Card
                key={module.href}
                className={
                  module.highlight
                    ? "rounded-2xl border-primary/30 bg-primary/5"
                    : "rounded-2xl"
                }
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                      {module.badge}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription className="text-sm leading-6">
                      {module.description}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent>
                  <Link href={module.href}>
                    <Button
                      variant={module.highlight ? "default" : "outline"}
                      className="w-full"
                    >
                      Acessar módulo
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Estrutura recomendada das coleções</CardTitle>
            <CardDescription>
              Organização simples e coerente com um protótipo acadêmico
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {methodologicalPoints.map((item) => (
              <div
                key={item}
                className="rounded-xl border p-3 text-sm text-muted-foreground"
              >
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Leitura orientadora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Nesta estrutura, cada módulo cumpre uma função analítica específica,
              mas a interpretação mais forte da pesquisa emerge quando os dados são
              observados de forma articulada.
            </p>
            <p>
              Por isso, a página de avaliação integrada ocupa papel central: ela
              permite identificar quem participou, quais lacunas foram percebidas,
              que recomendações foram geradas e como o protótipo foi avaliado pelos
              participantes.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
