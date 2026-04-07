import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
});

const db = admin.firestore();

const competencies = [
  {
    id: "E1-COMUNICACAO",
    name: "Comunicação institucional",
    axis: "E1",
    active: true
  },
  {
    id: "E1-REDACAO",
    name: "Redação oficial",
    axis: "E1",
    active: true
  },
  {
    id: "E2-PLANEJAMENTO",
    name: "Planejamento institucional",
    axis: "E2",
    active: true
  },
  {
    id: "E3-TECNOLOGIA",
    name: "Uso de tecnologias digitais",
    axis: "E3",
    active: true
  },
  {
    id: "E4-GESTAO_PUBLICA",
    name: "Gestão pública",
    axis: "E4",
    active: true
  },
  {
    id: "E5-ATENDIMENTO",
    name: "Atendimento ao cidadão",
    axis: "E5",
    active: true
  }
];

async function run() {
  for (const comp of competencies) {
    await db.collection("competencies").doc(comp.id).set(comp);
    console.log("Criada:", comp.id);
  }

  console.log("Seed de competências finalizado.");
  process.exit();
}

run();