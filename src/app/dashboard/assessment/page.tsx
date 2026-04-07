"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type CompetencyAxis = "E1" | "E2" | "E3" | "E4" | "E5";

type ExpectedProfileCompetency = {
  competencyId: string;
  competencyName: string;
  competencyAxis: CompetencyAxis;
  expectedLevel: number;
};

type AssessmentItem = {
  id: string;
  competencyId: string;
  competencyName: string;
  competencyAxis: CompetencyAxis;
  expectedLevel: number;
  currentLevel: number | null;
};

type UserLikeDocument = Record<string, any>;
type CompetencyCatalogMap = Map<
  string,
  { competencyName: string; competencyAxis: CompetencyAxis | null }
>;

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeAxis(value: unknown): CompetencyAxis | null {
  if (typeof value !== "string") return null;

  const upper = value.toUpperCase().trim();

  if (
    upper === "E1" ||
    upper === "E2" ||
    upper === "E3" ||
    upper === "E4" ||
    upper === "E5"
  ) {
    return upper;
  }

  return null;
}

function getAxisLabel(axis: CompetencyAxis): string {
  switch (axis) {
    case "E1":
      return "Comunicação institucional";
    case "E2":
      return "Trabalho em equipe";
    case "E3":
      return "Ética e responsabilidade pública";
    case "E4":
      return "Inovação e melhoria de processos";
    case "E5":
      return "Planejamento e gestão do trabalho";
    default:
      return axis;
  }
}

function formatAxisDisplay(axis: CompetencyAxis): string {
  const numero = axis.replace("E", "");
  return `Eixo ${numero} – ${getAxisLabel(axis)}`;
}

function normalizeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  return "";
}

