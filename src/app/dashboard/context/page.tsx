"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  useDoc,
  useFirestore,
  useMemoFirebase,
  useUser,
  useCollection,
} from "@/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import DashboardLayout from "@/components/layout/dashboard-layout";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

import { useToast } from "@/hooks/use-toast";

import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

import { logResearchEvent } from "@/lib/analytics";
import { buildExpectedProfile } from "@/lib/competencies/buildExpectedProfile";

import { orgUnits } from "@/data/orgUnits";
import { orgSectors } from "@/data/orgSectors";

function sanitizeFirestoreData(data: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};

  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value !== undefined) {
      clean[key] = value;
    }
  });

  return clean;
}

function firstString(...values: any[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function firstNumber(...values: any[]): number {
  for (const value of values) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
  }
  return 9999;
}

function normalizeBoolean(value: any, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLookup(value: unknown): string {
  return firstString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s:-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function timestampLikeToDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function formatDateTime(value: any): string {
  const date = timestampLikeToDate(value);
  if (!date) return "Data não informada";
  return date.toLocaleString("pt-BR");
}

type UnidadeOption = {
  id: string;
  nome: string;
  sigla?: string;
  campus?: string;
  sortOrder: number;
};

type SetorOption = {
  id: string;
  nome: string;
  sigla?: string;
  unitId: string;
  sortOrder: number;
  matrixSectorId?: string;
  rawId?: string;
  macroArea?: string;
};

type FuncaoOption = {
  id: string;
  nome: string;
  sortOrder: number;
};

type ContextHistoryItem = {
  id: string;
  unidadeNome: string;
  setorNome: string;
  funcaoNome: string;
  changedAt?: any;
  previousContextSnapshot?: Record<string, any> | null;
};

function resolveSavedSectorId(
  savedSectorId: string,
  sectors: SetorOption[]
): string {
  if (!savedSectorId) return "";

  const exactMatch = sectors.find((sector) => sector.id === savedSectorId);
  if (exactMatch) return exactMatch.id;

  const rawMatch = sectors.find((sector) => sector.rawId === savedSectorId);
  if (rawMatch) return rawMatch.id;

  const matrixMatch = sectors.find(
    (sector) => sector.matrixSectorId === savedSectorId
  );
  if (matrixMatch) return matrixMatch.id;

  return "";
}

function formatUnitLabel(unit: UnidadeOption): string {
  const sigla = firstString(unit.sigla);
  const campus = firstString(unit.campus);

  if (sigla && campus) {
    return `${unit.nome} — ${sigla} (${campus})`;
  }

  if (sigla) {
    return `${unit.nome} — ${sigla}`;
  }

  if (campus) {
    return `${unit.nome} (${campus})`;
  }

  return unit.nome;
}

function formatSectorLabel(sector: SetorOption): string {
  const sigla = firstString(sector.sigla);
  if (!sigla) return sector.nome;
  return `${sector.nome} — ${sigla}`;
}

function dedupeUnits(items: Array<UnidadeOption & { active?: boolean }>): UnidadeOption[] {
  const byLabel = new Map<string, UnidadeOption>();

  for (const item of items) {
    const key = normalizeText(`${item.nome}|${item.sigla || ""}|${item.campus || ""}`);
    if (!key) continue;

    const existing = byLabel.get(key);
    if (!existing) {
      byLabel.set(key, {
        id: item.id,
        nome: item.nome,
        sigla: item.sigla,
        campus: item.campus,
        sortOrder: item.sortOrder,
      });
      continue;
    }

    const currentScore =
      (item.sigla ? 1 : 0) +
      (item.campus ? 1 : 0) +
      (item.nome.length > existing.nome.length ? 1 : 0);

    const existingScore =
      (existing.sigla ? 1 : 0) +
      (existing.campus ? 1 : 0);

    if (currentScore > existingScore) {
      byLabel.set(key, {
        id: item.id,
        nome: item.nome,
        sigla: item.sigla,
        campus: item.campus,
        sortOrder: item.sortOrder,
      });
    }
  }

  return Array.from(byLabel.values()).sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      formatUnitLabel(a).localeCompare(formatUnitLabel(b), "pt-BR")
  );
}

function dedupeSectors(items: Array<SetorOption & { active?: boolean }>): SetorOption[] {
  const byKey = new Map<string, SetorOption>();

  for (const item of items) {
    const key = `${item.unitId}::${normalizeText(item.nome)}::${normalizeText(item.sigla || "")}`;
    if (!item.unitId || !item.nome || !key) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item });
      continue;
    }

    const currentScore =
      (item.matrixSectorId ? 2 : 0) +
      (item.sigla ? 1 : 0) +
      (item.nome.length > existing.nome.length ? 1 : 0);

    const existingScore =
      (existing.matrixSectorId ? 2 : 0) +
      (existing.sigla ? 1 : 0);

    if (currentScore > existingScore) {
      byKey.set(key, { ...item });
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      formatSectorLabel(a).localeCompare(formatSectorLabel(b), "pt-BR")
  );
}

