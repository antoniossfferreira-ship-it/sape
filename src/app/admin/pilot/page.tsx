"use client";

import { useState, useEffect } from "react";
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { doc } from "firebase/firestore";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Link as LinkIcon,
  Copy,
  ClipboardList,
  Users,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PilotPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [appUrl, setAppUrl] = useState("");

  const [instructions, setInstructions] = useState(`- Acesse o link do sistema
- Crie conta ou faça login
- Preencha Contexto de Trabalho (unidade/setor/função)
- Faça Autoavaliação
- Veja Recomendações
- Dê feedback 👍/👎 em cada recomendação
- (Opcional) registre cursos realizados
- Tempo estimado: 10–15 minutos`);

  const userDocRef = useMemoFirebase(() => {
    if (isUserLoading || !db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user, isUserLoading]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc(userDocRef);

  const isAdmin =
    userProfile?.role === "ADMIN" ||
    userProfile?.isAdmin === true ||
    user?.email === "assferreira@uneb.br";

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppUrl(window.location.origin);
    }
  }, []);

  const copyToClipboard = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${title} copiado para a área de transferência.`,
    });
  };

  if (isUserLoading || isLoadingProfile) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-600" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-primary">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Esta área é exclusiva para coordenadores do piloto.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const internalParticipants = Array.from({ length: 10 }, (_, i) =>
    `P${(i + 1).toString().padStart(2, "0")}`
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-3 font-headline text-3xl font-bold text-primary">
            <Users className="h-8 w-8" />
            Gestão do Piloto
          </h1>
          <p className="text-muted-foreground">
            Recursos para engajamento e coordenação dos participantes.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LinkIcon className="h-5 w-5 text-primary" />
                Link do Sistema
              </CardTitle>
              <CardDescription>
                Compartilhe este link com os servidores da UNEB.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="break-all rounded-md border bg-secondary/30 p-3 font-mono text-sm">
                {appUrl || "Carregando URL..."}
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button
                onClick={() => copyToClipboard(appUrl, "Link do sistema")}
                className="flex-1 gap-2"
              >
                <Copy className="h-4 w-4" /> Copiar Link
              </Button>
              <Button variant="outline" asChild className="gap-2">
                <a href={appUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Abrir
                </a>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Controle de Amostra (P01-P10)
              </CardTitle>
              <CardDescription>
                Acompanhamento visual da meta de participantes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {internalParticipants.map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className="bg-secondary/10 px-3 py-1"
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs italic text-muted-foreground">
                Use estes códigos para identificar os participantes anonimizados no
                dataset final.
              </p>
            </CardFooter>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
              Instruções para Participantes
            </CardTitle>
            <CardDescription>
              Envie este guia rápido para facilitar a jornada do usuário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instructions">Texto de Orientação</Label>
              <Textarea
                id="instructions"
                className="min-h-[250px] font-sans text-sm leading-relaxed"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => copyToClipboard(instructions, "Instruções")}
              className="h-11 w-full gap-2"
            >
              <Copy className="h-4 w-4" /> Copiar Guia de Instruções
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}