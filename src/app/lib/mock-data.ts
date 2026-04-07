// Nota: Estes dados agora servem apenas como referência para o que deve existir no Firestore.
// O app prioriza a busca em coleções reais do Firebase para suportar relacionamentos (ex: Unidade -> Setores).

export const UNIDADES = [
  { id: "u1", name: "Campus I - Salvador" },
  { id: "u2", name: "Campus II - Alagoinhas" },
  { id: "u3", name: "Campus III - Juazeiro" },
  { id: "u4", name: "Campus IV - Jacobina" }
];

export const SETORES = [
  { id: "s1", name: "Recursos Humanos", unidadeId: "u1" },
  { id: "s2", name: "Secretaria Acadêmica", unidadeId: "u1" },
  { id: "s3", name: "Coordenação de TI", unidadeId: "u1" },
  { id: "s4", name: "Administrativo", unidadeId: "u2" },
  { id: "s5", name: "Financeiro", unidadeId: "u2" }
];

export const FORMAL_ROLES = [
  { id: "fr1", name: "Coordenador Administrativo" },
  { id: "fr2", name: "Gerente de Unidade" },
  { id: "fr3", name: "Diretor de Departamento" },
  { id: "fr4", name: "Secretário de Colegiado" }
];

export const CARGOS = [
  "Técnico Universitário",
  "Analista Universitário"
];

export const COMPETENCIAS = [
  { id: "c1", name: "Comunicação Efetiva", expectedLevel: 3 },
  { id: "c2", name: "Trabalho em Equipe", expectedLevel: 2 },
  { id: "c3", name: "Gestão de Processos", expectedLevel: 3 },
  { id: "c4", name: "Tecnologia da Informação", expectedLevel: 2 },
  { id: "c5", name: "Atendimento ao Público", expectedLevel: 3 }
];

export interface Course {
  id: string;
  name: string;
  description: string;
  link: string;
  competencyIds: string[];
  workApplication?: string;
  microActions?: string[];
  andragogyTags?: string[];
  gapRationaleTemplate?: string;
}

export const COURSES: Course[] = [
  {
    id: "course1",
    name: "Excel Avançado para Gestão",
    description: "Domine planilhas complexas para otimizar processos administrativos.",
    link: "https://exemplo.com/excel",
    competencyIds: ["c3", "c4"],
    workApplication: "Utilize fórmulas avançadas para automatizar relatórios de frequência e planilhas de estoque da sua unidade.",
    microActions: [
      "Criar uma tabela dinâmica para o relatório mensal",
      "Validar dados de entrada para evitar erros de digitação",
      "Proteger células com fórmulas críticas"
    ],
    andragogyTags: ["Prático", "Orientado a Problemas", "Imediato"],
    gapRationaleTemplate: "Para otimizar a Gestão de Processos (c3), é essencial dominar ferramentas que automatizem tarefas repetitivas."
  },
  {
    id: "course2",
    name: "Comunicação Interpessoal",
    description: "Melhore sua capacidade de diálogo e resolução de conflitos no ambiente de trabalho.",
    link: "https://exemplo.com/comunicacao",
    competencyIds: ["c1", "c2"],
    workApplication: "Aplique técnicas de escuta ativa durante reuniões de setor e no atendimento a demandas internas de colegas.",
    microActions: [
      "Praticar paráfrase em uma conversa difícil",
      "Identificar sinais não-verbais em reuniões",
      "Pedir feedback específico sobre sua clareza ao passar instruções"
    ],
    andragogyTags: ["Social", "Experiencial", "Autonomia"],
    gapRationaleTemplate: "A lacuna em Comunicação Efetiva (c1) pode ser mitigada com o exercício da empatia e clareza no diálogo diário."
  },
  {
    id: "course3",
    name: "Qualidade no Atendimento",
    description: "Técnicas modernas para um atendimento público de excelência na UNEB.",
    link: "https://exemplo.com/atendimento",
    competencyIds: ["c5"],
    workApplication: "Padronize o atendimento telefônico e via e-mail do seu setor seguindo os protocolos de excelência institucional.",
    microActions: [
      "Criar um guia rápido de respostas frequentes",
      "Sorrir ao atender o telefone (técnica de voz)",
      "Reduzir o tempo de resposta de e-mails para 24h"
    ],
    andragogyTags: ["Relevante", "Prático", "Auto-dirigido"],
    gapRationaleTemplate: "O Atendimento ao Público (c5) é a face da nossa universidade; elevar este nível garante maior satisfação da comunidade acadêmica."
  }
];
