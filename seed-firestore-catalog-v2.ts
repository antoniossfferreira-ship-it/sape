import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, WriteBatch } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

type Axis = 'E1' | 'E2' | 'E3' | 'E4' | 'E5';
type Level = 'inicial' | 'intermediario' | 'avancado';
type Modality = 'EAD' | 'PRESENCIAL' | 'HIBRIDO';

type AuditFields = {
  slug: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  searchTokens: string[];
};

type LearningTrack = AuditFields & {
  id: string;
  code: string;
  title: string;
  description: string;
  competencyAxis: Axis;
  targetAudience: string;
  preferredModality: Modality;
  levels: Level[];
  active: boolean;
  sortOrder: number;
};

type TrackStage = AuditFields & {
  id: string;
  trackId: string;
  level: Level;
  title: string;
  description: string;
  recommendedTotalHours: number;
  sortOrder: number;
  active: boolean;
};

type Course = AuditFields & {
  id: string;
  code: string;
  title: string;
  description: string;
  competencyAxis: Axis;
  modality: Modality;
  workloadHours: number;
  level: Level;
  active: boolean;
  sortOrder: number;
};

type TrackCourseLink = AuditFields & {
  id: string;
  trackId: string;
  stageId: string;
  courseId: string;
  order: number;
  required: boolean;
  active: boolean;
};

type CatalogSeed = {
  learningTracks: LearningTrack[];
  trackStages: TrackStage[];
  courses: Course[];
  trackCourseLinks: TrackCourseLink[];
};

const projectRoot = process.cwd();
const serviceAccountPath = path.resolve(projectRoot, 'serviceAccountKey.json');
const catalogPath = path.resolve(projectRoot, 'catalogo_formativo_seed_data_v2.json');

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error('Arquivo serviceAccountKey.json não encontrado na raiz do projeto.');
}

if (!fs.existsSync(catalogPath)) {
  throw new Error('Arquivo catalogo_formativo_seed_data_v2.json não encontrado na raiz do projeto.');
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
const catalog: CatalogSeed = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

function toTimestamp(value: string): Timestamp {
  return Timestamp.fromDate(new Date(value));
}

function normalizeForFirestore<T extends Record<string, any>>(item: T) {
  return {
    ...item,
    createdAt: toTimestamp(item.createdAt),
    updatedAt: toTimestamp(item.updatedAt),
    importedAt: FieldValue.serverTimestamp(),
  };
}

async function commitInBatches(items: any[], collectionName: string) {
  const chunkSize = 400;

  for (let i = 0; i < items.length; i += chunkSize) {
    const batch: WriteBatch = db.batch();
    const chunk = items.slice(i, i + chunkSize);

    for (const item of chunk) {
      const ref = db.collection(collectionName).doc(item.id);
      batch.set(ref, normalizeForFirestore(item), { merge: true });
    }

    await batch.commit();
    console.log(
      `Coleção ${collectionName}: lote ${Math.floor(i / chunkSize) + 1} gravado com ${chunk.length} registros.`
    );
  }
}

async function validateReferences(seed: CatalogSeed) {
  const trackIds = new Set(seed.learningTracks.map(item => item.id));
  const stageIds = new Set(seed.trackStages.map(item => item.id));
  const courseIds = new Set(seed.courses.map(item => item.id));

  for (const stage of seed.trackStages) {
    if (!trackIds.has(stage.trackId)) {
      throw new Error(`trackStages -> trackId inexistente: ${stage.trackId}`);
    }
  }

  for (const link of seed.trackCourseLinks) {
    if (!trackIds.has(link.trackId)) {
      throw new Error(`trackCourseLinks -> trackId inexistente: ${link.trackId}`);
    }
    if (!stageIds.has(link.stageId)) {
      throw new Error(`trackCourseLinks -> stageId inexistente: ${link.stageId}`);
    }
    if (!courseIds.has(link.courseId)) {
      throw new Error(`trackCourseLinks -> courseId inexistente: ${link.courseId}`);
    }
  }
}

async function run() {
  console.log('Iniciando validação do catálogo v2...');
  await validateReferences(catalog);
  console.log('Validação concluída com sucesso.');

  await commitInBatches(catalog.learningTracks, 'learningTracks');
  await commitInBatches(catalog.trackStages, 'trackStages');
  await commitInBatches(catalog.courses, 'courses');
  await commitInBatches(catalog.trackCourseLinks, 'trackCourseLinks');

  console.log('Seed v2 concluído com sucesso.');
}

run().catch((error) => {
  console.error('Erro ao executar seed do catálogo formativo v2:', error);
  process.exit(1);
});
