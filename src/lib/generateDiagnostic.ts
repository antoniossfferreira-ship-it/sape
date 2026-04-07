import {
    collection,
    doc,
    getDocs,
    setDoc,
    Firestore,
  } from "firebase/firestore";
  
  export type DiagnosticItem = {
    competencyId: string;
    competencyName: string;
    competencyAxis: string;
    expectedLevel: number;
    currentLevel: number;
    gap: number;
    priority: "ALTA" | "MÉDIA" | "BAIXA";
  };
  
  /**
   * Calcula a prioridade com base no GAP
   */
  function calculatePriority(gap: number): "ALTA" | "MÉDIA" | "BAIXA" {
    if (gap >= 2) return "ALTA";
    if (gap === 1) return "MÉDIA";
    return "BAIXA";
  }
  
  /**
   * Gera o diagnóstico de competências do usuário
   */
  export async function generateDiagnostic(params: {
    db: Firestore;
    userId: string;
    expectedProfile: {
      competencyId: string;
      competencyName: string;
      competencyAxis: string;
      expectedLevel: number;
    }[];
  }) {
    const { db, userId, expectedProfile } = params;
  
    if (!userId || !db) {
      console.warn("generateDiagnostic: parâmetros inválidos");
      return [];
    }
  
    try {
      /**
       * 🔎 1. Buscar autoavaliação do usuário
       */
      const selfAssessmentRef = collection(
        db,
        "users",
        userId,
        "selfAssessment"
      );
  
      const selfSnap = await getDocs(selfAssessmentRef);
  
      const selfMap: Record<string, number> = {};
  
      selfSnap.docs.forEach((doc) => {
        const data = doc.data() as any;
        selfMap[data.competencyId] = Number(data.currentLevel) || 0;
      });
  
      /**
       * 🧠 2. Cruzar expectedProfile com autoavaliação
       */
      const diagnostics: DiagnosticItem[] = expectedProfile.map((item) => {
        const currentLevel = selfMap[item.competencyId] ?? 0;
        const gap = item.expectedLevel - currentLevel;
  
        return {
          competencyId: item.competencyId,
          competencyName: item.competencyName,
          competencyAxis: item.competencyAxis,
          expectedLevel: item.expectedLevel,
          currentLevel,
          gap,
          priority: calculatePriority(gap),
        };
      });
  
      /**
       * 💾 3. Salvar no Firestore
       * Estrutura: users/{uid}/diagnostics/current
       */
      const diagnosticRef = doc(
        db,
        "users",
        userId,
        "diagnostics",
        "current"
      );
  
      await setDoc(diagnosticRef, {
        createdAt: new Date(),
        items: diagnostics,
      });
  
      console.log("✅ Diagnóstico gerado com sucesso");
  
      return diagnostics;
    } catch (error) {
      console.error("Erro ao gerar diagnóstico:", error);
      return [];
    }
  }