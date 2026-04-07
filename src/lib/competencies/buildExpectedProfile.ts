import {
  collection,
  getDocs,
  query,
  where,
  Firestore,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";

import { competencies } from "@/data/competencies";
import { orgSectors } from "@/data/orgSectors";
import { sectorCompetencies as localSectorCompetencies } from "@/data/sectorCompetencies";

type ExpectedProfileOrigin = "unit" | "sector" | "role" | "transversal" | "general";

type CompetencyLink = {
  competencyId: string;
  expectedLevel: number;
  origin: ExpectedProfileOrigin;
};

type EnrichedExpectedProfileItem = {
  competencyId: string;
  competencyName: string;
  competencyAxis: string;
  expectedLevel: number;
  origins: ExpectedProfileOrigin[];
};

type CompetencyCatalogItem = {
  competencyId: string;
  competencyName: string;
  competencyAxis: string | null;
};

type SmartFallbackResolution = {
  merged: Array<{
    competencyId: string;
    expectedLevel: number;
    origins: ExpectedProfileOrigin[];
  }>;
  fallbackStrategy:
    | "sector_priority"
    | "role_plus_transversal"
    | "transversal_only_no_role"
    | "transversal_last_resort"
    | "empty_no_fallback";
};

const collectionDocsCache = new Map<string, QueryDocumentSnapshot<DocumentData>[]>();
let competencyCatalogCache: Map<string, CompetencyCatalogItem> | null = null;

const MAX_EXPECTED_PROFILE_ITEMS = 8;

function logJson(label: string, payload?: unknown) {
  try {
    if (payload === undefined) {
      console.log(label);
      return;
    }

    console.log(`${label}\n${JSON.stringify(payload, null, 2)}`);
  } catch {
    console.log(label, payload);
  }
}

function preserveIdString(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (typeof obj.id === "string") return obj.id.trim();

    if (typeof obj.path === "string") {
      const parts = obj.path.split("/");
      return String(parts[parts.length - 1] || "").trim();
    }

    if (typeof obj.value === "string") return obj.value.trim();
  }

  return "";
}

function normalizeLookupString(value: unknown): string {
  const raw = preserveIdString(value);
  if (!raw) return "";

  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompactString(value: unknown): string {
  const raw = preserveIdString(value);
  if (!raw) return "";

  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickFirst(data: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) {
      return data[key];
    }
  }
  return undefined;
}

function normalizeLinkFromData(
  data: Record<string, unknown>,
  fallbackId: string,
  origin: ExpectedProfileOrigin,
  defaultExpectedLevel = 3
): CompetencyLink | null {
  const competencyRaw = pickFirst(data, [
    "competencyId",
    "competenciaId",
    "competency",
    "competencia",
    "competencyRef",
    "competenciaRef",
    "id",
  ]);

  const expectedLevelRaw = pickFirst(data, [
    "expectedLevel",
    "nivelEsperado",
    "level",
    "nivel",
    "requiredLevel",
    "nivelRequerido",
  ]);

  const competencyId = preserveIdString(competencyRaw) || preserveIdString(fallbackId);
  const expectedLevel = normalizeNumber(expectedLevelRaw, defaultExpectedLevel);

  if (!competencyId) return null;
  if (expectedLevel <= 0) return null;

  return {
    competencyId,
    expectedLevel,
    origin,
  };
}

function fieldMatchesValue(raw: unknown, expectedValue: string): boolean {
  const a = normalizeLookupString(raw);
  const b = normalizeLookupString(expectedValue);

  if (!a || !b) return false;
  if (a === b) return true;

  const ac = normalizeCompactString(raw);
  const bc = normalizeCompactString(expectedValue);

  if (!ac || !bc) return false;
  if (ac === bc) return true;

  return ac.includes(bc) || bc.includes(ac);
}

function docMatchesAnyField(
  doc: QueryDocumentSnapshot<DocumentData>,
  fieldNames: string[],
  expectedValues: string[]
): boolean {
  const data = doc.data() as Record<string, unknown>;

  for (const fieldName of fieldNames) {
    for (const expectedValue of expectedValues) {
      if (fieldMatchesValue(data[fieldName], expectedValue)) {
        return true;
      }
    }
  }

  return false;
}

