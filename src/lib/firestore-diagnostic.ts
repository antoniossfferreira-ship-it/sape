import {
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Firestore,
  DocumentData,
  collection,
} from "firebase/firestore";
import {
  DiagnosticDocument,
  UserContextSnapshot,
} from "@/types/diagnostic";
import {
  buildDiagnosis,
  normalizeAssessment,
  normalizeCompletedCourses,
  normalizeExpectedProfile,
  summarize,
} from "@/lib/diagnostic-engine";

async function readFirstExistingDoc(db: Firestore, paths: string[][]) {
  for (const path of paths) {
    const ref = doc(db, ...path);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return {
        refPath: path.join("/"),
        data: snap.data(),
      };
    }
  }
  return null;
}

export async function loadUserContext(
  db: Firestore,
  uid: string,
  authUser?: { displayName?: string | null; email?: string | null }
): Promise<UserContextSnapshot> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const userData = snap.exists() ? (snap.data() as DocumentData) : {};

  return {
    name: userData?.name || authUser?.displayName || "",
    email: userData?.email || authUser?.email || "",
    unitId: userData?.unitId || userData?.unit?.id || "",
    unitName: userData?.unitName || userData?.unit?.name || userData?.context?.unitName || "",
    sectorId: userData?.sectorId || userData?.sector?.id || "",
    sectorName:
      userData?.sectorName || userData?.sector?.name || userData?.context?.sectorName || "",
    roleId: userData?.roleId || userData?.role?.id || "",
    roleName:
      userData?.roleName ||
      userData?.role?.name ||
      userData?.funcaoName ||
      userData?.context?.roleName ||
      "",
    formalFunctionId:
      userData?.formalFunctionId || userData?.formalFunction?.id || "",
    formalFunctionName:
      userData?.formalFunctionName || userData?.formalFunction?.name || "",
  };
}

export async function loadExpectedProfile(db: Firestore, uid: string) {
  return readFirstExistingDoc(db, [
    ["users", uid, "expectedProfile", "current"],
    ["users", uid, "snapshots", "expectedProfile"],
    ["users", uid, "profiles", "expectedProfile"],
    ["users", uid],
  ]);
}

export async function loadSelfAssessment(db: Firestore, uid: string) {
  return readFirstExistingDoc(db, [
    ["users", uid, "selfAssessment", "current"],
    ["users", uid, "assessments", "current"],
    ["users", uid, "snapshots", "selfAssessment"],
    ["users", uid],
  ]);
}

export async function loadCompletedCourses(db: Firestore, uid: string) {
  const ref = collection(db, "users", uid, "completedCourses");
  const snap = await getDocs(ref);

  const items = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  return {
    refPath: `users/${uid}/completedCourses`,
    data: items,
  };
}

export async function generateAndSaveDiagnostic(params: {
  db: Firestore;
  uid: string;
  authUser?: { displayName?: string | null; email?: string | null };
}) {
  const { db, uid, authUser } = params;

  const [contextSnapshot, expectedDoc, assessmentDoc, completedCoursesDoc] =
    await Promise.all([
      loadUserContext(db, uid, authUser),
      loadExpectedProfile(db, uid),
      loadSelfAssessment(db, uid),
      loadCompletedCourses(db, uid),
    ]);

  const expectedProfile = normalizeExpectedProfile(expectedDoc?.data || {});
  const selfAssessment = normalizeAssessment(assessmentDoc?.data || {});
  const completedCourses = normalizeCompletedCourses(completedCoursesDoc?.data || []);

  if (expectedProfile.length === 0) {
    throw new Error("EXPECTED_PROFILE_NOT_FOUND");
  }

  const items = buildDiagnosis(expectedProfile, selfAssessment, completedCourses);
  const summary = summarize(items);

  const payload: DiagnosticDocument = {
    userId: uid,
    version: "2.0",
    contextSnapshot,
    sourceRefs: {
      expectedProfileRef: expectedDoc?.refPath || "",
      selfAssessmentRef: assessmentDoc?.refPath || "",
      completedCoursesRef: completedCoursesDoc?.refPath || "",
    },
    summary,
    items,
  };

  await setDoc(
    doc(db, "users", uid, "diagnostics", "current"),
    {
      ...payload,
      generatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return {
    payload,
    refs: {
      expectedProfileRef: expectedDoc?.refPath || "",
      selfAssessmentRef: assessmentDoc?.refPath || "",
      completedCoursesRef: completedCoursesDoc?.refPath || "",
    },
  };
}

export async function loadSavedDiagnostic(db: Firestore, uid: string) {
  const ref = doc(db, "users", uid, "diagnostics", "current");
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return snap.data() as DiagnosticDocument & {
    generatedAt?: unknown;
  };
}