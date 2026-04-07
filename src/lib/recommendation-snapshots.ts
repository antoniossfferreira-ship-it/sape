// src/lib/recommendation-snapshots.ts

import {
  addDoc,
  collection,
  Firestore,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import type { RecommendationResult } from "@/lib/catalog-types";

export interface RecommendationSnapshotCourse {
  courseId: string;
  score: number;
  rank: number;
}

export interface RecommendationSnapshotItem {
  competencyId: string;
  competencyName: string;
  competencyScore: number;
  currentLevel: number;
  expectedLevel: number;
  gap: number;

  trackId: string | null;
  trackTitle: string | null;
  trackScore: number | null;

  selectedStageId: string | null;
  selectedStageTitle: string | null;
  selectedStageLevel: number | null;

  recommendedCourses: RecommendationSnapshotCourse[];
  explanation: string;
}

export interface RecommendationSnapshotDocument {
  userId: string;
  generatedAt: unknown;
  recommendationType: "track_based";
  active: boolean;
  items: RecommendationSnapshotItem[];
}

export async function saveRecommendationSnapshot(
  db: Firestore,
  userId: string,
  result: RecommendationResult
): Promise<string> {
  const items: RecommendationSnapshotItem[] = result.items.map((item) => ({
    competencyId: item.competency.competencyId,
    competencyName: item.competency.competencyName,
    competencyScore: item.competency.totalScore,
    currentLevel: item.competency.currentLevel,
    expectedLevel: item.competency.expectedLevel,
    gap: item.competency.gap,

    trackId: item.track?.trackId ?? null,
    trackTitle: item.track?.trackTitle ?? null,
    trackScore: item.track?.totalScore ?? null,

    selectedStageId: item.selectedStage?.id ?? null,
    selectedStageTitle: item.selectedStage?.title ?? null,
    selectedStageLevel: item.selectedStage?.level ?? null,

    recommendedCourses: item.courses.map((course, index) => ({
      courseId: course.courseId,
      score: course.totalScore,
      rank: index + 1,
    })),

    explanation: item.explanation,
  }));

  const payload: RecommendationSnapshotDocument = {
    userId,
    generatedAt: serverTimestamp(),
    recommendationType: "track_based",
    active: true,
    items,
  };

  const docRef = await addDoc(collection(db, "recommendationSnapshots"), payload);

  return docRef.id;
}

function normalizeGeneratedAt(value: any): number {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (value?.seconds) {
    return value.seconds * 1000;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

export async function getRecentRecommendedCourseIds(
  db: Firestore,
  userId: string,
  snapshotLimit = 5
): Promise<string[]> {
  // Consulta simples para evitar índice composto no Firestore.
  // Depois filtramos e ordenamos em memória.
  const q = query(
    collection(db, "recommendationSnapshots"),
    where("userId", "==", userId)
  );

  const snap = await getDocs(q);

  const snapshots = snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      };
    })
    .filter((item: any) => item.active === true)
    .sort(
      (a: any, b: any) =>
        normalizeGeneratedAt(b.generatedAt) - normalizeGeneratedAt(a.generatedAt)
    )
    .slice(0, snapshotLimit);

  const courseIds = new Set<string>();

  snapshots.forEach((snapshot: any) => {
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];

    items.forEach((item: any) => {
      const recommendedCourses = Array.isArray(item.recommendedCourses)
        ? item.recommendedCourses
        : [];

      recommendedCourses.forEach((course: any) => {
        if (course?.courseId) {
          courseIds.add(course.courseId);
        }
      });
    });
  });

  return Array.from(courseIds);
}