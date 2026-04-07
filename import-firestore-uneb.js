#!/usr/bin/env node

/**
 * Script de importação da estrutura UNEB para o Firestore.
 *
 * Uso:
 *   node import-firestore-uneb.js \
 *     --project sisrecomendaja-97163026-86946 \
 *     --input ./firebase_seed_uneb.json
 *
 * Opções:
 *   --project <id>     ID do projeto Firebase (opcional, mas recomendado)
 *   --input <arquivo>  Caminho do JSON chaveado por id
 *   --dry-run          Mostra o que seria importado sem gravar
 *
 * Credenciais:
 * 1) Preferencialmente use Application Default Credentials já disponíveis no ambiente; ou
 * 2) defina GOOGLE_APPLICATION_CREDENTIALS apontando para um service account JSON.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function parseArgs(argv) {
  const args = {
    projectId: '',
    input: './firebase_seed_uneb.json',
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--project' && argv[i + 1]) {
      args.projectId = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--input' && argv[i + 1]) {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

function loadSeedFile(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo não encontrado: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON inválido: objeto raiz ausente.');
  }

  if (!parsed.unidades || !parsed.setores) {
    throw new Error(
      'JSON inválido: esperado um objeto com as chaves "unidades" e "setores".'
    );
  }

  return parsed;
}

function initializeFirebase(projectId) {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const options = {};

  if (projectId) {
    options.projectId = projectId;
  }

  return admin.initializeApp(options);
}

async function writeCollection(db, collectionName, docsById, dryRun) {
  const entries = Object.entries(docsById || {});

  if (!entries.length) {
    console.log(`Coleção ${collectionName}: nenhum documento para importar.`);
    return { collectionName, total: 0 };
  }

  console.log(`\nColeção ${collectionName}: ${entries.length} documento(s).`);

  if (dryRun) {
    for (const [docId, payload] of entries) {
      console.log(`- [dry-run] ${collectionName}/${docId}`, payload);
    }
    return { collectionName, total: entries.length };
  }

  let batch = db.batch();
  let opCount = 0;
  let totalWritten = 0;

  for (const [docId, payload] of entries) {
    const ref = db.collection(collectionName).doc(docId);
    batch.set(ref, payload, { merge: true });
    opCount += 1;

    if (opCount === 450) {
      await batch.commit();
      totalWritten += opCount;
      console.log(`- ${collectionName}: ${totalWritten} documento(s) gravado(s)...`);
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
    totalWritten += opCount;
  }

  console.log(`- ${collectionName}: ${totalWritten} documento(s) gravado(s).`);
  return { collectionName, total: totalWritten };
}

async function main() {
  const args = parseArgs(process.argv);
  const seed = loadSeedFile(args.input);

  initializeFirebase(args.projectId);
  const db = admin.firestore();

  console.log('Iniciando importação da estrutura UNEB...');
  console.log(`Projeto: ${args.projectId || '(inferido pelo ambiente)'}`);
  console.log(`Arquivo: ${path.resolve(args.input)}`);
  console.log(`Modo dry-run: ${args.dryRun ? 'sim' : 'não'}`);

  const summaries = [];
  summaries.push(
    await writeCollection(db, 'unidades', seed.unidades, args.dryRun)
  );
  summaries.push(
    await writeCollection(db, 'setores', seed.setores, args.dryRun)
  );

  const total = summaries.reduce((sum, item) => sum + item.total, 0);

  console.log('\nImportação concluída.');
  console.log(
    summaries
      .map((item) => `${item.collectionName}: ${item.total}`)
      .join(' | ')
  );
  console.log(`Total geral: ${total}`);
}

main().catch((error) => {
  console.error('\nErro na importação:');
  console.error(error);
  process.exit(1);
});
