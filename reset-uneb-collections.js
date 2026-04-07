#!/usr/bin/env node
const admin = require('firebase-admin');

const projectId = process.argv[2];
if (!projectId) {
  console.error('Uso: node reset-uneb-collections.js <projectId>');
  process.exit(1);
}

admin.initializeApp({ projectId });
const db = admin.firestore();

async function deleteCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) {
    console.log(`Coleção ${name}: vazia.`);
    return;
  }

  let batch = db.batch();
  let count = 0;
  let total = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;

    if (count === 450) {
      await batch.commit();
      total += count;
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    total += count;
  }

  console.log(`Coleção ${name}: ${total} documento(s) removido(s).`);
}

(async () => {
  await deleteCollection('setores');
  await deleteCollection('unidades');
  console.log('Reset concluído.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});