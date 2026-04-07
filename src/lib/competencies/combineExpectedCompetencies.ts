export type ExpectedItem = {
  competencyId: string;
  expectedLevel: number;
  source?: string;
};

export type CombinedExpectedItem = {
  competencyId: string;
  expectedLevel: number;
  origins: ("sector" | "formalRole")[];
};

export function combineExpectedCompetencies(
  sectorItems: ExpectedItem[],
  formalRoleItems: ExpectedItem[]
): CombinedExpectedItem[] {
  const map = new Map<string, CombinedExpectedItem>();

  for (const item of sectorItems) {
    map.set(item.competencyId, {
      competencyId: item.competencyId,
      expectedLevel: Number(item.expectedLevel) || 0,
      origins: ["sector"],
    });
  }

  for (const item of formalRoleItems) {
    const current = map.get(item.competencyId);

    if (!current) {
      map.set(item.competencyId, {
        competencyId: item.competencyId,
        expectedLevel: Number(item.expectedLevel) || 0,
        origins: ["formalRole"],
      });
    } else {
      current.expectedLevel = Math.max(
        current.expectedLevel,
        Number(item.expectedLevel) || 0
      );

      if (!current.origins.includes("formalRole")) {
        current.origins.push("formalRole");
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.competencyId.localeCompare(b.competencyId)
  );
}
