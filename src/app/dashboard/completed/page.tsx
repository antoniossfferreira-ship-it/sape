"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
  useDoc,
  useStorage,
} from "@/firebase";
import {
  collection,
  addDoc,
  doc,
  serverTimestamp,
  updateDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  FileCheck,
  Plus,
  Trash2,
  Calendar,
  BookCheck,
  Loader2,
  Paperclip,
  ExternalLink,
  Sparkles,
  Link2,
  RefreshCw,
} from "lucide-react";
import { logResearchEvent } from "@/lib/analytics";
import {
  buildDiagnosis,
  normalizeAssessment,
  normalizeCompletedCourses,
  normalizeExpectedProfile,
  summarize,
} from "@/lib/diagnostic-engine";

type Priority = "ALTA" | "MÉDIA" | "BAIXA";

type SuggestedCourseItem = {
  id: string;
  title: string;
  description?: string;
  source?: string;
  modality?: string;
  workloadHours?: number;
  url?: string;
};

type RecommendationItem = {
  recommendationId: string;
  type: "TRILHA" | "CURSO";
  title: string;
  description: string;
  linkedCompetencyId: string;
  linkedCompetencyName: string;
  axisCode: string;
  axisName: string;
  priority: Priority;
  reason: string;
  estimatedWorkloadHours: number;
  modality: string;
  suggestedCourses: SuggestedCourseItem[];
  status?: "ATIVA";
};

type RecommendationDocument = {
  userId: string;
  generatedAt?: unknown;
  version: string;
  source: string;
  diagnosticRef: string;
  summary: {
    totalRecommendations: number;
    highPriorityRecommendations: number;
    mediumPriorityRecommendations: number;
    lowPriorityRecommendations: number;
  };
  recommendations: RecommendationItem[];
};

