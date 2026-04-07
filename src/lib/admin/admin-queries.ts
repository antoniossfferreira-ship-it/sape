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
   */
  const COLLECTIONS = {
    pilotParticipants: "pilotParticipants",
    userContexts: "userContexts",
    assessments: "assessments",
    gapDiagnostics: "gapDiagnostics",
    recommendations: "recommendations",
    recommendationFeedback: "recommendationFeedback",
    completedCourses: "completedCourses",
    researchEvents: "researchEvents",
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
   */
  export async function getParticipantContext(
    db: Firestore,
    userId: string
  ): Promise<UserContextSummary | null> {
    const ref = collection(db, COLLECTIONS.userContexts);
    const q = query(ref, where("userId", "==", userId), limit(1));
  
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
  
    const docSnap = snapshot.docs[0];
    return docSnap.data() as UserContextSummary;
  }
  
  /**
   * Busca avaliações do participante.
   */
  export async function getParticipantAssessments(
    db: Firestore,
    userId: string
  ): Promise<Record<string, unknown>[]> {
    const ref = collection(db, COLLECTIONS.assessments);
    const q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"));
  
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
    const q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"));
  
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
    const q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"));
  
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) =>
      withId<Record<string, unknown>>(docSnap.id, docSnap.data())
    );
  }
  
  /**
   * Busca feedbacks de recomendações do participante.
   */
  export async function getParticipantRecommendationFeedback(
    db: Firestore,
    userId: string
  ): Promise<Record<string, unknown>[]> {
    const ref = collection(db, COLLECTIONS.recommendationFeedback);
    const q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"));
  
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) =>
      withId<Record<string, unknown>>(docSnap.id, docSnap.data())
    );
  }
  
  /**
   * Busca cursos realizados do participante.
   */
  export async function getParticipantCourses(
    db: Firestore,
    userId: string
  ): Promise<Record<string, unknown>[]> {
    const ref = collection(db, COLLECTIONS.completedCourses);
    const q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"));
  
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) =>
      withId<Record<string, unknown>>(docSnap.id, docSnap.data())
    );
  }
  
  /**
   * Busca eventos de pesquisa do participante.
   */
  export async function getParticipantEvents(
    db: Firestore,
    userId: string
  ): Promise<ResearchEvent[]> {
    const ref = collection(db, COLLECTIONS.researchEvents);
    const q = query(ref, where("userId", "==", userId), orderBy("createdAt", "desc"));
  
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) =>
      withId<ResearchEvent>(docSnap.id, docSnap.data())
    );
  }
  
  /**
   * Busca participantes recentes para a Visão Geral.
   */
  export async function getRecentPilotParticipants(
    db: Firestore,
    count = 10
  ): Promise<PilotParticipant[]> {
    return getPilotParticipantsFiltered(db, { limitCount: count });
  }
  
  /**
   * Conta documentos de uma coleção inteira.
   * Simples e funcional para o protótipo.
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
   * Carrega os blocos principais da página de detalhe do participante em paralelo.
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