"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  useFirestore,
  useUser,
  useDoc,
  useMemoFirebase,
} from "@/firebase";
import { doc } from "firebase/firestore";

import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type QuickAction = {
  title: string;
  description: string;
  href: string;
  cta: string;
  highlight?: boolean;
};

type StepItem = {
  number: string;
  title: string;
  description: string;
};

type FeatureItem = {
  title: string;
  description: string;
};

type RecommendationItem = {
  recommendationId: string;
  title: string;
  progressStatus?:
    | "NAO_INICIADO"
    | "EM_DESENVOLVIMENTO"
    | "AGUARDANDO_REAVALIACAO";
};

type RecommendationDocument = {
  recommendations?: RecommendationItem[];
};

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const userDocRef = useMemoFirebase(() => {
    if (!isMounted || !user || !db) return null;
    return doc(db, "users", user.uid);
  }, [user, db, isMounted]);

  const { data: profile, isLoading: isLoadingProfile } = useDoc(userDocRef);

  const professionalContextRef = useMemoFirebase(() => {
    if (!isMounted || !user || !db) return null;
    return doc(db, "users", user.uid, "context", "professionalContext");
  }, [user, db, isMounted]);

  const { data: professionalContext, isLoading: isLoadingContext } =
    useDoc(professionalContextRef);

  const assessmentRef = useMemoFirebase(() => {
    if (!isMounted || !user || !db) return null;
    return doc(db, "users", user.uid, "assessment", "competencies");
  }, [user, db, isMounted]);

  const { data: assessmentData, isLoading: isLoadingAssessment } =
    useDoc(assessmentRef);

  const recommendationsRef = useMemoFirebase(() => {
    if (!isMounted || !user || !db) return null;
    return doc(db, "users", user.uid, "recommendations", "current");
  }, [user, db, isMounted]);

  const { data: recommendationsDoc, isLoading: isLoadingRecommendations } =
    useDoc(recommendationsRef);

  const recommendations = useMemo<RecommendationItem[]>(() => {
    const raw = recommendationsDoc as RecommendationDocument | null | undefined;
    return Array.isArray(raw?.recommendations) ? raw.recommendations : [];
  }, [recommendationsDoc]);

  const quickActions: QuickAction[] = [
    {
      title: "Atualizar contexto de trabalho",
      description:
        "Informe unidade, setor e função para que o sistema identifique o perfil esperado de competências.",
      href: "/dashboard/context",
      cta: "Acessar contexto",
      highlight: true,
    },
    {
      title: "Realizar autoavaliação",
      description:
        "Registre seu nível percebido em cada competência para permitir uma análise personalizada.",
      href: "/dashboard/assessment",
      cta: "Ir para autoavaliação",
    },
    {
      title: "Explorar recomendações",
      description:
        "Veja cursos, trilhas e sugestões formativas alinhadas ao seu perfil e às suas necessidades.",
      href: "/dashboard/recommendations",
      cta: "Ver recomendações",
    },
    {
      title: "Registrar cursos realizados",
      description:
        "Mantenha seu histórico formativo atualizado para acompanhar seu desenvolvimento ao longo do tempo.",
      href: "/dashboard/completed",
      cta: "Registrar cursos",
    },
    {
      title: "Ver diagnóstico",
      description:
        "Consulte os pontos fortes, as lacunas de desenvolvimento e as prioridades formativas identificadas.",
      href: "/dashboard/diagnostic",
      cta: "Abrir diagnóstico",
    },
  ];

  const steps: StepItem[] = [
    {
      number: "01",
      title: "Contexto funcional",
      description:
        "O servidor informa unidade, setor, cargo e/ou função para caracterizar seu contexto de atuação.",
    },
    {
      number: "02",
      title: "Autoavaliação de competências",
      description:
        "O sistema coleta a percepção do usuário sobre seu nível atual em competências relevantes ao trabalho.",
    },
    {
      number: "03",
      title: "Recomendação personalizada",
      description:
        "Com base nas lacunas identificadas, o sistema sugere cursos e percursos formativos mais aderentes.",
    },
    {
      number: "04",
      title: "Cursos realizados",
      description:
        "O usuário registra as formações concluídas para acompanhar seu histórico de desenvolvimento.",
    },
    {
      number: "05",
      title: "Diagnóstico",
      description:
        "O sistema consolida as informações para apoiar a leitura do desenvolvimento profissional.",
    },
  ];

  const features: FeatureItem[] = [
    {
      title: "Personalização formativa",
      description:
        "As recomendações consideram o contexto de trabalho e as necessidades de desenvolvimento do usuário.",
    },
    {
      title: "Acompanhamento do progresso",
      description:
        "O sistema favorece o registro de cursos realizados e a visualização da evolução formativa.",
    },
    {
      title: "Apoio à qualificação continuada",
      description:
        "O SAPE foi concebido para fortalecer a formação em serviço dos servidores técnico-administrativos.",
    },
    {
      title: "Base institucional",
      description:
        "A proposta valoriza uma identidade visual alinhada à UNEB e uma navegação simples e objetiva.",
    },
  ];

  const getNextStep = () => {
    if (!professionalContext?.unidadeId || !professionalContext?.setorId) {
      return { href: "/dashboard/context", label: "Começar: Preencher Contexto" };
    }
    if (!assessmentData?.items || assessmentData.items.length === 0) {
      return { href: "/dashboard/assessment", label: "Continuar: Autoavaliação" };
    }
    if (recommendations.length === 0) {
      return {
        href: "/dashboard/recommendations",
        label: "Ver minhas recomendações",
      };
    }
    return {
      href: "/dashboard/diagnostic",
      label: "Acompanhar meu desenvolvimento",
    };
  };

  const nextStep = getNextStep();

  const isLoading =
    !isMounted ||
    isUserLoading ||
    isLoadingProfile ||
    isLoadingContext ||
    isLoadingAssessment ||
    isLoadingRecommendations;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <section className="bg-white">
          <div className="mx-auto max-w-7xl py-2">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-900 via-blue-900 to-cyan-800 shadow-sm">
              <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.4fr_0.8fr] md:px-10 md:py-10">
                <div className="flex flex-col justify-center">
                  <div className="mb-4 inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90 backdrop-blur">
                    Plataforma institucional de desenvolvimento formativo
                  </div>

                  <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                    Bem-vindo(a) ao{" "}
                    <span className="text-cyan-200">SAPE</span>
                    {profile?.nome ? (
                      <>
                        , <br />
                        {profile.nome}
                      </>
                    ) : null}
                  </h1>

                  <p className="mt-4 max-w-3xl text-sm leading-7 text-blue-50 sm:text-base">
                    <strong>Sistema de Aprendizagem Personalizada</strong> para
                    apoio ao desenvolvimento de competências dos servidores
                    técnico-administrativos da UNEB. Aqui você pode registrar seu
                    contexto de trabalho, realizar sua autoavaliação, acompanhar
                    as recomendações, registrar cursos realizados e consultar o
                    diagnóstico do seu percurso formativo.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/dashboard/context"
                      className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-sky-900 transition hover:scale-[1.01] hover:bg-slate-100"
                    >
                      Iniciar percurso
                    </Link>

                    <Link
                      href="/dashboard/recommendations"
                      className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:scale-[1.01] hover:bg-white/15"
                    >
                      Ver recomendações
                    </Link>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/15 bg-white/10 p-6 text-center backdrop-blur">
                    <div className="relative mb-4 h-28 w-28 overflow-hidden rounded-2xl bg-white p-3 shadow-md">
                      <Image
                        src="/logo-uneb.png"
                        alt="Logo da UNEB"
                        fill
                        className="object-contain p-2"
                        priority
                      />
                    </div>

                    <h2 className="text-xl font-bold text-white">UNEB</h2>
                    <p className="mt-2 text-sm leading-6 text-blue-50">
                      Universidade do Estado da Bahia
                    </p>

                    <div className="mt-5 w-full rounded-2xl border border-white/15 bg-white/10 p-4 text-left">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                        Identidade do sistema
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        SAPE
                      </p>
                      <p className="mt-1 text-sm leading-6 text-blue-50">
                        Sistema de Aprendizagem Personalizada
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <InstitutionalInfoCard
                title="Finalidade"
                text="Apoiar a identificação de necessidades de desenvolvimento e sugerir ações formativas mais coerentes com o contexto funcional."
              />
              <InstitutionalInfoCard
                title="Público-alvo"
                text="Servidores técnico-administrativos da UNEB, com foco em formação continuada e desenvolvimento em serviço."
              />
              <InstitutionalInfoCard
                title="Aplicação"
                text="Protótipo acadêmico desenvolvido no contexto de dissertação de mestrado, com abordagem institucional e orientada por competências."
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-0 py-10 sm:px-0 lg:px-0">
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
              Ações rápidas
            </p>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Escolha seu próximo passo
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              Use os atalhos abaixo para acessar as principais funcionalidades do
              sistema e avançar no seu percurso formativo.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className={`group rounded-3xl border p-6 transition hover:-translate-y-0.5 hover:shadow-md ${
                  action.highlight
                    ? "border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex h-full flex-col">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-900 text-lg font-bold text-white">
                    {action.title.charAt(0)}
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900">
                    {action.title}
                  </h3>

                  <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
                    {action.description}
                  </p>

                  <div className="mt-5 inline-flex items-center text-sm font-semibold text-sky-800">
                    {action.cta}
                    <span className="ml-2 transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                Como funciona
              </p>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Percurso orientado por competências
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                O SAPE organiza o processo de desenvolvimento em etapas simples,
                permitindo que cada usuário compreenda melhor seu perfil e receba
                recomendações mais aderentes às suas necessidades.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-sky-900 px-3 py-1 text-sm font-bold text-white">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-0 py-10 sm:px-0 lg:px-0">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                Sobre o sistema
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                Uma proposta de apoio à formação continuada
              </h2>
              <p className="mt-4 text-sm leading-8 text-slate-600 sm:text-base">
                O SAPE foi concebido como um ambiente de apoio à aprendizagem
                personalizada, com foco no desenvolvimento profissional dos
                servidores técnico-administrativos. A proposta busca articular
                contexto funcional, autoavaliação, recomendações, registro de
                cursos realizados e diagnóstico em uma experiência integrada,
                simples e institucionalmente alinhada.
              </p>
              <p className="mt-4 text-sm leading-8 text-slate-600 sm:text-base">
                Nesta tela inicial, o objetivo é oferecer uma recepção mais
                clara, institucional e orientada ao uso, reforçando a identidade
                visual da UNEB e facilitando o acesso às principais áreas do
                sistema.
              </p>
            </div>

            <div className="grid gap-5">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 lg:flex-row lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  SAPE • UNEB
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                  Comece pelo seu contexto e siga seu percurso formativo
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  A navegação recomendada é: contexto de trabalho, autoavaliação,
                  recomendações, cursos realizados e diagnóstico.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link
                  href={nextStep.href}
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] hover:bg-cyan-300"
                >
                  {nextStep.label}
                </Link>
                <Link
                  href="/dashboard/diagnostic"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-transparent px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] hover:bg-white/10"
                >
                  Ver diagnóstico
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function InstitutionalInfoCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-slate-50 shadow-none">
      <CardHeader>
        <CardTitle className="text-base text-slate-900">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-7 text-slate-600">{text}</p>
      </CardContent>
    </Card>
  );
}