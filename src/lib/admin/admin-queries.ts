// src/lib/admin/admin-queries.ts

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  limit,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";

import type {
  PilotParticipant,
  ResearchEvent,
  UserContextSummary,
} from "@/types/admin";

/**
 * Helpers de coleções.
 * Ajustado para refletir os nomes existentes no Firestore
 * e também permitir leitura de dados em subcoleções reais dos usuários.
 */
const COLLECTIONS = {
  pilotParticipants: "pilotParticipants",
  userContexts: "userContextSummaries",
  assessments: "assessments",
  gapDiagnostics: "gaps",
  recommendations: "recommendations",
  recommendationFeedback: "feedbacks",
  completedCourses: "courses",
  researchEvents: "events",
};

/**
 * Converte snapshot data em objeto com id.
 */
function withId<T>(id: string, data: DocumentData): T {
  return {
    id,
    ...data,
  } as T;
}

/**
 * Busca todos os participantes consolidados.
 */
export async function getPilotParticipants(
  db: Firestore
): Promise<PilotParticipant[]> {
  const ref = collection(db, COLLECTIONS.pilotParticipants);
  const q = query(ref, orderBy("updatedAt", "desc"));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    userId: docSnap.id,
    ...(docSnap.data() as Omit<PilotParticipant, "userId">),
  }));
}

/**
 * Busca participantes com filtros simples.
 */
export interface GetPilotParticipantsFilters {
  unidadeId?: string;
  setorId?: string;
  funcaoId?: string;
  statusPiloto?: string;
  etapaAtual?: string;
  ativoNoPiloto?: boolean;
  limitCount?: number;
}

export async function getPilotParticipantsFiltered(
  db: Firestore,
  filters: GetPilotParticipantsFilters = {}
): Promise<PilotParticipant[]> {
  const constraints: QueryConstraint[] = [];

  if (filters.unidadeId) {
    constraints.push(where("unidadeId", "==", filters.unidadeId));
  }

  if (filters.setorId) {
    constraints.push(where("setorId", "==", filters.setorId));
  }

  if (filters.funcaoId) {
    constraints.push(where("funcaoId", "==", filters.funcaoId));
  }

  if (filters.statusPiloto) {
    constraints.push(where("statusPiloto", "==", filters.statusPiloto));
  }

  if (filters.etapaAtual) {
    constraints.push(where("etapaAtual", "==", filters.etapaAtual));
  }

  if (typeof filters.ativoNoPiloto === "boolean") {
    constraints.push(where("ativoNoPiloto", "==", filters.ativoNoPiloto));
  }

  constraints.push(orderBy("updatedAt", "desc"));

  if (filters.limitCount && filters.limitCount > 0) {
    constraints.push(limit(filters.limitCount));
  }

  const ref = collection(db, COLLECTIONS.pilotParticipants);
  const q = query(ref, ...constraints);

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    userId: docSnap.id,
    ...(docSnap.data() as Omit<PilotParticipant, "userId">),
  }));
}

/**
 * Busca participante por id/userId.
 */
export async function getPilotParticipantById(
  db: Firestore,
  id: string
): Promise<PilotParticipant | null> {
  const ref = doc(db, COLLECTIONS.pilotParticipants, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return {
    userId: snapshot.id,
    ...(snapshot.data() as Omit<PilotParticipant, "userId">),
  };
}

/**
 * Busca contexto do participante.
 * Primeiro tenta a coleção consolidada do piloto.
 * Se não encontrar, tenta a subcoleção real do usuário.
 */
export async function getParticipantContext(
  db: Firestore,
  userId: string
): Promise<UserContextSummary | null> {
  const ref = collection(db, COLLECTIONS.userContexts);
  const q = query(ref, where("userId", "==", userId), limit(1));

  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return docSnap.data() as UserContextSummary;
  }

  const userContextRef = collection(db, "users", userId, "context");
  const userContextSnapshot = await getDocs(userContextRef);

  if (userContextSnapshot.empty) return null;

  const latest = userContextSnapshot.docs
    .map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data(),
      dt:
        ("updatedAt" in docSnap.data() &&
          docSnap.data().updatedAt &&
          typeof docSnap.data().updatedAt.toDate === "function"
          ? docSnap.data().updatedAt.toDate()
          : "createdAt" in docSnap.data() &&
            docSnap.data().createdAt &&
            typeof docSnap.data().createdAt.toDate === "function"
          ? docSnap.data().createdAt.toDate()
          : new Date(0)),
    }))
    .sort((a, b) => b.dt.getTime() - a.dt.getTime())[0];

  return latest.data as UserContextSummary;
}

/**
 * Busca avaliações do participante.
 */
export async function getParticipantAssessments(
  db: Firestore,
  userId: string
): Promise<Record<string, unknown>[]> {
  const ref = collection(db, COLLECTIONS.assessments);
  const q = query(
    ref,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) =>
    withId<Record<string, unknown>>(docSnap.id, docSnap.data())
  );
}

/**
 * Busca lacunas do participante.
 */
export async function getParticipantGaps(
  db: Firestore,
  userId: string
): Promise<Record<string, unknown>[]> {
  const ref = collection(db, COLLECTIONS.gapDiagnostics);
  const q = query(
    ref,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) =>
    withId<Record<string, unknown>>(docSnap.id, docSnap.data())
  );
}

/**
 * Busca recomendações do participante.
 */
