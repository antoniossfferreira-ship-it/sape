import type { SectorCompetency } from "@/types/org";

export const sectorCompetencies: SectorCompetency[] = [

  // =========================
  // DEPARTAMENTOS PADRÃO
  // =========================

  // Coordenação Acadêmica
  {
    id: "matrix_departamento_coord_academica__gestao_academica_pedagogica",
    matrixSectorId: "matrix_departamento_coord_academica",
    competencyId: "gestao_academica_pedagogica",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_coord_academica__lideranca_gestao_conflitos",
    matrixSectorId: "matrix_departamento_coord_academica",
    competencyId: "lideranca_gestao_conflitos",
    expectedLevel: 2,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_coord_academica__sistemas_gestao_academica",
    matrixSectorId: "matrix_departamento_coord_academica",
    competencyId: "sistemas_gestao_academica",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  // Coordenação Administrativa
  {
    id: "matrix_departamento_coord_administrativa__gestao_processos_academicos",
    matrixSectorId: "matrix_departamento_coord_administrativa",
    competencyId: "gestao_processos_academicos",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_coord_administrativa__organizacao_gestao_tempo",
    matrixSectorId: "matrix_departamento_coord_administrativa",
    competencyId: "organizacao_gestao_tempo",
    expectedLevel: 2,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_coord_administrativa__ferramentas_colaboracao_gestao_dados",
    matrixSectorId: "matrix_departamento_coord_administrativa",
    competencyId: "ferramentas_colaboracao_gestao_dados",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  // Biblioteca
  {
    id: "matrix_departamento_biblioteca__gestao_acervos_tratamento_informacao",
    matrixSectorId: "matrix_departamento_biblioteca",
    competencyId: "gestao_acervos_tratamento_informacao",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_biblioteca__atendimento_usuario_relacionamento",
    matrixSectorId: "matrix_departamento_biblioteca",
    competencyId: "atendimento_usuario_relacionamento",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_biblioteca__conhecimento_pesquisa_academica",
    matrixSectorId: "matrix_departamento_biblioteca",
    competencyId: "conhecimento_pesquisa_academica",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  // Laboratórios
  {
    id: "matrix_departamento_laboratorios__sistemas_gestao_laboratorial",
    matrixSectorId: "matrix_departamento_laboratorios",
    competencyId: "sistemas_gestao_laboratorial",
    expectedLevel: 2,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_laboratorios__normas_seguranca_biosseguranca",
    matrixSectorId: "matrix_departamento_laboratorios",
    competencyId: "normas_seguranca_biosseguranca",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_laboratorios__empatia_relacionamento_interpessoal",
    matrixSectorId: "matrix_departamento_laboratorios",
    competencyId: "empatia_relacionamento_interpessoal",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  // TIC
  {
    id: "matrix_departamento_tic__gestao_ti_infraestrutura",
    matrixSectorId: "matrix_departamento_tic",
    competencyId: "gestao_ti_infraestrutura",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_tic__adaptabilidade_aprendizagem_continua",
    matrixSectorId: "matrix_departamento_tic",
    competencyId: "adaptabilidade_aprendizagem_continua",
    expectedLevel: 2,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_tic__plataformas_colaboracao",
    matrixSectorId: "matrix_departamento_tic",
    competencyId: "plataformas_colaboracao",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  // Financeiro/Contábil (departamentos padrão)
  {
    id: "matrix_departamento_financeiro_contabil__execucao_orcamentaria_financeira",
    matrixSectorId: "matrix_departamento_financeiro_contabil",
    competencyId: "execucao_orcamentaria_financeira",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_financeiro_contabil__excel_avancado_ferramentas_bi",
    matrixSectorId: "matrix_departamento_financeiro_contabil",
    competencyId: "excel_avancado_ferramentas_bi",
    expectedLevel: 2,
    required: true,
    active: true,
  },
  {
    id: "matrix_departamento_financeiro_contabil__organizacao_gestao_prazos",
    matrixSectorId: "matrix_departamento_financeiro_contabil",
    competencyId: "organizacao_gestao_prazos",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  // =========================
  // MATRIZ GENÉRICA DE GABINETE
  // =========================

  {
    id: "matrix_gabinete__comunicacao_institucional",
    matrixSectorId: "matrix_gabinete",
    competencyId: "comunicacao_institucional",
    expectedLevel: 4,
    required: true,
    active: true,
  },
  {
    id: "matrix_gabinete__organizacao_informacoes",
    matrixSectorId: "matrix_gabinete",
    competencyId: "organizacao_informacoes",
    expectedLevel: 4,
    required: true,
    active: true,
  },
  {
    id: "matrix_gabinete__apoio_administrativo",
    matrixSectorId: "matrix_gabinete",
    competencyId: "apoio_administrativo",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_gabinete__atendimento_institucional",
    matrixSectorId: "matrix_gabinete",
    competencyId: "atendimento_institucional",
    expectedLevel: 4,
    required: true,
    active: true,
  },
  {
    id: "matrix_gabinete__gestao_rotinas_administrativas",
    matrixSectorId: "matrix_gabinete",
    competencyId: "gestao_rotinas_administrativas",
    expectedLevel: 3,
    required: true,
    active: true,
  },

  // =========================
  // PGDP
  // =========================

  {
    id: "matrix_pgdp_desenvolvimento_pessoas__planejamento_acoes_formativas",
    matrixSectorId: "matrix_pgdp_desenvolvimento_pessoas",
    competencyId: "planejamento_acoes_formativas",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_desenvolvimento_pessoas__levantamento_necessidades_capacitacao",
    matrixSectorId: "matrix_pgdp_desenvolvimento_pessoas",
    competencyId: "levantamento_necessidades_capacitacao",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_desenvolvimento_pessoas__comunicacao_institucional",
    matrixSectorId: "matrix_pgdp_desenvolvimento_pessoas",
    competencyId: "comunicacao_institucional",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_desenvolvimento_pessoas__gestao_processos_administrativos",
    matrixSectorId: "matrix_pgdp_desenvolvimento_pessoas",
    competencyId: "gestao_processos_administrativos",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  {
    id: "matrix_pgdp_gestao_pessoas__gestao_processos_administrativos",
    matrixSectorId: "matrix_pgdp_gestao_pessoas",
    competencyId: "gestao_processos_administrativos",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_gestao_pessoas__organizacao_trabalho_controle_demandas",
    matrixSectorId: "matrix_pgdp_gestao_pessoas",
    competencyId: "organizacao_trabalho_controle_demandas",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_gestao_pessoas__registro_acompanhamento_documental",
    matrixSectorId: "matrix_pgdp_gestao_pessoas",
    competencyId: "registro_acompanhamento_documental",
    expectedLevel: 2,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_gestao_pessoas__atendimento_institucional",
    matrixSectorId: "matrix_pgdp_gestao_pessoas",
    competencyId: "atendimento_institucional",
    expectedLevel: 3,
    required: true,
    active: true,
  },

  {
    id: "matrix_pgdp_selecao_acompanhamento_docente__gestao_processos_administrativos",
    matrixSectorId: "matrix_pgdp_selecao_acompanhamento_docente",
    competencyId: "gestao_processos_administrativos",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_selecao_acompanhamento_docente__organizacao_informacoes_academicas",
    matrixSectorId: "matrix_pgdp_selecao_acompanhamento_docente",
    competencyId: "organizacao_informacoes_academicas",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_selecao_acompanhamento_docente__registro_acompanhamento_documental",
    matrixSectorId: "matrix_pgdp_selecao_acompanhamento_docente",
    competencyId: "registro_acompanhamento_documental",
    expectedLevel: 2,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_selecao_acompanhamento_docente__comunicacao_institucional",
    matrixSectorId: "matrix_pgdp_selecao_acompanhamento_docente",
    competencyId: "comunicacao_institucional",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  {
    id: "matrix_pgdp_gabinete__comunicacao_institucional",
    matrixSectorId: "matrix_pgdp_gabinete",
    competencyId: "comunicacao_institucional",
    expectedLevel: 4,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_gabinete__organizacao_informacoes",
    matrixSectorId: "matrix_pgdp_gabinete",
    competencyId: "organizacao_informacoes",
    expectedLevel: 4,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_gabinete__atendimento_institucional",
    matrixSectorId: "matrix_pgdp_gabinete",
    competencyId: "atendimento_institucional",
    expectedLevel: 4,
    required: true,
    active: true,
  },
  {
    id: "matrix_pgdp_gabinete__gestao_rotinas_administrativas",
    matrixSectorId: "matrix_pgdp_gabinete",
    competencyId: "gestao_rotinas_administrativas",
    expectedLevel: 3,
    required: true,
    active: true,
  },

  // =========================
  // SECONF / FINANÇAS
  // =========================

  // Gerência Contábil
  {
    id: "matrix_financas_gerencia_contabil__demonstracoes_contabeis_relatorios",
    matrixSectorId: "matrix_financas_gerencia_contabil",
    competencyId: "demonstracoes_contabeis_relatorios",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_financas_gerencia_contabil__analise_dados_excel",
    matrixSectorId: "matrix_financas_gerencia_contabil",
    competencyId: "analise_dados_excel",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_financas_gerencia_contabil__contabilidade_custos",
    matrixSectorId: "matrix_financas_gerencia_contabil",
    competencyId: "contabilidade_custos",
    expectedLevel: 3,
    required: true,
    active: true,
  },

  // Gerência Financeira
  {
    id: "matrix_financas_gerencia_financeira__analise_financeira_previsao",
    matrixSectorId: "matrix_financas_gerencia_financeira",
    competencyId: "analise_financeira_previsao",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_financas_gerencia_financeira__pensamento_analitico_solucao_problemas",
    matrixSectorId: "matrix_financas_gerencia_financeira",
    competencyId: "pensamento_analitico_solucao_problemas",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_financas_gerencia_financeira__sistemas_transparencia_portais",
    matrixSectorId: "matrix_financas_gerencia_financeira",
    competencyId: "sistemas_transparencia_portais",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  // Gabinete da SECONF
  {
    id: "matrix_financas_gabinete__elaboracao_documentos_oficiais",
    matrixSectorId: "matrix_financas_gabinete",
    competencyId: "elaboracao_documentos_oficiais",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_financas_gabinete__analise_conformidade",
    matrixSectorId: "matrix_financas_gabinete",
    competencyId: "analise_conformidade",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_financas_gabinete__sigilo_etica",
    matrixSectorId: "matrix_financas_gabinete",
    competencyId: "sigilo_etica",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_financas_gabinete__ferramentas_pesquisa_bi",
    matrixSectorId: "matrix_financas_gabinete",
    competencyId: "ferramentas_pesquisa_bi",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  // =========================
  // CEPAIA
  // =========================

  // CESDE
  {
    id: "matrix_cepaia_direito_educacional__direito_educacional_intercultural",
    matrixSectorId: "matrix_cepaia_direito_educacional",
    competencyId: "direito_educacional_intercultural",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_cepaia_direito_educacional__relacoes_etnico_raciais",
    matrixSectorId: "matrix_cepaia_direito_educacional",
    competencyId: "relacoes_etnico_raciais",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_cepaia_direito_educacional__postura_antirracista_anticolonial",
    matrixSectorId: "matrix_cepaia_direito_educacional",
    competencyId: "postura_antirracista_anticolonial",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_cepaia_direito_educacional__gestao_repositorios_memoria",
    matrixSectorId: "matrix_cepaia_direito_educacional",
    competencyId: "gestao_repositorios_memoria",
    expectedLevel: 2,
    required: true,
    active: true,
  },

  // NUEC
  {
    id: "matrix_cepaia_etica_cidadania__etica_bioetica_intercultural",
    matrixSectorId: "matrix_cepaia_etica_cidadania",
    competencyId: "etica_bioetica_intercultural",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_cepaia_etica_cidadania__gestao_projetos_politicas_publicas",
    matrixSectorId: "matrix_cepaia_etica_cidadania",
    competencyId: "gestao_projetos_politicas_publicas",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_cepaia_etica_cidadania__pensamento_critico_decolonial",
    matrixSectorId: "matrix_cepaia_etica_cidadania",
    competencyId: "pensamento_critico_decolonial",
    expectedLevel: 3,
    required: true,
    active: true,
  },
  {
    id: "matrix_cepaia_etica_cidadania__gestao_midias_comunicacao_inclusiva",
    matrixSectorId: "matrix_cepaia_etica_cidadania",
    competencyId: "gestao_midias_comunicacao_inclusiva",
    expectedLevel: 2,
    required: true,
    active: true,
  }

];