async function getCollectionDocsCached(
  db: Firestore,
  collectionName: string
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  if (collectionDocsCache.has(collectionName)) {
    return collectionDocsCache.get(collectionName) || [];
  }

  try {
    logJson("[buildExpectedProfile] lendo coleção", {
      collectionName,
    });

    const snap = await getDocs(collection(db, collectionName));

    logJson("[buildExpectedProfile] coleção carregada com sucesso", {
      collectionName,
      size: snap.size,
      empty: snap.empty,
      docIdsPreview: snap.docs.slice(0, 10).map((doc) => doc.id),
    });

    collectionDocsCache.set(collectionName, snap.docs);
    return snap.docs;
  } catch (error: any) {
    logJson("[buildExpectedProfile] erro ao ler coleção", {
      collectionName,
      code: error?.code,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      fullError: error,
    });

    throw error;
  }
}

async function tryDirectQuery(params: {
  db: Firestore;
  collectionName: string;
  fieldName: string;
  fieldValue: string;
  origin: ExpectedProfileOrigin;
  defaultExpectedLevel?: number;
}): Promise<CompetencyLink[]> {
  const {
    db,
    collectionName,
    fieldName,
    fieldValue,
    origin,
    defaultExpectedLevel = 3,
  } = params;

  if (!fieldValue) return [];

  try {
    logJson("[buildExpectedProfile] query direta iniciada", {
      collectionName,
      fieldName,
      fieldValue,
      origin,
    });

    const snap = await getDocs(
      query(collection(db, collectionName), where(fieldName, "==", fieldValue))
    );

    logJson("[buildExpectedProfile] query direta concluída", {
      collectionName,
      fieldName,
      fieldValue,
      size: snap.size,
      empty: snap.empty,
      docIds: snap.docs.map((doc) => doc.id),
    });

    return snap.docs
      .map((docSnap) =>
        normalizeLinkFromData(
          docSnap.data() as Record<string, unknown>,
          docSnap.id,
          origin,
          defaultExpectedLevel
        )
      )
      .filter(Boolean) as CompetencyLink[];
  } catch (error: any) {
    logJson("[buildExpectedProfile] erro na query direta", {
      collectionName,
      fieldName,
      fieldValue,
      origin,
      code: error?.code,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      fullError: error,
    });

    throw error;
  }
}

function dedupeLinks(links: CompetencyLink[]): CompetencyLink[] {
  const map = new Map<string, CompetencyLink>();

  for (const item of links) {
    const competencyId = preserveIdString(item.competencyId);
    if (!competencyId) continue;

    const current = map.get(competencyId);
    if (!current) {
      map.set(competencyId, {
        competencyId,
        expectedLevel: Number(item.expectedLevel) || 0,
        origin: item.origin,
      });
      continue;
    }

    current.expectedLevel = Math.max(
      Number(current.expectedLevel) || 0,
      Number(item.expectedLevel) || 0
    );
  }

  return Array.from(map.values());
}

function mergeCompetencySources(
  groups: CompetencyLink[][]
): Array<{
  competencyId: string;
  expectedLevel: number;
  origins: ExpectedProfileOrigin[];
}> {
  const map = new Map<
    string,
    {
      competencyId: string;
      expectedLevel: number;
      origins: Set<ExpectedProfileOrigin>;
    }
  >();

  for (const group of groups) {
    for (const item of group) {
      const competencyId = preserveIdString(item.competencyId);
      if (!competencyId) continue;

      const existing = map.get(competencyId);

      if (!existing) {
        map.set(competencyId, {
          competencyId,
          expectedLevel: Number(item.expectedLevel) || 0,
          origins: new Set<ExpectedProfileOrigin>([item.origin]),
        });
        continue;
      }

      existing.expectedLevel = Math.max(
        Number(existing.expectedLevel) || 0,
        Number(item.expectedLevel) || 0
      );
      existing.origins.add(item.origin);
    }
  }

  return Array.from(map.values()).map((item) => ({
    competencyId: item.competencyId,
    expectedLevel: item.expectedLevel,
    origins: Array.from(item.origins),
  }));
}

function limitMergedItems(
  items: Array<{
    competencyId: string;
    expectedLevel: number;
    origins: ExpectedProfileOrigin[];
  }>,
  maxItems = MAX_EXPECTED_PROFILE_ITEMS
) {
  return items
    .slice()
    .sort((a, b) => {
      const byLevel = (b.expectedLevel || 0) - (a.expectedLevel || 0);
      if (byLevel !== 0) return byLevel;
      return a.competencyId.localeCompare(b.competencyId);
    })
    .slice(0, maxItems);
}

