"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* HEADER */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 lg:px-6">
          <Link className="flex items-center gap-3" href="/">
            <BookOpen className="h-6 w-6 text-blue-700" />

            <span className="font-headline text-xl font-bold text-blue-700">
              SAPE
            </span>

            <div className="h-8 w-px bg-gray-200 mx-1" />

            <Image
              src="/logo-uneb.png"
              alt="UNEB"
              width={36}
              height={36}
              className="h-8 w-auto object-contain"
            />
          </Link>

          <nav className="ml-auto">
            <Link
              className="text-sm font-medium text-gray-600 hover:text-blue-700 transition"
              href="/auth"
            >
              Acessar Sistema
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="w-full">
          <div className="mx-auto grid min-h-[70vh] max-w-7xl items-center gap-10 px-4 py-16 md:px-6 lg:grid-cols-2">
            
            {/* TEXTO */}
            <div className="space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
                Sistema institucional de apoio à formação continuada
              </div>

              <div className="space-y-4">
                <h1 className="font-headline text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                  SAPE
                </h1>

                <p className="text-xl font-medium text-blue-700 sm:text-2xl">
                  Sistema de Aprendizagem Personalizada da UNEB
                </p>

                <p className="max-w-2xl text-base text-gray-600 sm:text-lg">
                  Apoio à formação continuada dos servidores técnico-administrativos,
                  com foco no desenvolvimento de competências e recomendações formativas.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row lg:items-start">
                <Button
                  asChild
                  size="lg"
                  className="rounded-2xl bg-blue-700 px-6 py-3 text-white font-semibold hover:bg-blue-800 transition shadow-sm"
                >
                  <Link href="/auth">
                    Acessar o sistema
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>

                <p className="text-sm text-gray-500">
                  Protótipo acadêmico voltado à UNEB.
                </p>
              </div>
            </div>

            {/* BLOCO UNEB */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-md">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-xl bg-gray-50 p-3">
                    <Image
                      src="/logo-uneb.png"
                      alt="Logo da UNEB"
                      width={90}
                      height={90}
                      className="object-contain"
                      priority
                    />
                  </div>

                  <h2 className="text-xl font-bold text-gray-900">
                    Universidade do Estado da Bahia
                  </h2>

                  <p className="mt-2 text-sm text-gray-600">
                    Apoio ao desenvolvimento profissional dos servidores técnico-administrativos.
                  </p>

                  <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700">
                      Formação continuada
                    </div>
                    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700">
                      Recomendações
                    </div>
                    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700">
                      Trilhas
                    </div>
                    <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-700">
                      Diagnóstico
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="w-full bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-10 text-center">
              <h2 className="font-headline text-2xl font-bold text-gray-900 md:text-3xl">
                Funcionalidades do sistema
              </h2>
              <p className="mt-3 text-sm text-gray-600">
                Um fluxo simples e orientado ao desenvolvimento profissional.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-3 rounded-2xl border p-6">
                <ClipboardCheck className="h-8 w-8 text-blue-700" />
                <h3 className="font-headline text-lg font-bold">Autoavaliação</h3>
                <p className="text-center text-sm text-gray-600">
                  Avalie suas competências atuais.
                </p>
              </div>

              <div className="flex flex-col items-center space-y-3 rounded-2xl border p-6">
                <GraduationCap className="h-8 w-8 text-blue-700" />
                <h3 className="font-headline text-lg font-bold">
                  Recomendações
                </h3>
                <p className="text-center text-sm text-gray-600">
                  Receba trilhas e cursos personalizados.
                </p>
              </div>

              <div className="flex flex-col items-center space-y-3 rounded-2xl border p-6">
                <ShieldCheck className="h-8 w-8 text-blue-700" />
                <h3 className="font-headline text-lg font-bold">
                  Foco institucional
                </h3>
                <p className="text-center text-sm text-gray-600">
                  Desenvolvido para a UNEB.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white py-6 text-center">
        <p className="text-xs text-gray-500">
          © 2026 SAPE - Sistema de Aprendizagem Personalizada da UNEB.
        </p>
      </footer>
    </div>
  );
}