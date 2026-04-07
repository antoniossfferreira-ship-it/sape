import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: applicationDefault()
});

const db = getFirestore();

async function migrate() {
  const source = "UnidadesOrgânicas";
  const target = "UnidadesOrganicas";

  const snapshot = await db.collection(source).get();

  for (const doc of snapshot.docs) {
    await db.collection(target).doc(doc.id).set(doc.data());
    console.log(`copiado: ${doc.id}`);
  }

  console.log("migração concluída");
}

migrate();