function normalizeLookupString(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function titleFromId(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractExpectedProfileSources(
  merged: UserLikeDocument,
  contextExpectedProfile: UserLikeDocument | null
) {
  return [
    ...asArray(merged.expectedProfile),
    ...asArray(merged.expected_profile),
    ...asArray(merged.profileCompetencies),
    ...asArray(merged.expectedCompetencies),
    ...asArray(contextExpectedProfile?.competencies),
    ...asArray(contextExpectedProfile?.expectedProfile),
    ...asArray(contextExpectedProfile?.expected_profile),
  ];
}

function dedupeExpectedProfile(
  items: ExpectedProfileCompetency[]
): ExpectedProfileCompetency[] {
  const map = new Map<string, ExpectedProfileCompetency>();

  for (const item of items) {
    const key = normalizeLookupString(item.competencyId);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    map.set(key, {
      ...existing,
      competencyId:
        existing.competencyId.length >= item.competencyId.length
          ? existing.competencyId
          : item.competencyId,
      competencyName:
        existing.competencyName.length >= item.competencyName.length
          ? existing.competencyName
          : item.competencyName,
      competencyAxis: existing.competencyAxis || item.competencyAxis,
      expectedLevel: Math.max(existing.expectedLevel, item.expectedLevel),
    });
  }

  return Array.from(map.values());
}

function deriveAxisFromCompetencyId(competencyId: string): CompetencyAxis | null {
  const upper = normalizeString(competencyId).toUpperCase();

  if (upper.startsWith("E1")) return "E1";
  if (upper.startsWith("E2")) return "E2";
  if (upper.startsWith("E3")) return "E3";
  if (upper.startsWith("E4")) return "E4";
  if (upper.startsWith("E5")) return "E5";

  return null;
}

function getCandidateCompetencyIds(item: any): string[] {
  const values = [
    item?.competencyId,
    item?.id,
    item?.competenciaId,
    item?.competency_id,
  ];

  const ids = values
    .map((value) => normalizeString(value))
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function getCatalogEntry(
  competencyMap: CompetencyCatalogMap,
  candidateIds: string[]
) {
  for (const id of candidateIds) {
    const exact = competencyMap.get(id);
    if (exact) {
      return { entry: exact, matchedId: id };
    }
  }

  for (const id of candidateIds) {
    const lookup = normalizeLookupString(id);

    for (const [key, value] of competencyMap.entries()) {
      if (normalizeLookupString(key) === lookup) {
        return { entry: value, matchedId: key };
      }
    }
  }

  return { entry: null, matchedId: "" };
}

function normalizeExpectedProfile(
  merged: UserLikeDocument,
  contextExpectedProfile: UserLikeDocument | null,
  competencyMap: CompetencyCatalogMap
): ExpectedProfileCompetency[] {
  const sources = extractExpectedProfileSources(merged, contextExpectedProfile);

  const normalized = sources
    .map((item: any) => {
      const candidateIds = getCandidateCompetencyIds(item);
      if (!candidateIds.length) return null;

      const { entry: fromCatalog, matchedId } = getCatalogEntry(
        competencyMap,
        candidateIds
      );

      const rawCompetencyId =
        normalizeString(item?.competencyId) ||
        normalizeString(item?.id) ||
        normalizeString(item?.competenciaId) ||
        normalizeString(item?.competency_id) ||
        matchedId;

      const competencyId = rawCompetencyId || matchedId;
      if (!competencyId) return null;

      const competencyName =
        normalizeString(
          item?.competencyName ??
            item?.name ??
            item?.competencia ??
            item?.title
        ) ||
        fromCatalog?.competencyName ||
        titleFromId(competencyId);

      const competencyAxis =
        normalizeAxis(item?.competencyAxis) ??
        normalizeAxis(item?.axis) ??
        normalizeAxis(item?.eixo) ??
        fromCatalog?.competencyAxis ??
        deriveAxisFromCompetencyId(competencyId);

      const expectedLevel = Number(
        item?.expectedLevel ??
          item?.requiredLevel ??
          item?.nivelEsperado ??
          item?.level ??
          0
      );

      if (!competencyAxis || Number.isNaN(expectedLevel) || expectedLevel <= 0) {
        return null;
      }

      return {
        competencyId,
        competencyName,
        competencyAxis,
        expectedLevel,
      } satisfies ExpectedProfileCompetency;
    })
    .filter(Boolean) as ExpectedProfileCompetency[];

  return dedupeExpectedProfile(normalized);
}

async function loadCompetencyCatalog(db: any): Promise<CompetencyCatalogMap> {
  const map: CompetencyCatalogMap = new Map();
  const candidateCollections = ["competencies", "catalogCompetencies"];

  for (const collectionName of candidateCollections) {
    try {
      const snap = await getDocs(collection(db, collectionName));

      snap.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;

        const competencyId =
          normalizeString(data?.id) ||
          normalizeString(data?.competencyId) ||
          normalizeString(data?.codigo) ||
          normalizeString(docSnap.id);

        if (!competencyId) return;

        const competencyName =
          normalizeString(data?.name) ||
          normalizeString(data?.nome) ||
          normalizeString(data?.title) ||
          titleFromId(competencyId);

        const competencyAxis =
          normalizeAxis(data?.competencyAxis) ??
          normalizeAxis(data?.axis) ??
          normalizeAxis(data?.eixo) ??
          deriveAxisFromCompetencyId(competencyId);

        map.set(competencyId, {
          competencyName,
          competencyAxis,
        });
      });

      if (map.size > 0) {
        return map;
      }
    } catch {
      // ignora coleção inexistente
    }
  }

  return map;
}

async function loadUserDocuments(db: any, uid: string) {
  const candidateRefs = [
    doc(db, "users", uid),
    doc(db, "userProfiles", uid),
    doc(db, "users", uid, "snapshots", "current"),
    doc(db, "users", uid, "profile", "current"),
  ];

  const merged: UserLikeDocument = {};

  for (const ref of candidateRefs) {
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        Object.assign(merged, snap.data());
      }
    } catch {
      // ignora referências inexistentes
    }
  }

  let contextExpectedProfile: UserLikeDocument | null = null;
  try {
    const contextExpectedProfileRef = doc(
      db,
      "users",
      uid,
      "context",
      "expectedProfile"
    );
    const contextExpectedProfileSnap = await getDoc(contextExpectedProfileRef);

    if (contextExpectedProfileSnap.exists()) {
      contextExpectedProfile =
        contextExpectedProfileSnap.data() as UserLikeDocument;
    }
  } catch {
    // ignora ausência do expectedProfile do contexto
  }

  let savedAssessmentItems: any[] = [];
  try {
    const assessmentRef = doc(db, "users", uid, "assessment", "competencies");
    const assessmentSnap = await getDoc(assessmentRef);

    if (assessmentSnap.exists()) {
      savedAssessmentItems = asArray(assessmentSnap.data()?.items);
    }
  } catch {
    // ignora ausência do documento de assessment
  }

  const competencyMap = await loadCompetencyCatalog(db);

  return {
    merged,
    contextExpectedProfile,
    competencyMap,
    expectedProfile: normalizeExpectedProfile(
      merged,
      contextExpectedProfile,
      competencyMap
    ),
    savedAssessmentItems,
  };
}

