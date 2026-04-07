export type OrgUnitGroup =
  | "DEPARTAMENTOS_PADRAO"
  | "PGDP"
  | "SECONF"
  | "CEPAIA";

export type CompetencyLevel = 1 | 2 | 3;

export type OrgUnit = {
  id: string;
  name: string;
  acronym: string;
  city: string;
  unitGroup: OrgUnitGroup;
  active: boolean;
};

export type OrgSector = {
  id: string;
  unitId: string;
  name: string;
  matrixSectorId: string;
  active: boolean;
};

export type CompetencyAxis =
  | "Gestão e Processos"
  | "Relações Interpessoais e Comunicação"
  | "Tecnologia e Informação"
  | "Formação e Desenvolvimento"
  | "Análise e Produção Técnica";

export type Competency = {
  id: string;
  name: string;
  axis: CompetencyAxis;
  active: boolean;
};

export type SectorCompetency = {
  id: string;
  matrixSectorId: string;
  competencyId: string;
  expectedLevel: CompetencyLevel;
  required: boolean;
  active: boolean;
};
