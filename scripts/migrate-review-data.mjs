// Read-only by default. --apply copies students and their descendants; never deletes source data.
// Credentials and backups must stay outside version control. Re-run before the production cutover.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { cert } from 'firebase-admin/app';
import { isDeepStrictEqual } from 'node:util';

const sourceAccount = JSON.parse(await readFile(process.env.MIGRATION_SOURCE_CREDENTIALS, 'utf8'));
const targetAccount = JSON.parse(await readFile(process.env.TRANSCRIPT_FIREBASE_CREDENTIALS, 'utf8'));
if (sourceAccount.project_id !== 'id40018-7e359' || targetAccount.project_id !== 'id40018ddasd') throw Error('Unexpected migration projects');
const endpoint = async (account, database) => ({
  root: `projects/${account.project_id}/databases/${database}/documents`,
  token: (await cert(account).getAccessToken()).access_token,
});
const source = await endpoint(sourceAccount, '(default)');
const target = await endpoint(targetAccount, 'id40018');
async function request(env, resource, body) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${resource}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw Error(`Firestore request failed: ${response.status} ${(await response.json()).error?.status}`);
  return response.json();
}
async function snapshot(env) {
  const docs = new Map();
  async function collection(parent, id) {
    let pageToken;
    do {
      const query = new URLSearchParams({ pageSize: '100', showMissing: 'true', ...(pageToken ? { pageToken } : {}) });
      const page = await request(env, `${parent}/${id}?${query}`);
      // Bounded groups avoid a burst of per-document requests.
      const entries = page.documents || [];
      for (let i = 0; i < entries.length; i += 5) await Promise.all(entries.slice(i, i + 5).map(async doc => {
        if (doc.createTime) docs.set(doc.name.slice(env.root.length + 1), doc);
        let childToken;
        do {
          const children = await request(env, `${doc.name}:listCollectionIds`, { pageSize: 100, ...(childToken ? { pageToken: childToken } : {}) });
          for (const child of children.collectionIds || []) await collection(doc.name, child);
          childToken = children.nextPageToken;
        } while (childToken);
      }));
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  await collection(env.root, 'students');
  return docs;
}
const [beforeSource, beforeTarget] = await Promise.all([snapshot(source), snapshot(target)]);
const directory = `.data/migrations/${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(directory, { recursive: true, mode: 0o700 });
for (const [name, docs] of [['source', beforeSource], ['target-before', beforeTarget]]) {
  await writeFile(`${directory}/${name}.json`, JSON.stringify([...docs.values()], null, 2), { mode: 0o600 });
}
// Compare business timestamps, not Firestore updateTime (a previous copy changes updateTime).
const newest = doc => Math.max(0, ...['updatedAt', 'completedAt', 'createdAt', 'lastActiveAt'].map(k => {
  const value = doc.fields?.[k];
  return Date.parse(value?.stringValue || value?.timestampValue || '') || 0;
}));
const writes = [], conflicts = [], preserved = [];
let identical = 0;
for (const [path, doc] of beforeSource) {
  const current = beforeTarget.get(path);
  if (current && isDeepStrictEqual(doc.fields || {}, current.fields || {})) { identical++; continue; }
  if (current && newest(current) > newest(doc)) { preserved.push(path); continue; }
  if (current && Object.keys(current.fields || {}).length && newest(current) === newest(doc)) {
    // Fill fields missing in an earlier copy, but do not resolve ambiguous conflicting values silently.
    const compatible = Object.entries(current.fields).every(([k, v]) => isDeepStrictEqual(v, doc.fields?.[k]));
    if (!compatible) { conflicts.push(path); continue; }
  }
  writes.push({ update: { name: `${target.root}/${path}`, fields: doc.fields || {} },
    currentDocument: current ? { updateTime: current.updateTime } : { exists: false } });
}
const summary = { sourceDocuments: beforeSource.size, targetDocumentsBefore: beforeTarget.size,
  toCopy: writes.length, identical, preservedNewer: preserved.length, conflicts: conflicts.length, backup: directory };
await writeFile(`${directory}/plan.json`, JSON.stringify({ summary, conflicts, preserved, writes }, null, 2), { mode: 0o600 });
console.log(JSON.stringify(summary));
if (conflicts.length) throw Error('Conflicts require inspection; no writes performed');
if (process.argv.includes('--apply')) {
  if (writes.length > 500) throw Error('Migration exceeds single atomic commit limit');
  if (writes.length) await request(target, `${target.root}:commit`, { writes });
  const after = await snapshot(target);
  for (const write of writes) {
    const path = write.update.name.slice(target.root.length + 1);
    if (!isDeepStrictEqual(after.get(path)?.fields || {}, write.update.fields)) throw Error('Post-copy verification failed');
  }
  await writeFile(`${directory}/target-after.json`, JSON.stringify([...after.values()], null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ copiedAndVerified: writes.length, targetDocumentsAfter: after.size }));
} else console.log('Dry run only. Add --apply to copy.');