function mergeAndLimitCompetencySources(
  groups: CompetencyLink[][],
  maxItems = MAX_EXPECTED_PROFILE_ITEMS
) {
  const merged = mergeCompetencySources(groups);
  return limitMergedItems(merged, maxItems);
}

function appendUniqueLinks(
  base: CompetencyLink[],
  additions: CompetencyLink[],
  maxItems = MAX_EXPECTED_PROFILE_ITEMS
): CompetencyLink[] {
  const result = [...base];
  const existingIds = new Set(result.map((item) => preserveIdString(item.competencyId)));

  for (const item of additions) {
    const competencyId = preserveIdString(item.competencyId);
    if (!competencyId) continue;
    if (existingIds.has(competencyId)) continue;

    result.push(item);
    existingIds.add(competencyId);

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

async function getUnitCompetencies(
  db: Firestore,
  unitId?: string | null
): Promise<CompetencyLink[]> {
  const directUnitId = preserveIdString(unitId);

  if (!directUnitId) {
    console.warn("[buildExpectedProfile] unitId ausente na busca de competências da unidade");
    return [];
  }

  logJson("[buildExpectedProfile] buscando competências da unidade", {
    unitId: directUnitId,
  });

  const collectionNames = ["unitCompetencies", "unidade_competencias"];
  let directMatches: CompetencyLink[] = [];

  for (const collectionName of collectionNames) {
    for (const fieldName of ["unitId", "unidadeId"]) {
      const items = await tryDirectQuery({
        db,
        collectionName,
        fieldName,
        fieldValue: directUnitId,
        origin: "unit",
        defaultExpectedLevel: 3,
      });

      if (items.length) {
        directMatches = [...directMatches, ...items];
      }
    }
  }

  if (directMatches.length) {
    const deduped = dedupeLinks(directMatches);
    logJson("[buildExpectedProfile] usando competências do Firestore", {
      source: "unit",
      unitId: directUnitId,
      total: deduped.length,
      competencyIds: deduped.map((item) => item.competencyId),
    });
    return deduped;
  }

  const candidateValues = Array.from(
    new Set(
      [
        directUnitId,
        normalizeLookupString(directUnitId),
        normalizeCompactString(directUnitId),
      ].filter(Boolean)
    )
  );

  for (const collectionName of collectionNames) {
    const docs = await getCollectionDocsCached(db, collectionName);
    if (!docs.length) continue;

    const scanned = docs
      .filter((docSnap) =>
        docMatchesAnyField(
          docSnap,
          [
            "unitId",
            "unidadeId",
            "unit",
            "unidade",
            "unitRef",
            "unidadeRef",
          ],
          candidateValues
        )
      )
      .map((docSnap) =>
        normalizeLinkFromData(
          docSnap.data() as Record<string, unknown>,
          docSnap.id,
          "unit",
          3
        )
      )
      .filter(Boolean) as CompetencyLink[];

    if (scanned.length) {
      const deduped = dedupeLinks(scanned);
      logJson("[buildExpectedProfile] usando competências do Firestore (scan)", {
        source: "unit",
        unitId: directUnitId,
        collectionName,
        total: deduped.length,
        competencyIds: deduped.map((item) => item.competencyId),
      });
      return deduped;
    }
  }

  logJson("[buildExpectedProfile] nenhuma competência encontrada para a unidade", {
    unitId: directUnitId,
  });

  return [];
}

function getLocalSectorCompetencies(
  sectorId: string,
  matrixSectorId?: string | null
): CompetencyLink[] {
  const directSectorId = preserveIdString(sectorId);
  const directMatrixId = preserveIdString(matrixSectorId);

  const resolvedMatrixSectorId =
    orgSectors.find((sector) => sector.id === directSectorId)?.matrixSectorId ||
    directMatrixId ||
    "";

  if (!resolvedMatrixSectorId) return [];

  return localSectorCompetencies
    .filter(
      (item) =>
        item.active &&
        preserveIdString(item.matrixSectorId) === resolvedMatrixSectorId
    )
    .map((item) => ({
      competencyId: item.competencyId,
      expectedLevel: Number(item.expectedLevel) || 0,
      origin: "sector" as const,
    }))
    .filter((item) => item.expectedLevel > 0);
}

async function getSectorCompetencies(
  db: Firestore,
  sectorId: string,
  matrixSectorId?: string | null
): Promise<CompetencyLink[]> {
  const directSectorId = preserveIdString(sectorId);

  if (!directSectorId) {
    console.warn("[buildExpectedProfile] sectorId ausente na busca de competências do setor");
    return [];
  }

  const collectionNames = ["sectorCompetencies", "setor_competencias"];
  let directMatches: CompetencyLink[] = [];

  for (const collectionName of collectionNames) {
    for (const fieldName of ["sectorId", "setorId"]) {
      const items = await tryDirectQuery({
        db,
        collectionName,
        fieldName,
        fieldValue: directSectorId,
        origin: "sector",
        defaultExpectedLevel: 3,
      });

      if (items.length) {
        directMatches = [...directMatches, ...items];
      }
    }
  }

  if (directMatches.length) {
    const deduped = dedupeLinks(directMatches);
    logJson("[buildExpectedProfile] usando competências do Firestore", {
      source: "sector",
      sectorId: directSectorId,
      matrixSectorId: matrixSectorId || null,
      total: deduped.length,
      competencyIds: deduped.map((item) => item.competencyId),
    });
    return deduped;
  }

  const candidateValues = Array.from(
    new Set(
      [
        directSectorId,
        normalizeLookupString(directSectorId),
        normalizeCompactString(directSectorId),
      ].filter(Boolean)
    )
  );

  for (const collectionName of collectionNames) {
    const docs = await getCollectionDocsCached(db, collectionName);
    if (!docs.length) continue;

    const scanned = docs
      .filter((docSnap) =>
        docMatchesAnyField(
          docSnap,
          [
            "sectorId",
            "setorId",
            "sector",
            "setor",
            "sectorRef",
            "setorRef",
            "orgSectorId",
            "orgSectorsId",
          ],
          candidateValues
        )
      )
      .map((docSnap) =>
        normalizeLinkFromData(
          docSnap.data() as Record<string, unknown>,
          docSnap.id,
          "sector",
          3
        )
      )
      .filter(Boolean) as CompetencyLink[];

    if (scanned.length) {
      const deduped = dedupeLinks(scanned);
      logJson("[buildExpectedProfile] usando competências do Firestore (scan)", {
        source: "sector",
        sectorId: directSectorId,
        matrixSectorId: matrixSectorId || null,
        collectionName,
        total: deduped.length,
        competencyIds: deduped.map((item) => item.competencyId),
      });
      return deduped;
    }
  }

  const localItems = getLocalSectorCompetencies(directSectorId, matrixSectorId);

  if (localItems.length) {
    logJson("[buildExpectedProfile] fallback para competências locais do setor", {
      source: "sector",
      sectorId: directSectorId,
      matrixSectorId: matrixSectorId || null,
      total: localItems.length,
      competencyIds: localItems.map((item) => item.competencyId),
    });
    return localItems;
  }

  logJson("[buildExpectedProfile] nenhuma competência encontrada para o setor", {
    sectorId: directSectorId,
    matrixSectorId: matrixSectorId || null,
  });

  return [];
}

async function getRoleCompetencies(
  db: Firestore,
  roleId?: string | null
): Promise<CompetencyLink[]> {
  const directRoleId = preserveIdString(roleId);

  if (!directRoleId) {
    console.warn("[buildExpectedProfile] roleId ausente na busca de competências da função");
    return [];
  }

  logJson("[buildExpectedProfile] buscando competências da função", {
    roleId: directRoleId,
  });

  const collectionNames = ["roleCompetencies", "funcao_competencias"];
  let directMatches: CompetencyLink[] = [];

  for (const collectionName of collectionNames) {
    for (const fieldName of ["formalRoleId", "roleId", "funcaoId", "functionId"]) {
      const items = await tryDirectQuery({
        db,
        collectionName,
        fieldName,
        fieldValue: directRoleId,
        origin: "role",
        defaultExpectedLevel: 2,
      });

      if (items.length) {
        directMatches = [...directMatches, ...items];
      }
    }
  }

  if (directMatches.length) {
    const deduped = dedupeLinks(directMatches);
    logJson("[buildExpectedProfile] usando competências do Firestore", {
      source: "role",
      roleId: directRoleId,
      total: deduped.length,
      competencyIds: deduped.map((item) => item.competencyId),
    });
    return deduped;
  }

  const candidateValues = Array.from(
    new Set(
      [
        directRoleId,
        normalizeLookupString(directRoleId),
        normalizeCompactString(directRoleId),
      ].filter(Boolean)
    )
  );

  for (const collectionName of collectionNames) {
    const docs = await getCollectionDocsCached(db, collectionName);
    if (!docs.length) continue;

    const scanned = docs
      .filter((docSnap) =>
        docMatchesAnyField(
          docSnap,
          [
            "formalRoleId",
            "roleId",
            "funcaoId",
            "functionId",
            "role",
            "funcao",
            "roleRef",
            "funcaoRef",
          ],
          candidateValues
        )
      )
      .map((docSnap) =>
        normalizeLinkFromData(
          docSnap.data() as Record<string, unknown>,
          docSnap.id,
          "role",
          2
        )
      )
      .filter(Boolean) as CompetencyLink[];

    if (scanned.length) {
      const deduped = dedupeLinks(scanned);
      logJson("[buildExpectedProfile] usando competências do Firestore (scan)", {
        source: "role",
        roleId: directRoleId,
        collectionName,
        total: deduped.length,
        competencyIds: deduped.map((item) => item.competencyId),
      });
      return deduped;
    }
  }

  logJson("[buildExpectedProfile] nenhuma competência encontrada para a função", {
    roleId: directRoleId,
  });

  return [];
}

async function getTransversalCompetencies(db: Firestore): Promise<CompetencyLink[]> {
  const docs = await getCollectionDocsCached(db, "competencias_transversais");

  const items = docs
    .map((docSnap) =>
      normalizeLinkFromData(
        docSnap.data() as Record<string, unknown>,
        docSnap.id,
        "transversal",
        3
      )
    )
    .filter(Boolean) as CompetencyLink[];

  return dedupeLinks(items);
}

function deriveLegacyAxisFromCompetencyId(competencyId: string): string | null {
  const upper = preserveIdString(competencyId).toUpperCase();

  if (upper.startsWith("E1")) return "E1";
  if (upper.startsWith("E2")) return "E2";
  if (upper.startsWith("E3")) return "E3";
  if (upper.startsWith("E4")) return "E4";
  if (upper.startsWith("E5")) return "E5";

  return null;
}

function titleFromId(id: string): string {
  return preserveIdString(id)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapAxisToEixo(axis: string | null): string | null {
  if (!axis) return null;

  const normalized = axis
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "e1") return "E1";
  if (normalized === "e2") return "E2";
  if (normalized === "e3") return "E3";
  if (normalized === "e4") return "E4";
  if (normalized === "e5") return "E5";

  if (normalized.includes("fundamentos institucionais")) return "E3";
  if (normalized.includes("relacoes interpessoais")) return "E2";

  if (normalized.includes("comunica")) return "E1";
  if (normalized.includes("interpessoal")) return "E2";
  if (normalized.includes("equipe")) return "E2";
  if (normalized.includes("etica")) return "E3";
  if (normalized.includes("respons")) return "E3";
  if (normalized.includes("inov")) return "E4";
  if (normalized.includes("melhoria de processos")) return "E4";
  if (normalized.includes("process")) return "E4";
  if (normalized.includes("planej")) return "E5";
  if (normalized.includes("gest")) return "E5";
  if (normalized.includes("tecnologia e informacao")) return "E4";
  if (normalized.includes("tecnologia da informacao")) return "E4";

  return null;
}

async function loadCompetencyCatalog(
  db: Firestore
): Promise<Map<string, CompetencyCatalogItem>> {
  if (competencyCatalogCache) {
    return competencyCatalogCache;
  }

  const map = new Map<string, CompetencyCatalogItem>();

  for (const item of competencies) {
    map.set(item.id, {
      competencyId: item.id,
      competencyName: item.name,
      competencyAxis: item.axis || null,
    });
  }

  const docs = await getCollectionDocsCached(db, "competencias");

  docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;

    const competencyId =
      preserveIdString(data?.id) ||
      preserveIdString(data?.competencyId) ||
      preserveIdString(data?.competenciaId) ||
      preserveIdString(data?.codigo) ||
      preserveIdString(docSnap.id);

    if (!competencyId) return;

    const competencyName =
      preserveIdString(data?.name) ||
      preserveIdString(data?.nome) ||
      preserveIdString(data?.title) ||
      map.get(competencyId)?.competencyName ||
      titleFromId(competencyId);

    const competencyAxis =
      preserveIdString(data?.axis) ||
      preserveIdString(data?.eixo) ||
      map.get(competencyId)?.competencyAxis ||
      deriveLegacyAxisFromCompetencyId(competencyId) ||
      null;

    map.set(competencyId, {
      competencyId,
      competencyName,
      competencyAxis,
    });
  });

  competencyCatalogCache = map;
  return map;
}

