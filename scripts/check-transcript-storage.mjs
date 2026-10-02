// Reads no student data. With --write, creates/reads/deletes one isolated probe document.
import { readFile } from 'node:fs/promises';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import config from '../config/review-firebase.json' with {type:'json'};
const projectId=process.env.TRANSCRIPT_FIREBASE_PROJECT_ID || config.firebase.projectId;
const path=process.env.TRANSCRIPT_FIREBASE_CREDENTIALS;
let app;
try {
  if (!path) throw Error('Set TRANSCRIPT_FIREBASE_CREDENTIALS to the service-account JSON file path.');
  const account=JSON.parse(await readFile(path,'utf8'));
  if (account.project_id !== projectId) throw Error('Service account project does not match the transcript project.');
  app=initializeApp({projectId,credential:cert(account)},'transcript-check');
  const db=getFirestore(app), ref=db.collection('_connectionChecks').doc(randomUUID());
  if (process.argv.includes('--write')) {
    try { await ref.set({purpose:'connection-check',createdAt:new Date().toISOString()}); if(!(await ref.get()).exists) throw Error('Probe read failed.'); }
    finally { await ref.delete(); }
    console.log(`Firestore write/read/delete verified: ${projectId}`);
  } else { await ref.get(); console.log(`Firestore read access verified: ${projectId}. Use --write to verify saving.`); }
} catch (error) {
  console.error(!path ? error.message : `Firestore connection not verified (${error.code || 'configuration/access error'}). Check the credential path, project, Firestore database, and IAM permissions.`);
  process.exitCode=1;
} finally { if(app)await deleteApp(app); }