function levelLabel(level: number) {
  if (level <= 1) return "Básico";
  if (level === 2) return "Intermediário";
  return "Avançado";
}

function mapExpectedProfileToAssessments(
  expectedProfile: ExpectedProfileCompetency[],
  savedAssessmentItems: any[]
): AssessmentItem[] {
  const savedMap = new Map<string, number | null>();

  for (const item of savedAssessmentItems) {
    const competencyId = normalizeString(
      item?.competencyId ?? item?.id ?? item?.competenciaId
    );

    const rawLevel =
      item?.currentLevel ?? item?.level ?? item?.nivelAtual ?? null;

    const currentLevel =
      rawLevel === null || rawLevel === undefined || rawLevel === ""
        ? null
        : Number(rawLevel);

    if (
      competencyId &&
      currentLevel !== null &&
      !Number.isNaN(currentLevel) &&
      currentLevel > 0
    ) {
      savedMap.set(normalizeLookupString(competencyId), currentLevel);
    }
  }

  return expectedProfile.map((item) => ({
    id: item.competencyId,
    competencyId: item.competencyId,
    competencyName: item.competencyName,
    competencyAxis: item.competencyAxis,
    expectedLevel: item.expectedLevel,
    currentLevel:
      savedMap.get(normalizeLookupString(item.competencyId)) ?? null,
  }));
}