type SuggestedLink = {
  linkedCompetencyId: string;
  linkedCompetencyName: string;
  axisCode: string;
  axisName: string;
  sourceRecommendationId: string;
  sourceRecommendationTitle: string;
  recognizedBySystem: boolean;
  matchScore: number;
  matchReason:
    | "COURSE_TITLE_EXACT"
    | "COURSE_TITLE_PARTIAL"
    | "COMPETENCY_SIMILARITY"
    | "RECOMMENDATION_TITLE_SIMILARITY";
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titlesRelated(a: string, b: string): boolean {
  const aa = normalizeText(a);
  const bb = normalizeText(b);

  if (!aa || !bb) return false;
  return aa === bb || aa.includes(bb) || bb.includes(aa);
}

function scoreMatch(courseName: string, recommendation: RecommendationItem): {
  score: number;
  reason: SuggestedLink["matchReason"] | null;
} {
  const course = normalizeText(courseName);
  const competency = normalizeText(recommendation.linkedCompetencyName);
  const title = normalizeText(recommendation.title);

  let score = 0;
  let reason: SuggestedLink["matchReason"] | null = null;

  if (!course) {
    return { score, reason };
  }

  const exactSuggestedCourse = recommendation.suggestedCourses.some((item) =>
    titlesRelated(courseName, item.title)
  );

  if (exactSuggestedCourse) {
    return {
      score: 100,
      reason: titlesRelated(courseName, recommendation.title)
        ? "COURSE_TITLE_EXACT"
        : "COURSE_TITLE_PARTIAL",
    };
  }

  const courseTokens = course.split(/\s+/).filter(Boolean);
  const competencyTokens = competency.split(/\s+/).filter(Boolean);
  const titleTokens = title.split(/\s+/).filter(Boolean);

  for (const token of courseTokens) {
    if (token.length < 3) continue;
    if (competency.includes(token)) score += 3;
    if (title.includes(token)) score += 2;
    if (competencyTokens.includes(token)) score += 2;
    if (titleTokens.includes(token)) score += 1;
  }

  if (course.includes(competency) && competency) {
    score += 8;
    reason = "COMPETENCY_SIMILARITY";
  }

  if (course.includes(title) && title) {
    score += 6;
    reason = reason || "RECOMMENDATION_TITLE_SIMILARITY";
  }

  if (!reason && score > 0) {
    reason = competency ? "COMPETENCY_SIMILARITY" : "RECOMMENDATION_TITLE_SIMILARITY";
  }

  if (recommendation.priority === "ALTA") score += 2;
  if (recommendation.priority === "MÉDIA") score += 1;

  return { score, reason };
}

function findSuggestedLink(
  courseName: string,
  recommendations: RecommendationItem[]
): SuggestedLink | null {
  if (!courseName.trim() || !recommendations.length) return null;

  const ranked = recommendations
    .map((rec) => {
      const { score, reason } = scoreMatch(courseName, rec);
      return {
        rec,
        score,
        reason,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best || !best.reason) return null;

  const minimumScore =
    best.reason === "COURSE_TITLE_EXACT" || best.reason === "COURSE_TITLE_PARTIAL"
      ? 10
      : 6;

  if (best.score < minimumScore) return null;

  return {
    linkedCompetencyId: best.rec.linkedCompetencyId,
    linkedCompetencyName: best.rec.linkedCompetencyName,
    axisCode: best.rec.axisCode,
    axisName: best.rec.axisName,
    sourceRecommendationId: best.rec.recommendationId,
    sourceRecommendationTitle: best.rec.title,
    recognizedBySystem: true,
    matchScore: best.score,
    matchReason: best.reason,
  };
}

export default function CompletedCoursesPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);

  const [newCourse, setNewCourse] = useState({
    name: "",
    date: "",
    hours: "",
    linkedCompetencyId: "",
    linkedCompetencyName: "",
    axisCode: "",
    axisName: "",
    sourceRecommendationId: "",
    sourceRecommendationTitle: "",
    recognizedBySystem: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentCourseForFile, setCurrentCourseForFile] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const userDocRef = useMemoFirebase(() => {
    if (!isMounted || !user || !db) return null;
    return doc(db, "users", user.uid);
  }, [user, db, isMounted]);
  const { data: profile } = useDoc(userDocRef);

  const contextDocRef = useMemoFirebase(() => {
    if (!isMounted || !user || !db) return null;
    return doc(db, "users", user.uid, "context", "professionalContext");
  }, [user, db, isMounted]);
  const { data: context } = useDoc(contextDocRef);

  const completedQuery = useMemoFirebase(() => {
    if (!isMounted || !user || !db) return null;
    return collection(db, "users", user.uid, "completedCourses");
  }, [user, db, isMounted]);

  const { data: courses, isLoading } = useCollection(completedQuery);

  useEffect(() => {
    async function loadRecommendations() {
      if (!user || !db || !isMounted) return;

      setIsLoadingRecommendations(true);
      try {
        const recRef = doc(db, "users", user.uid, "recommendations", "current");
        const recSnap = await getDoc(recRef);

        if (recSnap.exists()) {
          const data = recSnap.data() as RecommendationDocument;
          setRecommendations(data?.recommendations || []);
        } else {
          setRecommendations([]);
        }
      } catch (error) {
        console.error("Erro ao carregar recomendações:", error);
        setRecommendations([]);
      } finally {
        setIsLoadingRecommendations(false);
      }
    }

    loadRecommendations();
  }, [user, db, isMounted]);

  const competencyOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        linkedCompetencyId: string;
        linkedCompetencyName: string;
        axisCode: string;
        axisName: string;
        sourceRecommendationId: string;
        sourceRecommendationTitle: string;
      }
    >();

    for (const rec of recommendations) {
      if (!rec.linkedCompetencyId) continue;
      map.set(rec.linkedCompetencyId, {
        linkedCompetencyId: rec.linkedCompetencyId,
        linkedCompetencyName: rec.linkedCompetencyName,
        axisCode: rec.axisCode,
        axisName: rec.axisName,
        sourceRecommendationId: rec.recommendationId,
        sourceRecommendationTitle: rec.title,
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.linkedCompetencyName.localeCompare(b.linkedCompetencyName, "pt-BR")
    );
  }, [recommendations]);

  const suggestion = useMemo(() => {
    return findSuggestedLink(newCourse.name, recommendations);
  }, [newCourse.name, recommendations]);

  useEffect(() => {
    if (!suggestion) return;

    const shouldAutoApply =
      suggestion.matchReason === "COURSE_TITLE_EXACT" ||
      suggestion.matchReason === "COURSE_TITLE_PARTIAL";

    if (!shouldAutoApply) return;

    setNewCourse((prev) => {
      if (prev.linkedCompetencyId) return prev;

      return {
        ...prev,
        linkedCompetencyId: suggestion.linkedCompetencyId,
        linkedCompetencyName: suggestion.linkedCompetencyName,
        axisCode: suggestion.axisCode,
        axisName: suggestion.axisName,
        sourceRecommendationId: suggestion.sourceRecommendationId,
        sourceRecommendationTitle: suggestion.sourceRecommendationTitle,
        recognizedBySystem: true,
      };
    });
  }, [suggestion]);

  const handleCompetencyChange = (competencyId: string) => {
    const selected = competencyOptions.find(
      (item) => item.linkedCompetencyId === competencyId
    );

    if (!selected) {
      setNewCourse((prev) => ({
        ...prev,
        linkedCompetencyId: "",
        linkedCompetencyName: "",
        axisCode: "",
        axisName: "",
        sourceRecommendationId: "",
        sourceRecommendationTitle: "",
        recognizedBySystem: false,
      }));
      return;
    }

    setNewCourse((prev) => ({
      ...prev,
      linkedCompetencyId: selected.linkedCompetencyId,
      linkedCompetencyName: selected.linkedCompetencyName,
      axisCode: selected.axisCode,
      axisName: selected.axisName,
      sourceRecommendationId: selected.sourceRecommendationId,
      sourceRecommendationTitle: selected.sourceRecommendationTitle,
      recognizedBySystem:
        !!suggestion &&
        suggestion.linkedCompetencyId === selected.linkedCompetencyId,
    }));
  };

  const handleUseSuggestion = () => {
    if (!suggestion) return;

    setNewCourse((prev) => ({
      ...prev,
      linkedCompetencyId: suggestion.linkedCompetencyId,
      linkedCompetencyName: suggestion.linkedCompetencyName,
      axisCode: suggestion.axisCode,
      axisName: suggestion.axisName,
      sourceRecommendationId: suggestion.sourceRecommendationId,
      sourceRecommendationTitle: suggestion.sourceRecommendationTitle,
      recognizedBySystem: true,
    }));

    toast({
      title: "Sugestão aplicada",
      description: "A competência recomendada foi vinculada ao curso.",
    });
  };

  async function recalculateDerivedData() {
    if (!db || !user) return;

    setIsRecalculating(true);

    try {
      const expectedProfileRef = doc(db, "users", user.uid, "context", "expectedProfile");
      const assessmentRef = doc(db, "users", user.uid, "assessment", "competencies");
      const diagnosticRef = doc(db, "users", user.uid, "diagnostics", "current");
      const recommendationsRef = doc(db, "users", user.uid, "recommendations", "current");

      const [expectedProfileSnap, assessmentSnap, completedSnap] = await Promise.all([
        getDoc(expectedProfileRef),
        getDoc(assessmentRef),
        getDocs(collection(db, "users", user.uid, "completedCourses")),
      ]);

      if (!expectedProfileSnap.exists() || !assessmentSnap.exists()) {
        console.warn("Não foi possível recalcular: dados incompletos.");
        return;
      }

      const expectedProfileRaw = expectedProfileSnap.data();
      const assessmentRaw = assessmentSnap.data();
      const completedRaw = completedSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const expectedProfile = normalizeExpectedProfile(expectedProfileRaw);
      const assessment = normalizeAssessment(assessmentRaw);
      const completedCourses = normalizeCompletedCourses(completedRaw);

      const items = buildDiagnosis(expectedProfile, assessment, completedCourses);
      const summary = summarize(items);

      await setDoc(
        diagnosticRef,
        {
          userId: user.uid,
          version: "2.0",
          source: "recalculated_full_cycle",
          generatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          items,
          summary,
          contextSnapshot: {
            unidadeId: context?.unidadeId || "",
            setorId: context?.setorId || "",
            funcaoFormalId: context?.funcaoFormalId || "",
            unidadeNome: context?.unidadeNome || context?.unitName || "",
            setorNome: context?.setorNome || context?.sectorName || "",
            funcaoFormalNome: context?.funcaoFormalNome || context?.roleName || "",
          },
        },
        { merge: true }
      );

      await setDoc(
        recommendationsRef,
        {
          needsUpdate: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast({
        title: "Sistema atualizado",
        description: "Diagnóstico e recomendações foram atualizados automaticamente.",
      });
    } catch (error) {
      console.error("Erro ao recalcular:", error);
      toast({
        title: "Erro ao atualizar",
        description: "O curso foi salvo, mas nem tudo foi atualizado.",
        variant: "destructive",
      });
    } finally {
      setIsRecalculating(false);
    }
  }

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    if (!newCourse.name || !newCourse.date || !newCourse.hours) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha os dados principais do curso.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const colRef = collection(db, "users", user.uid, "completedCourses");
      await addDoc(colRef, {
        name: newCourse.name,
        date: newCourse.date,
        hours: Number(newCourse.hours) || 0,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        certificateUrl: null,
        linkedCompetencyId: newCourse.linkedCompetencyId || null,
        linkedCompetencyName: newCourse.linkedCompetencyName || null,
        axisCode: newCourse.axisCode || null,
        axisName: newCourse.axisName || null,
        sourceRecommendationId: newCourse.sourceRecommendationId || null,
        sourceRecommendationTitle: newCourse.sourceRecommendationTitle || null,
        recognizedBySystem: !!newCourse.recognizedBySystem,
      });

      logResearchEvent(db, {
        uid: user.uid,
        eventType: "COURSE_COMPLETED_ADDED",
        metadata: {
          courseName: newCourse.name,
          linkedCompetencyId: newCourse.linkedCompetencyId || null,
          linkedCompetencyName: newCourse.linkedCompetencyName || null,
          axisName: newCourse.axisName || null,
          sourceRecommendationId: newCourse.sourceRecommendationId || null,
        },
        contextSnapshot: {
          unidadeId: context?.unidadeId,
          setorId: context?.setorId,
          cargo: profile?.cargo,
        },
      });

      await recalculateDerivedData();

      toast({
        title: "Curso registrado",
        description: "O curso foi adicionado ao histórico com vinculação formativa.",
      });

      setNewCourse({
        name: "",
        date: "",
        hours: "",
        linkedCompetencyId: "",
        linkedCompetencyName: "",
        axisCode: "",
        axisName: "",
        sourceRecommendationId: "",
        sourceRecommendationTitle: "",
        recognizedBySystem: false,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !currentCourseForFile || !user || !storage || !db)
      return;

    const file = e.target.files[0];
    const courseId = currentCourseForFile;

    if (file.type !== "application/pdf") {
      toast({
        title: "Formato inválido",
        description: "Apenas arquivos PDF são permitidos.",
        variant: "destructive",
      });
      return;
    }

    setUploadingId(courseId);
    try {
      const storagePath = `certificates/${user.uid}/${courseId}.pdf`;
      const fileRef = ref(storage, storagePath);
      const uploadResult = await uploadBytes(fileRef, file);
      const certificateUrl = await getDownloadURL(uploadResult.ref);

      const docRef = doc(db, "users", user.uid, "completedCourses", courseId);
      await updateDoc(docRef, { certificateUrl, updatedAt: serverTimestamp() });

      toast({
        title: "Certificado anexado",
        description: "O documento foi vinculado ao curso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: "Não foi possível processar o arquivo.",
        variant: "destructive",
      });
    } finally {
      setUploadingId(null);
      setCurrentCourseForFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUpload = (courseId: string) => {
    setCurrentCourseForFile(courseId);
    fileInputRef.current?.click();
  };

  const handleDelete = async (id: string) => {
    if (!user || !db) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "completedCourses", id));
      await recalculateDerivedData();

      toast({
        title: "Registro removido",
        description: "O curso foi excluído do histórico.",
      });
    } catch (error) {
      console.error("Erro ao remover curso:", error);
      toast({
        title: "Erro ao remover",
        description: "Não foi possível excluir o curso.",
        variant: "destructive",
      });
    }
  };

  if (!isMounted || isUserLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-3">
          <div>
            <h1 className="mb-2 text-3xl font-bold font-headline text-primary">
              Cursos Realizados
            </h1>
            <p className="text-muted-foreground">
              Registre seu histórico profissional e vincule os cursos às competências do sistema.
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Etapa 4 de 5 — Cursos Realizados
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[80%] bg-primary" />
            </div>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".pdf"
          onChange={handleFileChange}
        />

        <Card className="border-primary/10 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-primary" />
              Adicionar ao Histórico
            </CardTitle>
            <CardDescription>
              O sistema sugere automaticamente a competência relacionada, mas você pode ajustar manualmente.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleAddCourse}>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="courseName">Nome do Curso</Label>
                  <Input
                    id="courseName"
                    required
                    value={newCourse.name}
                    onChange={(e) =>
                      setNewCourse((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Ex: Gestão de Processos na UNEB"
                    disabled={isSaving || isRecalculating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hours">Horas (h)</Label>
                  <Input
                    id="hours"
                    type="number"
                    required
                    value={newCourse.hours}
                    onChange={(e) =>
                      setNewCourse((prev) => ({
                        ...prev,
                        hours: e.target.value,
                      }))
                    }
                    placeholder="20"
                    disabled={isSaving || isRecalculating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Conclusão</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={newCourse.date}
                    onChange={(e) =>
                      setNewCourse((prev) => ({
                        ...prev,
                        date: e.target.value,
                      }))
                    }
                    disabled={isSaving || isRecalculating}
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Vinculação formativa inteligente</p>
                </div>

                {isLoadingRecommendations ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando recomendações para sugerir competência...
                  </div>
                ) : suggestion ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-sm font-medium text-primary">
                        Sugestão do sistema
                      </p>
                      <p className="mt-1 text-sm">
                        Competência: <strong>{suggestion.linkedCompetencyName}</strong>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Eixo: {suggestion.axisName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Trilha de origem: {suggestion.sourceRecommendationTitle}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleUseSuggestion}
                      className="gap-2"
                      disabled={isSaving || isRecalculating}
                    >
                      <Link2 className="h-4 w-4" />
                      Usar esta sugestão
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    O sistema não encontrou uma sugestão automática a partir do nome do curso.
                    Você pode vincular manualmente abaixo.
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="competencySelect">Competência relacionada</Label>
                  <select
                    id="competencySelect"
                    value={newCourse.linkedCompetencyId}
                    onChange={(e) => handleCompetencyChange(e.target.value)}
                    disabled={isSaving || isRecalculating}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Selecione uma competência</option>
                    {competencyOptions.map((item) => (
                      <option
                        key={item.linkedCompetencyId}
                        value={item.linkedCompetencyId}
                      >
                        {item.linkedCompetencyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Eixo institucional</Label>
                  <Input
                    value={newCourse.axisName}
                    readOnly
                    placeholder="Será preenchido automaticamente"
                  />
                </div>
              </div>

              {newCourse.sourceRecommendationTitle && (
                <div className="rounded-lg border bg-primary/5 p-3">
                  <p className="text-sm font-medium">Origem da vinculação</p>
                  <p className="text-sm text-muted-foreground">
                    {newCourse.sourceRecommendationTitle}
                  </p>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                disabled={isSaving || isRecalculating}
                className="h-11 w-full font-bold"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Salvar no Histórico
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={recalculateDerivedData}
                disabled={isSaving || isRecalculating}
                className="h-11 w-full sm:w-auto"
              >
                {isRecalculating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Recalcular diagnóstico
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <BookCheck className="h-5 w-5 text-primary" />
            Meu Histórico
          </h3>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !courses || courses.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed bg-white py-12 text-center italic text-muted-foreground">
              Nenhum curso registrado ainda.
            </div>
          ) : (
            <div className="grid gap-4">
              {[...courses]
                .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                .map((course) => (
                  <Card
                    key={course.id}
                    className="flex items-center justify-between border-l-4 border-l-primary p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-4">
                      <div className="hidden rounded-full bg-primary/10 p-2.5 sm:block">
                        <FileCheck className="h-5 w-5 text-primary" />
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-sm font-bold leading-tight">{course.name}</h4>

                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {course.date}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-primary">
                            {course.hours}h
                          </span>
                        </div>

                        {(course.linkedCompetencyName || course.axisName) && (
                          <div className="pt-1 text-xs text-muted-foreground">
                            {course.linkedCompetencyName && (
                              <div>
                                Competência:{" "}
                                <span className="font-medium">
                                  {course.linkedCompetencyName}
                                </span>
                              </div>
                            )}
                            {course.axisName && (
                              <div>
                                Eixo:{" "}
                                <span className="font-medium">{course.axisName}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {course.certificateUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 gap-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                        >
                          <a
                            href={course.certificateUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver PDF
                          </a>
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => triggerUpload(course.id)}
                          disabled={uploadingId === course.id}
                          className="h-8 gap-2"
                        >
                          {uploadingId === course.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Paperclip className="h-3.5 w-3.5" />
                          )}
                          {uploadingId === course.id ? "Enviando..." : "Anexar"}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(course.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <Button
            type="button"
            onClick={() => router.push("/dashboard/diagnostic")}
            className="rounded-2xl bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
          >
            Continuar para diagnóstico →
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}