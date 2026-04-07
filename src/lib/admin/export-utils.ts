// src/lib/admin/export-utils.ts

import type { ExportMode, PilotParticipant } from "@/types/admin";

/**
 * Converte valores desconhecidos em string segura para CSV.
 */
function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return String(value);
}

/**
 * Escapa valores para CSV.
 * Coloca entre aspas quando necessário e duplica aspas internas.
 */
function escapeCsvValue(value: unknown): string {
  const str = stringifyValue(value);
  const needsQuotes =
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r") ||
    str.includes(";");

  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

/**
 * Formata timestamps variados vindos do Firestore ou objetos semelhantes.
 */
export function formatTimestamp(value: unknown): string {
  if (!value) return "";

  // Firestore Timestamp-like
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return "";
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

/**
 * Converte array de objetos em CSV.
 */
export function convertToCSV<T extends Record<string, unknown>>(rows: T[]): string {
  if (!rows.length) return "";

  const headers = Array.from(
    rows.reduce<Set<string>>((acc, row) => {
      Object.keys(row).forEach((key) => acc.add(key));
      return acc;
    }, new Set<string>())
  );

  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header])).join(",")
  );

  return [headerLine, ...dataLines].join("\n");
}

/**
 * Dispara download do CSV no navegador.
 */
export function downloadCSV(filename: string, csvContent: string): void {
  if (typeof window === "undefined") return;

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Cria um researchId estável e legível para exportação anonimizada.
 */
export function buildResearchId(index: number): string {
  return `PILOTO_${String(index + 1).padStart(3, "0")}`;
}

/**
 * Anonimiza uma linha baseada em participante.
 */
export function anonymizeParticipantRow<T extends Record<string, unknown>>(
  row: T,
  index: number
): Record<string, unknown> {
  const { nome, matricula, email, userId, ...rest } = row;

  return {
    researchId: buildResearchId(index),
    ...rest,
  };
}

/**
 * Aplica anonimização em um conjunto de linhas.
 */
export function anonymizeRows<T extends Record<string, unknown>>(
  rows: T[],
  mode: ExportMode
): Record<string, unknown>[] {
  if (mode === "nominal") return rows;
  return rows.map((row, index) => anonymizeParticipantRow(row, index));
}

/**
 * Formata um participante para exportação direta da coleção pilotParticipants.
 */
export function mapPilotParticipantToExportRow(
  participant: PilotParticipant
): Record<string, unknown> {
  return {
    userId: participant.userId,
    nome: participant.nome,
    matricula: participant.matricula,
    email: participant.email,
    unidadeId: participant.unidadeId,
    unidadeNome: participant.unidadeNome,
    setorId: participant.setorId,
    setorNome: participant.setorNome,
    funcaoId: participant.funcaoId,
    funcaoNome: participant.funcaoNome,
    statusPiloto: participant.statusPiloto,
    etapaAtual: participant.etapaAtual,
    percentualConclusao: participant.percentualConclusao,
    contextoPreenchido: participant.contextoPreenchido,
    autoavaliacaoConcluida: participant.autoavaliacaoConcluida,
    diagnosticoGerado: participant.diagnosticoGerado,
    recomendacaoRecebida: participant.recomendacaoRecebida,
    feedbackRegistrado: participant.feedbackRegistrado,
    cursoRegistrado: participant.cursoRegistrado,
    ativoNoPiloto: participant.ativoNoPiloto,
    totalCompetenciasAvaliadas: participant.totalCompetenciasAvaliadas,
    totalLacunas: participant.totalLacunas,
    totalRecomendacoes: participant.totalRecomendacoes,
    totalCursosRealizados: participant.totalCursosRealizados,
    primeiroAcessoEm: formatTimestamp(participant.primeiroAcessoEm),
    ultimoAcessoEm: formatTimestamp(participant.ultimoAcessoEm),
    observacoesPesquisa: participant.observacoesPesquisa,
    createdAt: formatTimestamp(participant.createdAt),
    updatedAt: formatTimestamp(participant.updatedAt),
  };
}

/**
 * Estrutura de entrada para montagem do dataset consolidado.
 */
export interface ConsolidatedDatasetItem {
  participant: PilotParticipant;
  qtdFeedbacks?: number;
  cargaHorariaTotalRegistrada?: number;
  eixoPredominanteLacuna?: string;
}

/**
 * Monta dataset consolidado analítico com uma linha por participante.
 */
export function buildConsolidatedDataset(
  items: ConsolidatedDatasetItem[],
  mode: ExportMode = "nominal"
): Record<string, unknown>[] {
  const rows = items.map((item, index) => {
    const row = {
      userId: item.participant.userId,
      nome: item.participant.nome,
      matricula: item.participant.matricula,
      email: item.participant.email,
      unidade: item.participant.unidadeNome,
      setor: item.participant.setorNome,
      funcao: item.participant.funcaoNome,
      statusPiloto: item.participant.statusPiloto,
      etapaAtual: item.participant.etapaAtual,
      percentualConclusao: item.participant.percentualConclusao,
      dataPrimeiroAcesso: formatTimestamp(item.participant.primeiroAcessoEm),
      dataUltimaAtividade: formatTimestamp(item.participant.ultimoAcessoEm),
      qtdCompetenciasAvaliadas: item.participant.totalCompetenciasAvaliadas,
      qtdLacunas: item.participant.totalLacunas,
      eixoPredominanteLacuna: item.eixoPredominanteLacuna ?? "",
      qtdRecomendacoes: item.participant.totalRecomendacoes,
      qtdFeedbacks: item.qtdFeedbacks ?? 0,
      qtdCursosRealizados: item.participant.totalCursosRealizados,
      cargaHorariaTotalRegistrada: item.cargaHorariaTotalRegistrada ?? 0,
      pilotoConcluido: item.participant.statusPiloto === "piloto_concluido",
      ativoNoPiloto: item.participant.ativoNoPiloto,
    };

    if (mode === "anonimizado") {
      return anonymizeParticipantRow(row, index);
    }

    return row;
  });

  return rows;
}

/**
 * Exporta diretamente uma lista de objetos.
 */
export function exportRowsAsCSV(
  filename: string,
  rows: Record<string, unknown>[]
): void {
  const csv = convertToCSV(rows);
  downloadCSV(filename, csv);
}

/**
 * Exporta participantes da coleção consolidada.
 */
export function exportPilotParticipantsCSV(
  participants: PilotParticipant[],
  mode: ExportMode = "nominal",
  filename = "pilot_participants.csv"
): void {
  const rows = participants.map(mapPilotParticipantToExportRow);
  const processedRows = anonymizeRows(rows, mode);
  exportRowsAsCSV(filename, processedRows);
}