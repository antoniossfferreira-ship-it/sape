import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

function initAdmin() {
  if (getApps().length) return;

  const serviceAccountPath = path.resolve(
    process.cwd(),
    "serviceAccountKey.json"
  );

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Arquivo serviceAccountKey.json não encontrado em: ${serviceAccountPath}`
    );
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );

  initializeApp({
    credential: cert(serviceAccount),
  });
}

export function getAdminDb() {
  initAdmin();
  return getFirestore();
}