function buildContextComparisonSignature(params: {
  unidadeId?: string | null;
  setorId?: string | null;
  funcaoFormalId?: string | null;
  possuiFuncaoFormal?: boolean | null;
}) {
  return [
    firstString(params.unidadeId),
    firstString(params.setorId),
    params.possuiFuncaoFormal ? "1" : "0",
    params.possuiFuncaoFormal ? firstString(params.funcaoFormalId) : "",
  ].join("::");
}

export default function ContextPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    unidadeId: "",
    setorId: "",
    possuiFuncaoFormal: false,
    funcaoFormalId: "",
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const canReadProtectedData = isMounted && !!db && !!user?.uid && !isUserLoading;

  const contextDocRef = useMemoFirebase(() => {
    if (!canReadProtectedData || !db || !user?.uid) return null;
    return doc(db, "users", user.uid, "context", "professionalContext");
  }, [canReadProtectedData, db, user?.uid]);

  const { data: contextData, isLoading: isLoadingInitialContext } =
    useDoc(contextDocRef);

  const formalRolesQuery = useMemoFirebase(() => {
    if (!canReadProtectedData || !db || !user?.uid) return null;
    return query(collection(db, "formalRoles"));
  }, [canReadProtectedData, db, user?.uid]);

  const { data: rawFormalRoles, isLoading: isLoadingFormalRoles } =
    useCollection(formalRolesQuery);

  const unitsQuery = useMemoFirebase(() => {
    if (!canReadProtectedData || !db || !user?.uid) return null;
    return query(collection(db, "unidades"));
  }, [canReadProtectedData, db, user?.uid]);

  const sectorsQuery = useMemoFirebase(() => {
    if (!canReadProtectedData || !db || !user?.uid) return null;
    return query(collection(db, "setores"));
  }, [canReadProtectedData, db, user?.uid]);

  const contextHistoryQuery = useMemoFirebase(() => {
    if (!canReadProtectedData || !db || !user?.uid) return null;
    return query(collection(db, "users", user.uid, "contextHistory"));
  }, [canReadProtectedData, db, user?.uid]);

  const { data: firestoreUnits, isLoading: isLoadingUnits } =
    useCollection(unitsQuery);

  const { data: firestoreSectors, isLoading: isLoadingSectors } =
    useCollection(sectorsQuery);

  const { data: rawContextHistory, isLoading: isLoadingContextHistory } =
    useCollection(contextHistoryQuery);

  const rawUnits =
    Array.isArray(firestoreUnits) && firestoreUnits.length > 0
      ? firestoreUnits
      : orgUnits;

  const rawSectors =
    Array.isArray(firestoreSectors) && firestoreSectors.length > 0
      ? firestoreSectors
      : orgSectors;

  const units = useMemo<UnidadeOption[]>(() => {
    const mapped = (rawUnits ?? [])
      .map((u: any) => {
        const id = firstString(u?.unitId, u?.id, u?.codigo, u?.sigla);

        const nome = firstString(
          u?.name,
          u?.nome,
          u?.unitName,
          u?.title,
          u?.titulo,
          u?.acronym,
          u?.sigla,
          id
        );

        const sigla = firstString(u?.sigla, u?.acronym, u?.codigo);
        const campus = firstString(u?.campus);

        const active = normalizeBoolean(u?.active, true);

        return {
          id,
          nome,
          sigla,
          campus,
          sortOrder: firstNumber(u?.sortOrder, u?.ordem, u?.order),
          active,
        };
      })
      .filter((u) => u.id && u.nome && u.active);

    return dedupeUnits(mapped);
  }, [rawUnits]);

  const allSectors = useMemo<SetorOption[]>(() => {
    const mapped = (rawSectors ?? [])
      .map((s: any) => {
        const rawId = firstString(
          s?.rawId,
          s?.originalSectorId,
          s?.id,
          s?.sectorId,
          s?.codigo
        );
        const id = firstString(s?.id, s?.sectorId, s?.codigo, rawId);
        const matrixSectorId = firstString(s?.matrixSectorId);
        const macroArea = firstString(s?.macroArea, s?.macro_area);
        const sigla = firstString(s?.sigla);

        const nome = firstString(
          s?.name,
          s?.nome,
          s?.sectorName,
          s?.setorNome,
          s?.title,
          s?.titulo,
          id
        );

        const unitId = firstString(
          s?.unitId,
          s?.unidadeId,
          s?.unidadeIdRef,
          s?.orgUnitId,
          s?.parentUnitId
        );

        const active = normalizeBoolean(s?.active, true);

        return {
          id,
          nome,
          sigla,
          unitId,
          sortOrder: firstNumber(s?.sortOrder, s?.ordem, s?.order),
          active,
          matrixSectorId,
          rawId,
          macroArea,
        };
      })
      .filter((s) => s.id && s.nome && s.unitId && s.active);

    return dedupeSectors(mapped);
  }, [rawSectors]);

  const sectors = useMemo<SetorOption[]>(() => {
    return allSectors.filter((sector) => sector.unitId === formData.unidadeId);
  }, [allSectors, formData.unidadeId]);

  const formalRoles = useMemo<FuncaoOption[]>(() => {
    const mapped = (rawFormalRoles ?? [])
      .map((r: any) => {
        const id = firstString(
          r?.formalRoleId,
          r?.roleId,
          r?.codigo,
          r?.id
        );

        const nome = firstString(
          r?.name,
          r?.nome,
          r?.roleName,
          r?.title,
          r?.titulo,
          id
        );

        const active = normalizeBoolean(r?.active, true);

        return {
          id,
          nome,
          sortOrder: firstNumber(r?.sortOrder, r?.ordem, r?.order),
          active,
        };
      })
      .filter((r) => r.id && r.nome && r.active);

    const unique = Array.from(
      new Map(mapped.map((item) => [item.id, item])).values()
    );

    return unique
      .map(({ id, nome, sortOrder }) => ({
        id,
        nome,
        sortOrder,
      }))
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.nome.localeCompare(b.nome, "pt-BR")
      );
  }, [rawFormalRoles]);

  const contextHistory = useMemo<ContextHistoryItem[]>(() => {
    const mapped = (rawContextHistory ?? [])
      .map((item: any) => ({
        id: firstString(item?.id, item?.historyId) || crypto.randomUUID(),
        unidadeNome: firstString(
          item?.unidadeNome,
          item?.unitName,
          item?.previousContextSnapshot?.unidadeNome,
          item?.previousContextSnapshot?.unitName
        ),
        setorNome: firstString(
          item?.setorNome,
          item?.sectorName,
          item?.previousContextSnapshot?.setorNome,
          item?.previousContextSnapshot?.sectorName
        ),
        funcaoNome: firstString(
          item?.funcaoNome,
          item?.roleName,
          item?.previousContextSnapshot?.funcaoNome,
          item?.previousContextSnapshot?.roleName
        ),
        changedAt: item?.changedAt || item?.updatedAt || item?.createdAt || null,
        previousContextSnapshot:
          item?.previousContextSnapshot && typeof item.previousContextSnapshot === "object"
            ? item.previousContextSnapshot
            : null,
      }))
      .filter((item) => item.unidadeNome || item.setorNome || item.funcaoNome);

    return mapped
      .sort((a, b) => {
        const aTime = timestampLikeToDate(a.changedAt)?.getTime() || 0;
        const bTime = timestampLikeToDate(b.changedAt)?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [rawContextHistory]);

  useEffect(() => {
    if (!contextData || isLoadingSectors) return;

    const savedSectorId = firstString(
      contextData.setorId,
      contextData.sectorId,
      contextData.originalSectorId
    );

    const resolvedSectorId = resolveSavedSectorId(savedSectorId, allSectors);
    const savedUnitId = firstString(contextData.unidadeId, contextData.unitId);

    setFormData({
      unidadeId: savedUnitId || "",
      setorId: resolvedSectorId || "",
      possuiFuncaoFormal: !!contextData.possuiFuncaoFormal,
      funcaoFormalId:
        contextData.funcaoFormalId || contextData.formalRoleId || "",
    });
  }, [contextData, allSectors, isLoadingSectors]);

  useEffect(() => {
    if (!formData.unidadeId || isLoadingSectors) return;
    if (sectors.some((s) => s.id === formData.setorId)) return;

    setFormData((prev) => ({
      ...prev,
      setorId: "",
      funcaoFormalId: "",
    }));
  }, [formData.unidadeId, formData.setorId, sectors, isLoadingSectors]);

  const handleUnitChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      unidadeId: val,
      setorId: "",
      funcaoFormalId: "",
    }));
  };

  const handleSectorChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      setorId: val,
      funcaoFormalId: "",
    }));
  };

  async function archivePreviousContextIfChanged(params: {
    userId: string;
    currentContextData: Record<string, any> | null | undefined;
    nextPayload: Record<string, any>;
  }): Promise<boolean> {
    const { userId, currentContextData, nextPayload } = params;

    if (!db) return false;
    if (!currentContextData || Object.keys(currentContextData).length === 0) {
      return false;
    }

    const currentSignature = buildContextComparisonSignature({
      unidadeId: currentContextData.unidadeId || currentContextData.unitId,
      setorId:
        currentContextData.setorId ||
        currentContextData.sectorId ||
        currentContextData.originalSectorId,
      funcaoFormalId:
        currentContextData.funcaoFormalId || currentContextData.formalRoleId,
      possuiFuncaoFormal: !!currentContextData.possuiFuncaoFormal,
    });

    const nextSignature = buildContextComparisonSignature({
      unidadeId: nextPayload.unidadeId || nextPayload.unitId,
      setorId:
        nextPayload.setorId ||
        nextPayload.sectorId ||
        nextPayload.originalSectorId,
      funcaoFormalId:
        nextPayload.funcaoFormalId || nextPayload.formalRoleId,
      possuiFuncaoFormal: !!nextPayload.possuiFuncaoFormal,
    });

    if (!currentSignature || currentSignature === nextSignature) {
      return false;
    }

    const historyId = `ctx_${Date.now()}`;

    await setDoc(
      doc(db, "users", userId, "contextHistory", historyId),
      sanitizeFirestoreData({
        id: historyId,
        historyId,
        unidadeId:
          currentContextData.unidadeId || currentContextData.unitId || null,
        unidadeNome:
          currentContextData.unidadeNome || currentContextData.unitName || null,
        setorId:
          currentContextData.setorId ||
          currentContextData.sectorId ||
          currentContextData.originalSectorId ||
          null,
        setorNome:
          currentContextData.setorNome || currentContextData.sectorName || null,
        funcaoFormalId:
          currentContextData.funcaoFormalId ||
          currentContextData.formalRoleId ||
          null,
        funcaoNome:
          currentContextData.funcaoNome || currentContextData.roleName || null,
        changedAt: serverTimestamp(),
        previousContextSnapshot: currentContextData,
      }),
      { merge: true }
    );

    return true;
  }

  async function invalidateDerivedData(userId: string): Promise<void> {
    if (!db) return;

    const assessmentRef = doc(db, "users", userId, "assessment", "competencies");
    const diagnosticRef = doc(db, "users", userId, "diagnostics", "current");
    const recommendationsRef = doc(
      db,
      "users",
      userId,
      "recommendations",
      "current"
    );

    await Promise.all([
      deleteDoc(assessmentRef).catch(() => null),
      deleteDoc(diagnosticRef).catch(() => null),
      setDoc(
        recommendationsRef,
        {
          needsUpdate: true,
          recommendations: [],
          summary: {
            totalRecommendations: 0,
            highPriorityRecommendations: 0,
            mediumPriorityRecommendations: 0,
            lowPriorityRecommendations: 0,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => null),
    ]);
  }

  const saveContext = async (): Promise<boolean> => {
    if (!user?.uid || !db) {
      toast({
        title: "Erro de sessão",
        description: "Verifique sua conexão.",
        variant: "destructive",
      });
      return false;
    }

    setIsSaving(true);

    try {
      const selectedUnit = units.find((u) => u.id === formData.unidadeId);
      const selectedSector = allSectors.find((s) => s.id === formData.setorId);
      const selectedRole = formalRoles.find(
        (r) => r.id === formData.funcaoFormalId
      );

      if (!selectedSector) {
        toast({
          title: "Setor inválido",
          description: "Selecione um setor válido antes de salvar.",
          variant: "destructive",
        });
        return false;
      }

      const matrixSectorId =
        selectedSector.matrixSectorId &&
        selectedSector.matrixSectorId.trim() !== ""
          ? selectedSector.matrixSectorId
          : null;

      const macroArea =
        selectedSector.macroArea && selectedSector.macroArea.trim() !== ""
          ? selectedSector.macroArea
          : null;

      const contextRef = doc(
        db,
        "users",
        user.uid,
        "context",
        "professionalContext"
      );

      const currentContextSnap = await getDoc(contextRef);
      const currentContextData = currentContextSnap.exists()
        ? (currentContextSnap.data() as Record<string, any>)
        : null;

      const contextPayload = sanitizeFirestoreData({
        unidadeId: formData.unidadeId || null,
        unidadeNome: selectedUnit?.nome || null,
        unidadeSigla: selectedUnit?.sigla || null,
        unidadeCampus: selectedUnit?.campus || null,
        unitId: formData.unidadeId || null,
        unitName: selectedUnit?.nome || null,

        setorId: selectedSector.id || null,
        setorNome: selectedSector.nome || null,
        setorSigla: selectedSector.sigla || null,
        sectorId: selectedSector.id || null,
        sectorName: selectedSector.nome || null,

        macroArea,
        matrixSectorId,
        originalSectorId: selectedSector.rawId || selectedSector.id || null,

        possuiFuncaoFormal: formData.possuiFuncaoFormal,
        funcaoFormalId: formData.possuiFuncaoFormal
          ? formData.funcaoFormalId || null
          : null,
        formalRoleId: formData.possuiFuncaoFormal
          ? formData.funcaoFormalId || null
          : null,
        funcaoNome: formData.possuiFuncaoFormal
          ? selectedRole?.nome || null
          : null,
        roleName: formData.possuiFuncaoFormal
          ? selectedRole?.nome || null
          : null,

        userId: user.uid,
        updatedAt: serverTimestamp(),
      });

      const contextChanged = await archivePreviousContextIfChanged({
        userId: user.uid,
        currentContextData,
        nextPayload: contextPayload,
      });

      await setDoc(contextRef, contextPayload, { merge: true });

      if (contextChanged) {
        await invalidateDerivedData(user.uid);
      }

      toast({
        title: "Contexto Atualizado",
        description: contextChanged
          ? "Seu contexto foi salvo. A autoavaliação anterior foi invalidada para refletir o novo contexto."
          : "Seu contexto foi salvo com sucesso.",
      });

      return true;
    } catch (error: any) {
      console.error("CONTEXT_SAVE_ERROR:", error);
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Ocorreu um erro interno.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const generateExpectedProfile = async (): Promise<boolean> => {
    if (!user?.uid || !db) return false;

    try {
      const selectedUnit = units.find((u) => u.id === formData.unidadeId);
      const selectedSector = allSectors.find((s) => s.id === formData.setorId);
      const selectedRole = formalRoles.find(
        (r) => r.id === formData.funcaoFormalId
      );

      if (!selectedSector) {
        toast({
          title: "Setor inválido",
          description: "Selecione um setor válido antes de continuar.",
          variant: "destructive",
        });
        return false;
      }

      const matrixSectorId =
        selectedSector.matrixSectorId &&
        selectedSector.matrixSectorId.trim() !== ""
          ? selectedSector.matrixSectorId
          : null;

      const macroArea =
        selectedSector.macroArea && selectedSector.macroArea.trim() !== ""
          ? selectedSector.macroArea
          : null;

      const userProfileRef = doc(db, "users", user.uid);
      const userProfileSnap = await getDoc(userProfileRef);
      const userProfileData = userProfileSnap.exists()
        ? (userProfileSnap.data() as Record<string, any>)
        : {};

      const jobId =
        firstString(
          userProfileData.jobId,
          userProfileData.cargoId,
          userProfileData.roleId,
          userProfileData.cargo,
          userProfileData.role
        ) || null;

      const educationAreaId =
        firstString(
          userProfileData.educationAreaId,
          userProfileData.areaFormacaoId,
          userProfileData.areaFormacao,
          userProfileData.educationArea
        ) || null;

      const educationLevel =
        firstString(
          userProfileData.educationLevel,
          userProfileData.formacaoNivel,
          userProfileData.nivelFormacao,
          userProfileData.formacao
        ) || null;

      const expectedProfile = await buildExpectedProfile({
        db,
        unitId: formData.unidadeId || null,
        sectorId: selectedSector.id,
        matrixSectorId,
        formalRoleId: formData.possuiFuncaoFormal
          ? formData.funcaoFormalId
          : null,
        jobId,
        educationAreaId,
        educationLevel,
      });

      const profileRef = doc(
        db,
        "users",
        user.uid,
        "context",
        "expectedProfile"
      );

      const normalizedExpectedProfile = Array.isArray(expectedProfile)
        ? expectedProfile
        : [];

      if (normalizedExpectedProfile.length === 0) {
        toast({
          title: "Perfil esperado vazio",
          description:
            "Não foi possível montar a Autoavaliação para este contexto. Verifique a matriz do setor e os vínculos de competências.",
          variant: "destructive",
        });
      }

      const profilePayload = sanitizeFirestoreData({
        sectorId: selectedSector.id || null,
        setorId: selectedSector.id || null,
        sectorName: selectedSector.nome || null,
        setorNome: selectedSector.nome || null,
        setorSigla: selectedSector.sigla || null,

        unitId: formData.unidadeId || null,
        unidadeId: formData.unidadeId || null,
        unitName: selectedUnit?.nome || null,
        unidadeNome: selectedUnit?.nome || null,
        unidadeSigla: selectedUnit?.sigla || null,
        unidadeCampus: selectedUnit?.campus || null,

        formalRoleId: formData.possuiFuncaoFormal
          ? formData.funcaoFormalId || null
          : null,
        funcaoFormalId: formData.possuiFuncaoFormal
          ? formData.funcaoFormalId || null
          : null,
        roleName: formData.possuiFuncaoFormal
          ? selectedRole?.nome || null
          : null,
        funcaoNome: formData.possuiFuncaoFormal
          ? selectedRole?.nome || null
          : null,

        jobId,
        educationAreaId,
        educationLevel,

        macroArea,
        matrixSectorId,
        originalSectorId: selectedSector.rawId || selectedSector.id || null,

        competencies: normalizedExpectedProfile,
        expectedProfile: normalizedExpectedProfile,

        generated: true,
        isEmpty: normalizedExpectedProfile.length === 0,
        updatedAt: serverTimestamp(),
      });

      await setDoc(profileRef, profilePayload, { merge: true });

      await invalidateDerivedData(user.uid);

      logResearchEvent(db, {
        uid: user.uid,
        eventType: "CONTEXT_SAVED",
        contextSnapshot: {
          unidadeId: formData.unidadeId,
          unidadeNome: selectedUnit?.nome || null,
          unidadeSigla: selectedUnit?.sigla || null,
          unidadeCampus: selectedUnit?.campus || null,
          unitName: selectedUnit?.nome || null,

          setorId: selectedSector.id,
          setorNome: selectedSector.nome || null,
          setorSigla: selectedSector.sigla || null,
          sectorName: selectedSector.nome || null,

          macroArea,

          funcaoFormalId: formData.possuiFuncaoFormal
            ? formData.funcaoFormalId || null
            : null,
          funcaoNome: formData.possuiFuncaoFormal
            ? selectedRole?.nome || null
            : null,
          roleName: formData.possuiFuncaoFormal
            ? selectedRole?.nome || null
            : null,

          matrixSectorId,

          jobId,
          educationAreaId,
          educationLevel,
        },
      });

      if (normalizedExpectedProfile.length === 0) {
        console.warn(
          "⚠️ expectedProfile vazio. Verifique setor_competencias/sectorCompetencies, vínculos de competências e eventuais matrizes complementares."
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("EXPECTED_PROFILE_GENERATION_ERROR:", error);
      toast({
        title: "Contexto salvo",
        description:
          "O contexto foi salvo, mas houve um problema ao preparar a próxima etapa.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleSave = async () => {
    await saveContext();
  };

  const handleSaveAndContinue = async () => {
    const success = await saveContext();
    if (!success) return;

    const generated = await generateExpectedProfile();
    if (!generated) return;

    router.push("/dashboard/assessment");
  };

  if (
    !isMounted ||
    isUserLoading ||
    !user ||
    isLoadingInitialContext ||
    isLoadingUnits ||
    isLoadingSectors
  ) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="animate-pulse text-muted-foreground">
            Carregando dados...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-headline text-3xl font-bold text-primary">
                Contexto de Trabalho
              </h1>
              <p className="text-muted-foreground">
                Informe sua lotação atual para personalizar suas recomendações.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Etapa 1 de 5 — Contexto de Trabalho
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[20%] bg-primary" />
            </div>
          </div>
        </div>

        <Card className="border-primary/5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Localização Institucional</CardTitle>
            <CardDescription>
              Estes dados definem quais competências são esperadas de você.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Unidade / Campus</Label>
              <Select value={formData.unidadeId} onValueChange={handleUnitChange}>
                <SelectTrigger className="h-11">
                  <SelectValue
                    placeholder={
                      isLoadingUnits ? "Carregando..." : "Selecione a unidade"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {formatUnitLabel(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Setor / Departamento</Label>
              <Select
                value={formData.setorId}
                onValueChange={handleSectorChange}
                disabled={!formData.unidadeId}
              >
                <SelectTrigger className="h-11">
                  <SelectValue
                    placeholder={
                      !formData.unidadeId
                        ? "Selecione primeiro a unidade"
                        : isLoadingSectors
                        ? "Carregando..."
                        : "Selecione o setor"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {formatSectorLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-secondary/10 p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold">Possui Função Formal?</Label>
                <p className="text-xs text-muted-foreground">
                  Ex: Coordenação, Gerência, Assessoria.
                </p>
              </div>
              <Switch
                checked={formData.possuiFuncaoFormal}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    possuiFuncaoFormal: checked,
                    funcaoFormalId: checked ? prev.funcaoFormalId : "",
                  }))
                }
              />
            </div>

            {formData.possuiFuncaoFormal && (
              <div className="animate-in slide-in-from-top-1 fade-in space-y-2 duration-300">
                <Label>Função Específica</Label>
                <Select
                  value={formData.funcaoFormalId}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, funcaoFormalId: v }))
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue
                      placeholder={
                        isLoadingFormalRoles
                          ? "Carregando..."
                          : "Selecione a função"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {formalRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>

          <div className="px-6 pb-6">
            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || !formData.unidadeId || !formData.setorId}
                className="h-11 w-full font-bold"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Contexto"
                )}
              </Button>

              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleSaveAndContinue}
                  disabled={isSaving || !formData.unidadeId || !formData.setorId}
                  className="rounded-2xl bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
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
          </div>
        </Card>

        <Card className="border-primary/5 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Histórico recente de contexto</CardTitle>
            <CardDescription>
              Mudanças anteriores de unidade, setor e função ficam registradas para acompanhar sua trajetória funcional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingContextHistory ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando histórico...
              </div>
            ) : contextHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda não há histórico de mudanças de contexto.
              </p>
            ) : (
              contextHistory.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border bg-secondary/10 p-4 text-sm"
                >
                  <div className="font-medium text-foreground">
                    {item.unidadeNome || "Unidade não informada"}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Setor: {item.setorNome || "Não informado"}
                  </div>
                  <div className="text-muted-foreground">
                    Função: {item.funcaoNome || "Sem função formal"}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Alterado em: {formatDateTime(item.changedAt)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-xs leading-relaxed text-amber-800">
            <strong>Aviso:</strong> Mudar seu setor, unidade ou função recalcula
            automaticamente seu perfil alvo. Sua <strong>Autoavaliação</strong>,
            diagnóstico e recomendações anteriores são invalidados para refletir
            o novo contexto vigente.
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}