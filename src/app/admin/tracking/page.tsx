"use client";

import { useState, useEffect } from "react";
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc, getDocs, query, orderBy } from "firebase/firestore";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Users,
  CheckCircle2,
  Circle,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Search,
  LayoutList,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParticipantProgress {
  uid: string;
  nome: string;
  matricula: string;
  hasLogin: boolean;
  hasContext: boolean;
  hasAssessment: boolean;
  hasRecommendations: boolean;
  hasFeedback: boolean;
  hasForm: boolean;
}

export default function TrackingPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [progressData, setProgressData] = useState<ParticipantProgress[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    assessments: 0,
    views: 0,
    forms: 0,
  });

  const userDocRef = useMemoFirebase(() => {
    if (isUserLoading || !db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user, isUserLoading]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc(userDocRef);

  const isAdmin =
    userProfile?.role === "ADMIN" ||
    userProfile?.isAdmin === true ||
    user?.email === "assferreira@uneb.br";

  const loadProgress = async () => {
    if (isUserLoading || !db || !isAdmin) return;

    setLoading(true);
    try {
      const [usersSnap, eventsSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), orderBy("nome"))),
        getDocs(collection(db, "researchEvents")),
      ]);

      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const events = eventsSnap.docs.map((d) => d.data());

      const consolidated: ParticipantProgress[] = users.map((u: any) => {
        const userEvents = events.filter((e: any) => e.uid === u.id);

        return {
          uid: u.id,
          nome: u.nome || u.name || "---",
          matricula: u.matricula || "---",
          hasLogin: userEvents.some(
            (e: any) => e.eventType === "AUTH_LOGIN" || e.eventType === "AUTH_SIGNUP"
          ),
          hasContext: userEvents.some((e: any) => e.eventType === "CONTEXT_SAVED"),
          hasAssessment: userEvents.some((e: any) => e.eventType === "ASSESSMENT_SAVED"),
          hasRecommendations: userEvents.some(
            (e: any) => e.eventType === "RECOMMENDATIONS_VIEWED"
          ),
          hasFeedback: userEvents.some(
            (e: any) => e.eventType === "RECOMMENDATION_FEEDBACK"
          ),
          hasForm: userEvents.some((e: any) => e.eventType === "USABILITY_FORM_OPENED"),
        };
      });

      setProgressData(consolidated);

      setStats({
        total: consolidated.length,
        assessments: consolidated.filter((p) => p.hasAssessment).length,
        views: consolidated.filter((p) => p.hasRecommendations).length,
        forms: consolidated.filter((p) => p.hasForm).length,
      });
    } catch (e: any) {
      toast({
        title: "Erro ao carregar progresso",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && db && !isUserLoading) loadProgress();
  }, [isAdmin, db, isUserLoading]);

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
          <h2 className="text-2xl font-bold text-primary">Acesso Restrito</h2>
          <p className="text-muted-foreground">
            Esta área é exclusiva para o administrador do sistema.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const StatusIcon = ({ active }: { active: boolean }) =>
    active ? (
      <div className="flex justify-center">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      </div>
    ) : (
      <div className="flex justify-center">
        <Circle className="h-5 w-5 text-muted-foreground/30" />
      </div>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="flex items-center gap-3 font-headline text-3xl font-bold text-primary">
              <LayoutList className="h-8 w-8" />
              Acompanhamento do Piloto
            </h1>
            <p className="text-muted-foreground">
              Monitore o progresso individual de cada participante nas etapas da
              pesquisa.
            </p>
          </div>
          <Button onClick={loadProgress} variant="outline" className="gap-2" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar dados
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-primary/10 bg-primary/5">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-bold">
                Participantes Totais
              </CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-blue-100 bg-blue-50">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-bold text-blue-700">
                Autoavaliados
              </CardDescription>
              <CardTitle className="text-2xl text-blue-700">
                {stats.assessments}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-amber-100 bg-amber-50">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-bold text-amber-700">
                Viram Recomendações
              </CardDescription>
              <CardTitle className="text-2xl text-amber-700">{stats.views}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-green-100 bg-green-50">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-bold text-green-700">
                Abriram Formulário
              </CardDescription>
              <CardTitle className="text-2xl text-green-700">{stats.forms}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5" /> Progresso dos Participantes
            </CardTitle>
            <CardDescription>
              Verificação de conclusão de etapas baseada nos logs de eventos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead className="text-center">Login</TableHead>
                    <TableHead className="text-center">Contexto</TableHead>
                    <TableHead className="text-center">Avaliação</TableHead>
                    <TableHead className="text-center">Recomendações</TableHead>
                    <TableHead className="text-center">Feedback</TableHead>
                    <TableHead className="text-center">Formulário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progressData.map((p) => (
                    <TableRow key={p.uid}>
                      <TableCell className="text-xs font-medium">{p.nome}</TableCell>
                      <TableCell className="text-xs">{p.matricula}</TableCell>
                      <TableCell>
                        <StatusIcon active={p.hasLogin} />
                      </TableCell>
                      <TableCell>
                        <StatusIcon active={p.hasContext} />
                      </TableCell>
                      <TableCell>
                        <StatusIcon active={p.hasAssessment} />
                      </TableCell>
                      <TableCell>
                        <StatusIcon active={p.hasRecommendations} />
                      </TableCell>
                      <TableCell>
                        <StatusIcon active={p.hasFeedback} />
                      </TableCell>
                      <TableCell>
                        <StatusIcon active={p.hasForm} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {progressData.length === 0 && !loading && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-10 text-center italic text-muted-foreground"
                      >
                        Nenhum participante encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}