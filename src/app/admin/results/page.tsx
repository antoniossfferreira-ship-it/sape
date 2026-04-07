"use client";

import { useState, useEffect } from "react";
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  collectionGroup,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
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
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Search,
  Calculator,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { COMPETENCIAS, COURSES } from "@/app/lib/mock-data";

interface ResultsState {
  kpis: {
    totalUsers: number;
    totalLogins: number;
    contextsSaved: number;
    assessmentsSaved: number;
    recommendationsViewed: number;
    totalFeedbacks: number;
    acceptanceRate: string;
  };
  usageStages: { stage: string; count: number }[];
  feedbackByCourse: any[];
  feedbackByCompetency: any[];
  topGaps: { name: string; frequency: number }[];
  participants: any[];
}

type RecommendationItem = {
  id?: string;
  title?: string;
  courseId?: string;
  linkedCompetencyId?: string;
  linkedCompetencyName?: string;
  competenciaId?: string;
  lastFeedback?: "POSITIVA" | "NEGATIVA";
};

export default function ResultsPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [results, setResults] = useState<ResultsState | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const userDocRef = useMemoFirebase(() => {
    if (isUserLoading || !db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user, isUserLoading]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc(userDocRef);

  const isAdmin =
    userProfile?.role === "ADMIN" ||
    userProfile?.isAdmin === true ||
    user?.email === "assferreira@uneb.br";

  const loadData = async () => {
    if (!isMounted || isUserLoading || !db || !isAdmin) return;

    setLoading(true);
    try {
      const [usersSnap, eventsSnap, recsSnap, assessmentsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collectionGroup(db, "researchEvents")),
        getDocs(query(collectionGroup(db, "recommendations"))),
        getDocs(query(collectionGroup(db, "assessments"))),
      ]);

      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const events = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const recDocs = recsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const recs: RecommendationItem[] = recDocs.flatMap((r: any) =>
        Array.isArray(r?.recommendations) ? r.recommendations : [r]
      );

      const assessments = assessmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const logins = events.filter(
        (e: any) => e?.eventType === "AUTH_LOGIN" || e?.eventType === "AUTH_SIGNUP"
      ).length;
      const contexts = events.filter((e: any) => e?.eventType === "CONTEXT_SAVED").length;
      const asms = events.filter((e: any) => e?.eventType === "ASSESSMENT_SAVED").length;
      const views = events.filter(
        (e: any) => e?.eventType === "RECOMMENDATIONS_VIEWED"
      ).length;

      const feedbacks = recs.filter(
        (r: any) => r?.lastFeedback === "POSITIVA" || r?.lastFeedback === "NEGATIVA"
      );
      const pos = feedbacks.filter((f: any) => f?.lastFeedback === "POSITIVA").length;
      const acceptanceRate =
        feedbacks.length > 0 ? ((pos / feedbacks.length) * 100).toFixed(1) : "0";

      const courseMap: Record<string, any> = {};
      recs.forEach((r: any) => {
        if (!r?.lastFeedback) return;

        const courseKey = r?.courseId || r?.title;
        if (!courseKey) return;

        if (!courseMap[courseKey]) {
          const course = COURSES.find((c) => c.id === r.courseId);
          courseMap[courseKey] = {
            name: course?.name || r?.title || r?.courseId || courseKey,
            pos: 0,
            neg: 0,
          };
        }

        if (r.lastFeedback === "POSITIVA") courseMap[courseKey].pos++;
        if (r.lastFeedback === "NEGATIVA") courseMap[courseKey].neg++;
      });

      const compMap: Record<string, any> = {};
      recs.forEach((r: any) => {
        if (!r?.lastFeedback) return;

        const compKey = r?.linkedCompetencyId || r?.competenciaId;
        if (!compKey) return;

        if (!compMap[compKey]) {
          const comp = COMPETENCIAS.find((c) => c.id === compKey);
          compMap[compKey] = {
            name:
              r?.linkedCompetencyName ||
              comp?.name ||
              r?.competenciaId ||
              compKey,
            pos: 0,
            neg: 0,
          };
        }

        if (r.lastFeedback === "POSITIVA") compMap[compKey].pos++;
        if (r.lastFeedback === "NEGATIVA") compMap[compKey].neg++;
      });

      const gaps: Record<string, number> = {};
      assessments.forEach((a: any) => {
        const comp = COMPETENCIAS.find((c) => c.id === a.id);
        if (comp && a?.level < (comp.expectedLevel || 3)) {
          gaps[comp.name] = (gaps[comp.name] || 0) + 1;
        }
      });

      setResults({
        kpis: {
          totalUsers: users.length,
          totalLogins: logins,
          contextsSaved: contexts,
          assessmentsSaved: asms,
          recommendationsViewed: views,
          totalFeedbacks: feedbacks.length,
          acceptanceRate,
        },
        usageStages: [
          { stage: "Cadastro", count: users.length },
          { stage: "Contexto de Trabalho", count: contexts },
          { stage: "Autoavaliação", count: asms },
          { stage: "Visualização de Recomendações", count: views },
          { stage: "Envio de Feedback", count: feedbacks.length },
        ],
        feedbackByCourse: Object.entries(courseMap).map(([id, data]) => ({ id, ...data })),
        feedbackByCompetency: Object.entries(compMap).map(([id, data]) => ({
          id,
          ...data,
        })),
        topGaps: Object.entries(gaps)
          .map(([name, frequency]) => ({ name, frequency }))
          .sort((a, b) => b.frequency - a.frequency),
        participants: users,
      });
    } catch (e: any) {
      toast({
        title: "Erro ao carregar dados",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateStats = async () => {
    if (!db || !isAdmin) return;

    setRecalculating(true);
    try {
      const recsSnap = await getDocs(query(collectionGroup(db, "recommendations")));
      const recDocs = recsSnap.docs.map((d) => d.data());
      const recs: RecommendationItem[] = recDocs.flatMap((r: any) =>
        Array.isArray(r?.recommendations) ? r.recommendations : [r]
      );

      const statsMap: Record<string, { likes: number; dislikes: number; name?: string }> = {};

      recs.forEach((r: any) => {
        if (!r?.lastFeedback) return;

        const courseKey = r?.courseId || r?.title;
        if (!courseKey) return;

        if (!statsMap[courseKey]) {
          statsMap[courseKey] = { likes: 0, dislikes: 0, name: r?.title || courseKey };
        }

        if (r.lastFeedback === "POSITIVA") statsMap[courseKey].likes++;
        if (r.lastFeedback === "NEGATIVA") statsMap[courseKey].dislikes++;
      });

      const promises = Object.entries(statsMap).map(([courseId, counts]) => {
        const total = counts.likes + counts.dislikes;
        const rate = total > 0 ? counts.likes / total : 0.5;

        return setDoc(
          doc(db, "courseStats", courseId),
          {
            likes: counts.likes,
            dislikes: counts.dislikes,
            acceptanceRate: rate,
            courseName: counts.name || courseId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await Promise.all(promises);
      toast({
        title: "Sucesso!",
        description: "Estatísticas colaborativas atualizadas.",
      });
      loadData();
    } catch (e: any) {
      toast({
        title: "Erro no recálculo",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    if (isAdmin && db && !isUserLoading && isMounted) loadData();
  }, [isAdmin, db, isUserLoading, isMounted]);

  if (!isMounted || isUserLoading || isLoadingProfile) {
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="flex items-center gap-3 font-headline text-3xl font-bold text-primary">
              <TrendingUp className="h-8 w-8" />
              Resultados do Piloto
            </h1>
            <p className="text-muted-foreground">
              Métricas consolidadas para análise da dissertação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleRecalculateStats}
              variant="secondary"
              size="sm"
              className="gap-2 bg-accent text-white hover:bg-accent/90"
              disabled={recalculating}
            >
              {recalculating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              Recalcular Estatísticas
            </Button>
            <Button
              onClick={loadData}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="border-primary/10 bg-primary/5">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Participantes</CardDescription>
              <CardTitle className="text-xl">
                {results?.kpis.totalUsers || 0}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-green-100 bg-green-50">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-nowrap text-xs text-green-700">
                Aceitação (%)
              </CardDescription>
              <CardTitle className="text-xl text-green-700">
                {results?.kpis.acceptanceRate || 0}%
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-5 w-5" /> Etapas do Funil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results?.usageStages.map((s, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{s.stage}</span>
                    <span className="font-bold">{s.count}</span>
                  </div>
                  <Progress
                    value={(s.count / (results?.usageStages[0]?.count || 1)) * 100}
                    className="h-2"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5" /> Lacunas Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead className="text-right">Freq.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results?.topGaps.slice(0, 5).map((g, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-2">{g.name}</TableCell>
                      <TableCell className="py-2 text-right">{g.frequency}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}