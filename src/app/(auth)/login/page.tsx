"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "@/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { auth } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  async function handleLogin() {
    setErro("");

    try {
      await signInWithEmailAndPassword(auth, email, senha);
      router.push("/dashboard");
    } catch (error: any) {
      const code = error.code;

      if (code === "auth/user-not-found") {
        setErro("Você ainda não possui cadastro. Clique em 'Cadastre-se'.");
      } else if (code === "auth/wrong-password") {
        setErro("Senha incorreta. Verifique e tente novamente.");
      } else if (code === "auth/invalid-email") {
        setErro("E-mail inválido.");
      } else if (code === "auth/invalid-credential") {
        setErro(
          "E-mail ou senha inválidos. Se não tiver cadastro, clique em 'Cadastre-se'."
        );
      } else {
        setErro("Erro ao acessar o sistema. Tente novamente.");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-[460px] border-slate-200 shadow-lg">
        <CardContent className="space-y-5 p-8">
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="relative h-20 w-20">
              <Image
                src="/logo-uneb.png"
                alt="Logo da UNEB"
                fill
                className="object-contain"
                priority
              />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-primary">SAPE</h1>
              <p className="text-sm font-medium text-slate-700">
                Sistema de Aprendizagem Personalizada
              </p>
              <p className="text-sm text-muted-foreground">
                Acesse o Sistema de Aprendizagem Personalizada da UNEB
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm">E-mail Institucional</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@uneb.br"
            />
          </div>

          <div>
            <label className="text-sm">Senha</label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="******"
            />
          </div>

          {erro && (
            <div className="rounded bg-red-100 p-2 text-sm text-red-600">
              {erro}
            </div>
          )}

          <Button className="w-full" onClick={handleLogin}>
            Entrar
          </Button>

          <p className="text-center text-sm">
            Não tem conta?{" "}
            <span
              className="cursor-pointer text-blue-600"
              onClick={() => router.push("/register")}
            >
              Cadastre-se
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}