function resolveMergedCompetenciesWithSmartFallback(params: {
  hasEffectiveRole: boolean;
  unitItems: CompetencyLink[];
  sectorItems: CompetencyLink[];
  roleItems: CompetencyLink[];
  transversalItems: CompetencyLink[];
}): SmartFallbackResolution {
  const { hasEffectiveRole, unitItems, sectorItems, roleItems, transversalItems } = params;

  // Prioridade 1: setor como base principal.
  // Se houver setor, usa setor; complementa com função só se ainda houver espaço.
  if (sectorItems.length > 0) {
    const prioritizedSector = sectorItems
      .slice()
      .sort((a, b) => {
        const byLevel = (b.expectedLevel || 0) - (a.expectedLevel || 0);
        if (byLevel !== 0) return byLevel;
        return a.competencyId.localeCompare(b.competencyId);
      })
      .slice(0, MAX_EXPECTED_PROFILE_ITEMS);

    const completed = appendUniqueLinks(
      prioritizedSector,
      roleItems
        .slice()
        .sort((a, b) => {
          const byLevel = (b.expectedLevel || 0) - (a.expectedLevel || 0);
          if (byLevel !== 0) return byLevel;
          return a.competencyId.localeCompare(b.competencyId);
        }),
      MAX_EXPECTED_PROFILE_ITEMS
    );

    return {
      merged: mergeAndLimitCompetencySources([completed], MAX_EXPECTED_PROFILE_ITEMS),
      fallbackStrategy: "sector_priority",
    };
  }

  // Prioridade 2: sem setor, mas com função -> função + transversais
  if (hasEffectiveRole && (roleItems.length > 0 || transversalItems.length > 0)) {
    return {
      merged: mergeAndLimitCompetencySources(
        [roleItems, transversalItems],
        MAX_EXPECTED_PROFILE_ITEMS
      ),
      fallbackStrategy: "role_plus_transversal",
    };
  }

  // Prioridade 3: sem função -> apenas transversais
  if (!hasEffectiveRole && transversalItems.length > 0) {
    return {
      merged: mergeAndLimitCompetencySources([transversalItems], MAX_EXPECTED_PROFILE_ITEMS),
      fallbackStrategy: "transversal_only_no_role",
    };
  }

  // Último recurso: se sobrou alguma transversal, usa ela
  if (transversalItems.length > 0) {
    return {
      merged: mergeAndLimitCompetencySources([transversalItems], MAX_EXPECTED_PROFILE_ITEMS),
      fallbackStrategy: "transversal_last_resort",
    };
  }

  // Se não houver setor, mas houver apenas função sem transversais
  if (roleItems.length > 0) {
    return {
      merged: mergeAndLimitCompetencySources([roleItems], MAX_EXPECTED_PROFILE_ITEMS),
      fallbackStrategy: "role_plus_transversal",
    };
  }

  // Unidade isolada pode ser usada só se não houver setor/função/transversal
  if (unitItems.length > 0) {
    return {
      merged: mergeAndLimitCompetencySources([unitItems], MAX_EXPECTED_PROFILE_ITEMS),
      fallbackStrategy: "sector_priority",
    };
  }

  return {
    merged: [],
    fallbackStrategy: "empty_no_fallback",
  };
}

