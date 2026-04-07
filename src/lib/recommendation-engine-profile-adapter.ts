// src/lib/recommendation-engine-profile-adapter.ts

import type { CompetencyAxis } from "@/lib/catalog-query-engine";
import {
  getCatalogRecommendationsFromProfiles,
  ProfileCompetencyInput,
} from "@/lib/recommendation-engine";

export interface ExpectedProfileCompetency {
  competencyId: string;
  competencyName: string;
  competencyAxis: CompetencyAxis;
  expectedLevel: number;
}

export interface SelfAssessmentCompetency {
  competencyId: string;
  currentLevel: number;
}

export interface RecommendationProfileContext {
  unitId?: string;
  setorId?: string;
  roleId?: string;
}

export async function getRecommendationsFromExpectedProfileAndSelfAssessment(
  db: Parameters<typeof getCatalogRecommendationsFromProfiles>[0],
  expectedProfile: ExpectedProfileCompetency[],
  selfAssessment: SelfAssessmentCompetency[],
  context?: RecommendationProfileContext
) {
  const selfMap = new Map(
    selfAssessment.map((item) => [item.competencyId, item.currentLevel])
  );

  const profileInputs: ProfileCompetencyInput[] = expectedProfile.map((item) => ({
    competencyId: item.competencyId,
    competencyName: item.competencyName,
    competencyAxis: item.competencyAxis,
    expectedLevel: item.expectedLevel,
    currentLevel: selfMap.get(item.competencyId) ?? 0,
    priority: Math.max(
      0,
      item.expectedLevel - (selfMap.get(item.competencyId) ?? 0)
    ),
  }));

  return getCatalogRecommendationsFromProfiles(db, profileInputs, {
    maxTracksPerGap: 2,
    maxFinalRecommendations: 12,
    preferredModality: "EAD",
    activeOnly: true,
    dedupeByTrack: true,
    sortBy: "priority",
    setorId: context?.unitId || context?.setorId || undefined,
  });
}