// src/types/admin.ts

import type { Timestamp } from "firebase/firestore";

/**
 * Status macro do participante dentro do piloto.
 */
export type PilotStatus =
  | "convidado"
  | "ativo"
  | "contexto_preenchido"
  | "autoavaliacao_concluida"
  | "diagnostico_gerado"
  | "recomendacao_recebida"
  | "curso_registrado"
  | "piloto_concluido"
  | "inativo";

/**
 * Etapa atual do participante no fluxo do protótipo.
 */
export type PilotStep =
  | "contexto"
  | "autoavaliacao"
  | "diagnostico"
  | "recomendacoes"
  | "registro_cursos"
  | "concluido";

/**
 * Modo de exportação do dataset.
 */
export type ExportMode = "nominal" | "anonimizado";

/**
 * Flags operacionais que ajudam a calcular o andamento do piloto.
 */
export interface PilotProgressFlags {
  contextoPreenchido?: boolean;
  autoavaliacaoConcluida?: boolean;
  diagnosticoGerado?: boolean;
  recomendacaoRecebida?: boolean;
  feedbackRegistrado?: boolean;
  cursoRegistrado?: boolean;
  ativoNoPiloto?: boolean;
}

/**
 * Resumo calculado do progresso do participante.
 */
export interface PilotProgressResult {
  statusPiloto: PilotStatus;
  etapaAtual: PilotStep;
  percentualConclusao: number;
}

/**
 * Documento consolidado que servirá de base para a nova área admin.
 * Idealmente, cada documento usa o userId como ID do documento em pilotParticipants.
 */
export interface PilotParticipant extends PilotProgressFlags, PilotProgressResult {
  userId: string;

  nome: string;
  matricula: string;
  email: string;

  unidadeId: string;
  unidadeNome: string;

  setorId: string;
  setorNome: string;

  funcaoId: string;
  funcaoNome: string;

  totalCompetenciasAvaliadas: number;
  totalLacunas: number;
  totalRecomendacoes: number;
  totalCursosRealizados: number;

  primeiroAcessoEm: Timestamp | null;
  ultimoAcessoEm: Timestamp | null;

  observacoesPesquisa: string;

  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

/**
 * Estrutura mínima do documento de contexto do usuário.
 * Pode ser útil em consultas e sincronizações.
 */
export interface UserContextSummary {
  userId: string;
  unidadeId?: string;
  unidadeNome?: string;
  setorId?: string;
  setorNome?: string;
  funcaoId?: string;
  funcaoNome?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

/**
 * Estrutura mínima do documento de usuário, caso precise montar o resumo
 * com base em dados vindos da coleção users.
 */
export interface UserProfileSummary {
  userId: string;
  nome?: string;
  matricula?: string;
  email?: string;
}

/**
 * Estrutura genérica de evento de pesquisa.
 */
export interface ResearchEvent {
  id?: string;
  userId: string;
  tipoEvento: string;
  descricao?: string;
  pagina?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Timestamp | null;
}

/**
 * Payload parcial usado para atualizar/sincronizar o documento em pilotParticipants.
 */
export interface PilotParticipantSyncInput
  extends Partial<Omit<PilotParticipant, "userId" | "statusPiloto" | "etapaAtual" | "percentualConclusao">>,
    PilotProgressFlags {
  userId: string;
}