function enrichCombinedItems(
  items: Array<{
    competencyId: string;
    expectedLevel: number;
    origins: ExpectedProfileOrigin[];
  }>,
  competencyCatalog: Map<string, CompetencyCatalogItem>
): EnrichedExpectedProfileItem[] {
  return items
    .map((item) => {
      const competencyId = preserveIdString(item.competencyId);
      const fromCatalog = competencyCatalog.get(competencyId);

      const rawAxis =
        fromCatalog?.competencyAxis ||
        deriveLegacyAxisFromCompetencyId(competencyId);

      let competencyAxis = mapAxisToEixo(rawAxis);

      if (!competencyAxis) {
        logJson("⚠️ eixo não mapeado - assumindo E4", {
          competencyId,
          rawAxis,
        });

        competencyAxis = "E4";
      }

      return {
        competencyId,
        competencyName:
          fromCatalog?.competencyName || titleFromId(competencyId),
        competencyAxis,
        expectedLevel: Number(item.expectedLevel) || 0,
        origins: item.origins || [],
      };
    })
    .filter(
      (item): item is EnrichedExpectedProfileItem =>
        !!item && !!item.competencyId && item.expectedLevel > 0
    );
}

function buildSourceDiagnostics(groups: {
  unitItems: CompetencyLink[];
  sectorItems: CompetencyLink[];
  roleItems: CompetencyLink[];
  transversalItems: CompetencyLink[];
}) {
  return {
    unitItems: groups.unitItems.length,
    sectorItems: groups.sectorItems.length,
    roleItems: groups.roleItems.length,
    transversalItems: groups.transversalItems.length,
  };
}

