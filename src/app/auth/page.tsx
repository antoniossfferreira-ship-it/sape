"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth, useFirestore } from "@/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, UserRound } from "lucide-react";
import { logResearchEvent } from "@/lib/analytics";

const NIVEIS_FORMACAO = [
  "Ensino Médio",
  "Graduação",
  "Especialização",
  "Mestrado",
  "Doutorado",
];

type AccessMode = "participante" | "admin";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [accessMode, setAccessMode] = useState<AccessMode>("participante");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nome: "",
    matricula: "",
    cargo: "",
    formacaoNivel: "",
    formacaoArea: "",
    tempoTipo: "anos",
    tempoValor: "",
  });

  const getFriendlyErrorMessage = (error: any) => {
    const code = error?.code;

    if (code === "auth/user-not-found") {
      return "Você ainda não possui cadastro. Clique em 'Cadastre-se'.";
    }
    if (code === "auth/wrong-password") {
      return "Senha incorreta. Verifique e tente novamente.";
    }
    if (code === "auth/invalid-email") {
      return "E-mail inválido.";
    }
    if (code === "auth/invalid-credential") {
      return "Você ainda não possui cadastro ou os dados estão incorretos. Clique em 'Cadastre-se'.";
    }
    if (code === "auth/email-already-in-use") {
      return "Este e-mail já está cadastrado. Tente entrar no sistema.";
    }
    if (code === "auth/weak-password") {
      return "A senha é muito fraca. Utilize uma senha com pelo menos 6 caracteres.";
    }

    return "Ocorreu um erro ao processar sua solicitação. Tente novamente.";
  };

  const validateRegisterForm = () => {
    if (!formData.nome.trim()) {
      return "Informe o nome completo.";
    }
    if (!formData.matricula.trim()) {
      return "Informe a matrícula.";
    }
    if (!formData.cargo.trim()) {
      return "Selecione o cargo.";
    }
    if (!formData.formacaoNivel.trim()) {
      return "Selecione o nível de formação.";
    }
    if (!formData.formacaoArea.trim()) {
      return "Informe a área de formação.";
    }
    if (!formData.tempoValor.trim()) {
      return "Informe o tempo de UNEB.";
    }

    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        logResearchEvent(db, {
          uid: userCredential.user.uid,
          eventType: "AUTH_LOGIN",
        });

        toast({
          title: "Bem-vindo!",
          description:
            accessMode === "admin"
              ? "Acesso administrativo realizado com sucesso."
              : "Login realizado com sucesso.",
        });

        if (accessMode === "admin") {
          router.push("/admin/pesquisa");
          return;
        }

        router.push("/dashboard");
      } else {
        const validationError = validateRegisterForm();

        if (validationError) {
          toast({
            title: "Atenção",
            description: validationError,
            variant: "destructive",
          });
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        const user = userCredential.user;

        const profileData = {
          id: user.uid,
          nome: formData.nome,
          matricula: formData.matricula,
          email: formData.email,
          cargo: formData.cargo,
          formacao: {
            nivel: formData.formacaoNivel,
            area: formData.formacaoArea,
          },
          tempoUNEB: {
            tipo: formData.tempoTipo,
            valor: Number(formData.tempoValor),
          },
          createdAt: new Date().toISOString(),
          isResearcher: false,
        };

        await setDoc(doc(db, "users", user.uid), profileData);

        logResearchEvent(db, {
          uid: user.uid,
          eventType: "AUTH_SIGNUP",
          contextSnapshot: {
            cargo: formData.cargo,
          },
        });

        toast({
          title: "Conta criada!",
          description: "Seu perfil foi configurado com sucesso.",
        });

        router.push("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Atenção",
        description: getFriendlyErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const switchAccessMode = (newMode: AccessMode) => {
    setAccessMode(newMode);
    setMode("login");
    setFormData((prev) => ({
      ...prev,
      email: "",
      password: "",
    }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-xl border-slate-200 shadow-lg">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="relative h-20 w-20">
              <Image
                src="/logo-uneb.png"
                alt="Logo da UNEB"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <CardTitle className="text-2xl font-bold text-primary">
            SAPE
          </CardTitle>

          <CardDescription>
            {mode === "login"
              ? accessMode === "admin"
                ? "Acesse a área administrativa e o painel analítico da pesquisa"
                : "Acesse o Sistema de Aprendizagem Personalizada da UNEB"
              : "Cadastre-se para iniciar seu percurso formativo"}
          </CardDescription>
        </CardHeader>

        {mode === "login" && (
          <div className="px-6 pb-2">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => switchAccessMode("participante")}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  accessMode === "participante"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserRound className="h-4 w-4" />
                Acesso do participante
              </button>

              <button
                type="button"
                onClick={() => switchAccessMode("admin")}
                className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  accessMode === "admin"
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                Acesso do administrador
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {mode === "login" && (
              <div
                className={`rounded-xl border px-4 py-4 ${
                  accessMode === "participante"
                    ? "border-sky-100 bg-sky-50"
                    : "border-amber-100 bg-amber-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 rounded-full p-2 ${
                      accessMode === "participante"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {accessMode === "participante" ? (
                      <UserRound className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {accessMode === "participante"
                        ? "Login do participante"
                        : "Login da área administrativa"}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-600">
                      {accessMode === "participante"
                        ? "Entre com seu e-mail institucional e senha para acessar as etapas do sistema, realizar a autoavaliação e visualizar suas recomendações."
                        : "Entre com suas credenciais para acessar o painel administrativo e acompanhar os dados analíticos da pesquisa e do piloto."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">
                  {mode === "login"
                    ? accessMode === "admin"
                      ? "E-mail do administrador"
                      : "E-mail Institucional"
                    : "E-mail Institucional"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder={
                    mode === "login" && accessMode === "admin"
                      ? "admin@uneb.br"
                      : "seuemail@uneb.br"
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {mode === "register" && (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="matricula">Matrícula</Label>
                    <Input
                      id="matricula"
                      value={formData.matricula}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cargo">Cargo</Label>
                    <Select
                      value={formData.cargo}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, cargo: v }))
                      }
                    >
                      <SelectTrigger id="cargo">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TECNICO">
                          Técnico Universitário
                        </SelectItem>
                        <SelectItem value="ANALISTA">
                          Analista Universitário
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="formacaoNivel">Nível de Formação</Label>
                    <Select
                      value={formData.formacaoNivel}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, formacaoNivel: v }))
                      }
                    >
                      <SelectTrigger id="formacaoNivel">
                        <SelectValue placeholder="Selecione o nível" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIVEIS_FORMACAO.map((nivel) => (
                          <SelectItem key={nivel} value={nivel}>
                            {nivel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="formacaoArea">Área de Formação</Label>
                    <Input
                      id="formacaoArea"
                      placeholder="Ex: Educação"
                      value={formData.formacaoArea}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tempo de UNEB</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tempoValor"
                        type="number"
                        className="flex-1"
                        value={formData.tempoValor}
                        onChange={handleInputChange}
                        required
                      />
                      <Select
                        value={formData.tempoTipo}
                        onValueChange={(v) =>
                          setFormData((p) => ({ ...p, tempoTipo: v }))
                        }
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="anos">Anos</SelectItem>
                          <SelectItem value="meses">Meses</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login"
                ? accessMode === "admin"
                  ? "Entrar na área administrativa"
                  : "Entrar"
                : "Criar Conta"}
            </Button>

            {accessMode === "participante" && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login"
                  ? "Não tem conta? Cadastre-se"
                  : "Já tem conta? Entre aqui"}
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}