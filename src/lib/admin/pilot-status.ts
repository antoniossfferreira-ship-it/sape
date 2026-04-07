// src/lib/admin/pilot-status.ts

import type {
    PilotProgressFlags,
    PilotProgressResult,
    PilotStatus,
    PilotStep,
  } from "@/types/admin";
  
  /**
   * Garante booleano consistente.
   */
  function toBool(value: unknown): boolean {
    return value === true;
  }
  
  /**
   * Calcula status, etapa atual e percentual de conclusão do piloto
   * com base nas flags operacionais do participante.
   *
   * Régua proposta:
   * - contexto preenchido = 20
   * - autoavaliação concluída = 40
   * - diagnóstico gerado = 60
   * - recomendação recebida = 80
   * - curso registrado = 100
   *
   * Regras:
   * - se ativoNoPiloto === false, retorna "inativo"
   * - se nenhuma etapa foi concluída, pode retornar "ativo" e etapa "contexto"
   * - se cursoRegistrado === true, finaliza em 100%
   */
  export function getPilotProgress(flags: PilotProgressFlags): PilotProgressResult {
    const ativoNoPiloto = flags.ativoNoPiloto !== false;
  
    const contextoPreenchido = toBool(flags.contextoPreenchido);
    const autoavaliacaoConcluida = toBool(flags.autoavaliacaoConcluida);
    const diagnosticoGerado = toBool(flags.diagnosticoGerado);
    const recomendacaoRecebida = toBool(flags.recomendacaoRecebida);
    const cursoRegistrado = toBool(flags.cursoRegistrado);
  
    if (!ativoNoPiloto) {
      return {
        statusPiloto: "inativo",
        etapaAtual: "contexto",
        percentualConclusao: 0,
      };
    }
  
    if (cursoRegistrado) {
      return {
        statusPiloto: "piloto_concluido",
        etapaAtual: "concluido",
        percentualConclusao: 100,
      };
    }
  
    if (recomendacaoRecebida) {
      return {
        statusPiloto: "recomendacao_recebida",
        etapaAtual: "registro_cursos",
        percentualConclusao: 80,
      };
    }
  
    if (diagnosticoGerado) {
      return {
        statusPiloto: "diagnostico_gerado",
        etapaAtual: "recomendacoes",
        percentualConclusao: 60,
      };
    }
  
    if (autoavaliacaoConcluida) {
      return {
        statusPiloto: "autoavaliacao_concluida",
        etapaAtual: "diagnostico",
        percentualConclusao: 40,
      };
    }
  
    if (contextoPreenchido) {
      return {
        statusPiloto: "contexto_preenchido",
        etapaAtual: "autoavaliacao",
        percentualConclusao: 20,
      };
    }
  
    return {
      statusPiloto: "ativo",
      etapaAtual: "contexto",
      percentualConclusao: 0,
    };
  }
  
  /**
   * Retorna um rótulo amigável para exibição na interface.
   */
  export function getPilotStatusLabel(status: PilotStatus): string {
    const labels: Record<PilotStatus, string> = {
      convidado: "Convidado",
      ativo: "Ativo",
      contexto_preenchido: "Contexto preenchido",
      autoavaliacao_concluida: "Autoavaliação concluída",
      diagnostico_gerado: "Diagnóstico gerado",
      recomendacao_recebida: "Recomendação recebida",
      curso_registrado: "Curso registrado",
      piloto_concluido: "Piloto concluído",
      inativo: "Inativo",
    };
  
    return labels[status] ?? status;
  }
  
  /**
   * Retorna um rótulo amigável para a etapa atual.
   */
  export function getPilotStepLabel(step: PilotStep): string {
    const labels: Record<PilotStep, string> = {
      contexto: "Contexto",
      autoavaliacao: "Autoavaliação",
      diagnostico: "Diagnóstico",
      recomendacoes: "Recomendações",
      registro_cursos: "Registro de cursos",
      concluido: "Concluído",
    };
  
    return labels[step] ?? step;
  }
  
  /**
   * Helper simples para determinar se o participante já avançou até uma etapa.
   * Útil em filtros e badges.
   */
  export function hasReachedStep(
    currentStep: PilotStep,
    targetStep: PilotStep
  ): boolean {
    const order: PilotStep[] = [
      "contexto",
      "autoavaliacao",
      "diagnostico",
      "recomendacoes",
      "registro_cursos",
      "concluido",
    ];
  
    return order.indexOf(currentStep) >= order.indexOf(targetStep);
  }