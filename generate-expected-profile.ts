import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const USER_ID = "KrfpHIXENRUCLs9GrsqKL3aZ48K2";

async function run() {
  const expectedProfile = [
    {
      competencyId: "E1-COMUNICACAO",
      competencyName: "Comunicação institucional",
      competencyAxis: "E1",
      expectedLevel: 3,
    },
    {
      competencyId: "E2-TRABALHO_EQUIPE",
      competencyName: "Trabalho em equipe",
      competencyAxis: "E2",
      expectedLevel: 3,
    },
    {
      competencyId: "E3-PLANEJAMENTO",
      competencyName: "Planejamento e organização",
      competencyAxis: "E3",
      expectedLevel: 3,
    },
    {
      competencyId: "E4-INOVACAO",
      competencyName: "Inovação no serviço público",
      competencyAxis: "E4",
      expectedLevel: 2,
    },
    {
      competencyId: "E5-ETICA_PUBLICA",
      competencyName: "Ética e responsabilidade pública",
      competencyAxis: "E5",
      expectedLevel: 3,
    },
  ];

  await db.collection("users").doc(USER_ID).set(
    {
      expectedProfile,
    },
    { merge: true }
  );

  console.log("expectedProfile criado com sucesso");
}

run();