export async function buildExpectedProfile(params: {
  db: Firestore;
  unitId?: string | null;
  sectorId: string;
  matrixSectorId?: string | null;
  formalRoleId?: string | null;
  roleId?: string | null;
  jobId?: string | null;
  educationAreaId?: string | null;
  educationLevel?: string | null;
}) {
  const {
    db,
    unitId,
    sectorId,
    matrixSectorId,
    formalRoleId,
    roleId,
    educationLevel,
  } = params;

  const effectiveUnitId = preserveIdString(unitId);
  const effectiveSectorId = preserveIdString(sectorId);
  const effectiveRoleId =
    preserveIdString(formalRoleId) || preserveIdString(roleId);

  if (!effectiveSectorId) {
    console.warn("buildExpectedProfile: sectorId ausente");
    return [];
  }

  try {
    logJson("🚀 buildExpectedProfile:start", {
      unitId: effectiveUnitId || null,
      sectorId: effectiveSectorId,
      matrixSectorId: matrixSectorId || null,
      formalRoleId: preserveIdString(formalRoleId) || null,
      roleId: preserveIdString(roleId) || null,
      effectiveRoleId: effectiveRoleId || null,
      educationLevel: educationLevel || null,
      strategy:
        "prioridade setor -> funcao -> transversais, com limite maximo de 8",
    });

    const [unitItems, sectorItems, roleItems, transversalItems] = await Promise.all([
      getUnitCompetencies(db, effectiveUnitId),
      getSectorCompetencies(db, effectiveSectorId, matrixSectorId),
      getRoleCompetencies(db, effectiveRoleId),
      getTransversalCompetencies(db),
    ]);

    const resolution = resolveMergedCompetenciesWithSmartFallback({
      hasEffectiveRole: !!effectiveRoleId,
      unitItems,
      sectorItems,
      roleItems,
      transversalItems,
    });

    const merged = resolution.merged;

    const sourceDiagnostics = buildSourceDiagnostics({
      unitItems,
      sectorItems,
      roleItems,
      transversalItems,
    });

    if (!merged.length) {
      logJson("[buildExpectedProfile] nenhum resultado após priorização.", {
        ...sourceDiagnostics,
        fallbackStrategy: resolution.fallbackStrategy,
        effectiveRoleId: effectiveRoleId || null,
      });
    }

    const competencyCatalog = await loadCompetencyCatalog(db);
    const enriched = enrichCombinedItems(merged, competencyCatalog);

    logJson("✅ buildExpectedProfile:final", {
      ...sourceDiagnostics,
      merged: merged.length,
      enriched: enriched.length,
      fallbackStrategy: resolution.fallbackStrategy,
      maxItemsApplied: MAX_EXPECTED_PROFILE_ITEMS,
      unitCompetencyIds: unitItems.map((item) => item.competencyId),
      sectorCompetencyIds: sectorItems.map((item) => item.competencyId),
      roleCompetencyIds: roleItems.map((item) => item.competencyId),
      transversalCompetencyIds: transversalItems.map((item) => item.competencyId),
      finalCompetencyIds: enriched.map((item) => item.competencyId),
      educationLevelAppliedAsMetadataOnly: !!educationLevel,
    });

    return enriched;
  } catch (error: any) {
    logJson("buildExpectedProfile failed", {
      code: error?.code,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      fullError: error,
    });

    return [];
  }
}