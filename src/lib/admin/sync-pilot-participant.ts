// src/lib/admin/sync-pilot-participant.ts

import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    Timestamp,
    type Firestore,
  } from "firebase/firestore";
  
  import type {
    PilotParticipant,
    PilotParticipantSyncInput,
  } from "@/types/admin";
  import { getPilotProgress } from "@/lib/admin/pilot-status";
  
  /**
   * Caminho da coleção consolidada da área admin.
   */
  const COLLECTION_NAME = "pilotParticipants";
  
  /**
   * Normaliza string para evitar undefined no documento final.
   */
  function safeString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
  }
  
  /**
   * Normaliza número.
   */
  function safeNumber(value: unknown, fallback = 0): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  
  /**
   * Mescla documento anterior com os novos dados parciais
   * e garante preenchimento dos campos esperados.
   */
  function buildPilotParticipantDocument(
    existing: Partial<PilotParticipant> | undefined,
    input: PilotParticipantSyncInput
  ): Omit<PilotParticipant, "createdAt" | "updatedAt"> & {
    createdAt?: Timestamp | null;
    updatedAt?: Timestamp | null;
  } {
    const mergedFlags = {
      contextoPreenchido:
        input.contextoPreenchido ?? existing?.contextoPreenchido ?? false,
      autoavaliacaoConcluida:
        input.autoavaliacaoConcluida ?? existing?.autoavaliacaoConcluida ?? false,
      diagnosticoGerado:
        input.diagnosticoGerado ?? existing?.diagnosticoGerado ?? false,
      recomendacaoRecebida:
        input.recomendacaoRecebida ?? existing?.recomendacaoRecebida ?? false,
      feedbackRegistrado:
        input.feedbackRegistrado ?? existing?.feedbackRegistrado ?? false,
      cursoRegistrado:
        input.cursoRegistrado ?? existing?.cursoRegistrado ?? false,
      ativoNoPiloto: input.ativoNoPiloto ?? existing?.ativoNoPiloto ?? true,
    };
  
    const progress = getPilotProgress(mergedFlags);
  
    /**
     * Se um curso foi registrado, além de concluir o piloto,
     * preservamos a informação de status operacional original
     * no campo cursoRegistrado = true.
     *
     * O status final calculado continua vindo de getPilotProgress.
     */
  
    return {
      userId: input.userId,
  
      nome: safeString(input.nome ?? existing?.nome),
      matricula: safeString(input.matricula ?? existing?.matricula),
      email: safeString(input.email ?? existing?.email),
  
      unidadeId: safeString(input.unidadeId ?? existing?.unidadeId),
      unidadeNome: safeString(input.unidadeNome ?? existing?.unidadeNome),
  
      setorId: safeString(input.setorId ?? existing?.setorId),
      setorNome: safeString(input.setorNome ?? existing?.setorNome),
  
      funcaoId: safeString(input.funcaoId ?? existing?.funcaoId),
      funcaoNome: safeString(input.funcaoNome ?? existing?.funcaoNome),
  
      statusPiloto: progress.statusPiloto,
      etapaAtual: progress.etapaAtual,
      percentualConclusao: progress.percentualConclusao,
  
      contextoPreenchido: mergedFlags.contextoPreenchido,
      autoavaliacaoConcluida: mergedFlags.autoavaliacaoConcluida,
      diagnosticoGerado: mergedFlags.diagnosticoGerado,
      recomendacaoRecebida: mergedFlags.recomendacaoRecebida,
      feedbackRegistrado: mergedFlags.feedbackRegistrado,
      cursoRegistrado: mergedFlags.cursoRegistrado,
      ativoNoPiloto: mergedFlags.ativoNoPiloto,
  
      totalCompetenciasAvaliadas: safeNumber(
        input.totalCompetenciasAvaliadas ?? existing?.totalCompetenciasAvaliadas
      ),
      totalLacunas: safeNumber(input.totalLacunas ?? existing?.totalLacunas),
      totalRecomendacoes: safeNumber(
        input.totalRecomendacoes ?? existing?.totalRecomendacoes
      ),
      totalCursosRealizados: safeNumber(
        input.totalCursosRealizados ?? existing?.totalCursosRealizados
      ),
  
      primeiroAcessoEm:
        input.primeiroAcessoEm ??
        existing?.primeiroAcessoEm ??
        null,
  
      ultimoAcessoEm:
        input.ultimoAcessoEm ??
        existing?.ultimoAcessoEm ??
        null,
  
      observacoesPesquisa: safeString(
        input.observacoesPesquisa ?? existing?.observacoesPesquisa
      ),
  
      createdAt: existing?.createdAt ?? null,
      updatedAt: existing?.updatedAt ?? null,
    };
  }
  
  /**
   * Faz upsert direto do participante consolidado.
   *
   * Use esta função após ações importantes do sistema, como:
   * - salvar contexto
   * - concluir autoavaliação
   * - gerar diagnóstico
   * - exibir recomendações
   * - registrar curso
   */
  export async function upsertPilotParticipant(
    db: Firestore,
    input: PilotParticipantSyncInput
  ): Promise<void> {
    if (!db) {
      throw new Error("Firestore não informado em upsertPilotParticipant.");
    }
  
    if (!input?.userId) {
      throw new Error("userId é obrigatório para sincronizar pilotParticipants.");
    }
  
    const ref = doc(db, COLLECTION_NAME, input.userId);
    const snapshot = await getDoc(ref);
  
    const existing = snapshot.exists()
      ? (snapshot.data() as Partial<PilotParticipant>)
      : undefined;
  
    const documentData = buildPilotParticipantDocument(existing, input);
  
    await setDoc(
      ref,
      {
        ...documentData,
        createdAt: existing?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
  
  /**
   * Marca o participante como ativo e atualiza a última atividade.
   * Útil para login ou primeiro acesso à área autenticada do protótipo.
   */
  export async function touchPilotParticipantActivity(
    db: Firestore,
    userId: string,
    extras?: Partial<PilotParticipantSyncInput>
  ): Promise<void> {
    if (!userId) {
      throw new Error("userId é obrigatório em touchPilotParticipantActivity.");
    }
  
    await upsertPilotParticipant(db, {
      userId,
      ativoNoPiloto: true,
      ultimoAcessoEm: Timestamp.now(),
      ...(extras ?? {}),
    });
  }
  
  /**
   * Helpers específicos por etapa para facilitar o uso no sistema.
   * Você pode chamar estes métodos diretamente nas páginas/ações.
   */
  
  export async function syncPilotAfterContext(
    db: Firestore,
    input: PilotParticipantSyncInput
  ): Promise<void> {
    await upsertPilotParticipant(db, {
      ...input,
      contextoPreenchido: true,
      ultimoAcessoEm: Timestamp.now(),
    });
  }
  
  export async function syncPilotAfterAssessment(
    db: Firestore,
    input: PilotParticipantSyncInput
  ): Promise<void> {
    await upsertPilotParticipant(db, {
      ...input,
      autoavaliacaoConcluida: true,
      ultimoAcessoEm: Timestamp.now(),
    });
  }
  
  export async function syncPilotAfterDiagnosis(
    db: Firestore,
    input: PilotParticipantSyncInput
  ): Promise<void> {
    await upsertPilotParticipant(db, {
      ...input,
      diagnosticoGerado: true,
      ultimoAcessoEm: Timestamp.now(),
    });
  }
  
  export async function syncPilotAfterRecommendations(
    db: Firestore,
    input: PilotParticipantSyncInput
  ): Promise<void> {
    await upsertPilotParticipant(db, {
      ...input,
      recomendacaoRecebida: true,
      ultimoAcessoEm: Timestamp.now(),
    });
  }
  
  export async function syncPilotAfterCourseRegistration(
    db: Firestore,
    input: PilotParticipantSyncInput
  ): Promise<void> {
    await upsertPilotParticipant(db, {
      ...input,
      cursoRegistrado: true,
      ultimoAcessoEm: Timestamp.now(),
    });
  }