export default function AssessmentPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalFilled = useMemo(
    () => assessments.filter((item) => item.currentLevel !== null).length,
    [assessments]
  );

  const totalPending = useMemo(
    () => Math.max(assessments.length - totalFilled, 0),
    [assessments.length, totalFilled]
  );

  const groupedAssessments = useMemo(() => {
    const groups: Record<CompetencyAxis, AssessmentItem[]> = {
      E1: [],
      E2: [],
      E3: [],
      E4: [],
      E5: [],
    };

    for (const item of assessments) {
      groups[item.competencyAxis].push(item);
    }

    return groups;
  }, [assessments]);

  const loadAssessmentData = useCallback(async () => {
    if (!user?.uid || !db) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { expectedProfile, savedAssessmentItems, contextExpectedProfile } =
        await loadUserDocuments(db, user.uid);

      if (!expectedProfile.length) {
        const matrixSectorId = normalizeString(
          contextExpectedProfile?.matrixSectorId
        );
        const sectorId = normalizeString(contextExpectedProfile?.sectorId);

        setAssessments([]);
        setErrorMessage(
          matrixSectorId || sectorId
            ? "Nenhuma competência esperada foi carregada para este contexto. Verifique o mapeamento do setor e a geração do expectedProfile."
            : "Nenhuma competência esperada foi encontrada. Primeiro salve seu contexto profissional para gerar a autoavaliação."
        );
        return;
      }

      const normalized = mapExpectedProfileToAssessments(
        expectedProfile,
        savedAssessmentItems
      );

      setAssessments(normalized);
    } catch (error) {
      console.error("Erro ao carregar autoavaliação:", error);
      setAssessments([]);
      setErrorMessage(
        "Não foi possível carregar as competências esperadas deste usuário."
      );
    } finally {
      setIsLoading(false);
    }
  }, [db, user?.uid]);

  useEffect(() => {
    loadAssessmentData();
  }, [loadAssessmentData]);

  const updateLevel = (competencyId: string, level: number) => {
    setAssessments((prev) =>
      prev.map((item) =>
        item.competencyId === competencyId
          ? { ...item, currentLevel: level }
          : item
      )
    );
  };

  const handleSaveAll = async (): Promise<boolean> => {
    if (!user?.uid || !db) return false;

    if (totalPending > 0) {
      toast({
        title: "Preenchimento incompleto",
        description:
          "Selecione seu nível de domínio para todas as competências antes de salvar.",
        variant: "destructive",
      });
      return false;
    }

    setIsSaving(true);

    try {
      const assessmentRef = doc(
        db,
        "users",
        user.uid,
        "assessment",
        "competencies"
      );

      await setDoc(
        assessmentRef,
        {
          items: assessments.map((item) => ({
            competencyId: item.competencyId,
            competencyName: item.competencyName,
            competencyAxis: item.competencyAxis,
            expectedLevel: item.expectedLevel,
            currentLevel: item.currentLevel,
          })),
          totalItems: assessments.length,
          completedItems: assessments.filter(
            (item) => item.currentLevel !== null
          ).length,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const diagnosticItems = assessments.map((item) => {
        const gap = Math.max(
          (item.expectedLevel || 0) - (item.currentLevel || 0),
          0
        );

        let priority: "ALTA" | "MÉDIA" | "BAIXA" = "BAIXA";

        if (gap >= 2) priority = "ALTA";
        else if (gap === 1) priority = "MÉDIA";

        return {
          competencyId: item.competencyId,
          competencyName: item.competencyName,
          axisCode: item.competencyAxis,
          axisName: getAxisLabel(item.competencyAxis),
          expectedLevel: item.expectedLevel,
          currentLevel: item.currentLevel || 0,
          gap,
          priority,
        };
      });

      const diagnosticRef = doc(
        db,
        "users",
        user.uid,
        "diagnostics",
        "current"
      );

      await setDoc(
        diagnosticRef,
        {
          userId: user.uid,
          items: diagnosticItems,
          generatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const recommendationsRef = doc(
        db,
        "users",
        user.uid,
        "recommendations",
        "current"
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
        title: "Autoavaliação salva",
        description:
          "Suas competências foram registradas e o sistema já atualizou seu desenvolvimento.",
      });

      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Erro interno.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndContinue = async () => {
    const success = await handleSaveAll();
    if (success) {
      router.push("/dashboard/recommendations");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-primary">
                Autoavaliação de Competências
              </h1>

              <p className="text-muted-foreground">
                Informe o seu nível de domínio atual para cada competência
                esperada no seu contexto de trabalho.
              </p>
            </div>

            {!isLoading && !errorMessage && assessments.length > 0 && (
              <Button
                onClick={handleSaveAll}
                disabled={isSaving || totalPending > 0}
                className="hidden h-11 min-w-44 font-semibold md:inline-flex"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar autoavaliação"
                )}
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Etapa 2 de 5 — Autoavaliação
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[40%] bg-primary" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Competências esperadas</CardDescription>
              <CardTitle className="text-2xl">{assessments.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Competências preenchidas</CardDescription>
              <CardTitle className="text-2xl">{totalFilled}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-2xl">{totalPending}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {totalPending > 0 && !isLoading && !errorMessage && assessments.length > 0 && (
          <Card className="border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 text-amber-700">
                <AlertCircle className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-medium">Preenchimento necessário</p>
                  <p className="text-sm">
                    Selecione seu nível de domínio para todas as competências
                    antes de salvar.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando competências esperadas...
              </div>
            </CardContent>
          </Card>
        ) : errorMessage ? (
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="h-5 w-5" />
                Atenção
              </CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {(["E1", "E2", "E3", "E4", "E5"] as CompetencyAxis[]).map((axis) => {
              const items = groupedAssessments[axis];
              if (!items.length) return null;

              return (
                <div key={axis} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold text-primary">
                      {getAxisLabel(axis)}
                    </h2>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>

                  {items.map((comp) => (
                    <Card key={comp.id}>
                      <CardContent className="space-y-4 p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {formatAxisDisplay(axis)}
                          </Badge>

                          <Badge variant="outline">
                            Esperado: {levelLabel(comp.expectedLevel)}
                          </Badge>

                          {comp.currentLevel !== null ? (
                            <Badge variant="outline">
                              Atual: {levelLabel(comp.currentLevel)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Atual: não informado
                            </Badge>
                          )}
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold">
                            {comp.competencyName}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Informe seu nível atual de domínio para esta
                            competência.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3].map((level) => {
                            const selected = comp.currentLevel === level;

                            return (
                              <Button
                                key={level}
                                type="button"
                                variant={selected ? "default" : "outline"}
                                onClick={() =>
                                  updateLevel(comp.competencyId, level)
                                }
                                className="min-w-32"
                              >
                                {levelLabel(level)}
                              </Button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })}

            <div className="pt-6 flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={handleSaveAll}
                disabled={isSaving || !assessments.length || totalPending > 0}
                className="h-12 w-full text-base font-semibold"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar autoavaliação"
                )}
              </Button>

              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleSaveAndContinue}
                  disabled={isSaving || !assessments.length || totalPending > 0}
                  className="rounded-2xl bg-blue-600 px-6 py-3 text-white font-medium transition hover:bg-blue-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Continuar →"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}