export async function getParticipantRecommendations(
  db: Firestore,
  userId: string
): Promise<Record<string, unknown>[]> {
  const ref = collection(db, COLLECTIONS.recommendations);
  const q = query(
    ref,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) =>
    withId<Record<string, unknown>>(docSnap.id, docSnap.data())
  );
}

/**
 * Busca feedbacks do participante.
 */
export async function getParticipantRecommendationFeedback(
  db: Firestore,
  userId: string
): Promise<Record<string, unknown>[]> {
  const ref = collection(db, COLLECTIONS.recommendationFeedback);
  const q = query(
    ref,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) =>
    withId<Record<string, unknown>>(docSnap.id, docSnap.data())
  );
}

/**
 * Busca cursos realizados do participante.
 * 1) Tenta a coleção global consolidada
 * 2) Se vazia, tenta a subcoleção real users/{userId}/completedCourses
 */
export async function getParticipantCourses(
  db: Firestore,
  userId: string
): Promise<Record<string, unknown>[]> {
  const globalRef = collection(db, COLLECTIONS.completedCourses);
  const globalQuery = query(
    globalRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const globalSnapshot = await getDocs(globalQuery);

  if (!globalSnapshot.empty) {
    return globalSnapshot.docs.map((docSnap) =>
      withId<Record<string, unknown>>(docSnap.id, docSnap.data())
    );
  }

  const subRef = collection(db, "users", userId, "completedCourses");
  const subSnapshot = await getDocs(subRef);

  if (subSnapshot.empty) return [];

  const normalized = subSnapshot.docs
    .map((docSnap) => {
      const data = docSnap.data();

      return withId<Record<string, unknown>>(docSnap.id, {
        userId,
        cursoNome:
          data.name ??
          data.courseName ??
          data.title ??
          "Curso registrado",
        modalidade:
          data.modality ??
          data.modalidade ??
          "Não informada",
        cargaHoraria:
          data.hours ??
          data.cargaHoraria ??
          0,
        dataConclusao:
          data.date ??
          data.completedAt ??
          data.updatedAt ??
          data.createdAt ??
          null,
        certificadoUrl:
          data.certificateUrl ??
          data.certificadoUrl ??
          "",
        recognizedBySystem:
          data.recognizedBySystem ?? false,
        linkedCompetencyId:
          data.linkedCompetencyId ?? "",
        linkedCompetencyName:
          data.linkedCompetencyName ?? "",
        sourceRecommendationId:
          data.sourceRecommendationId ?? "",
        sourceRecommendationTitle:
          data.sourceRecommendationTitle ?? "",
        createdAt:
          data.createdAt ??
          data.updatedAt ??
          null,
      });
    })
    .sort((a, b) => {
      const aValue = a.createdAt as
        | { toDate?: () => Date }
        | string
        | null
        | undefined;
      const bValue = b.createdAt as
        | { toDate?: () => Date }
        | string
        | null
        | undefined;

      const aDate =
        aValue && typeof aValue === "object" && "toDate" in aValue && typeof aValue.toDate === "function"
          ? aValue.toDate().getTime()
          : typeof aValue === "string"
          ? new Date(aValue).getTime()
          : 0;

      const bDate =
        bValue && typeof bValue === "object" && "toDate" in bValue && typeof bValue.toDate === "function"
          ? bValue.toDate().getTime()
          : typeof bValue === "string"
          ? new Date(bValue).getTime()
          : 0;

      return bDate - aDate;
    });

  return normalized;
}

/**
 * Busca eventos de pesquisa do participante.
 */
export async function getParticipantEvents(
  db: Firestore,
  userId: string
): Promise<ResearchEvent[]> {
  const ref = collection(db, COLLECTIONS.researchEvents);
  const q = query(
    ref,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) =>
    withId<ResearchEvent>(docSnap.id, docSnap.data())
  );
}

/**
 * Busca participantes recentes.
 */
export async function getRecentPilotParticipants(
  db: Firestore,
  count = 10
): Promise<PilotParticipant[]> {
  return getPilotParticipantsFiltered(db, { limitCount: count });
}

/**
 * Conta documentos de uma coleção.
 */
export async function countCollectionDocuments(
  db: Firestore,
  collectionName: string
): Promise<number> {
  const ref = collection(db, collectionName);
  const snapshot = await getDocs(ref);
  return snapshot.size;
}

/**
 * Bundle completo do participante.
 */
export async function getParticipantDetailBundle(
  db: Firestore,
  userId: string
): Promise<{
  participant: PilotParticipant | null;
  context: UserContextSummary | null;
  assessments: Record<string, unknown>[];
  gaps: Record<string, unknown>[];
  recommendations: Record<string, unknown>[];
  feedbacks: Record<string, unknown>[];
  courses: Record<string, unknown>[];
  events: ResearchEvent[];
}> {
  const [
    participant,
    context,
    assessments,
    gaps,
    recommendations,
    feedbacks,
    courses,
    events,
  ] = await Promise.all([
    getPilotParticipantById(db, userId),
    getParticipantContext(db, userId),
    getParticipantAssessments(db, userId),
    getParticipantGaps(db, userId),
    getParticipantRecommendations(db, userId),
    getParticipantRecommendationFeedback(db, userId),
    getParticipantCourses(db, userId),
    getParticipantEvents(db, userId),
  ]);

  return {
    participant,
    context,
    assessments,
    gaps,
    recommendations,
    feedbacks,
    courses,
    events,
  };
}