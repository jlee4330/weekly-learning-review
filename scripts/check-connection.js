import { readFile, writeFile } from 'node:fs/promises';
import { createRealtimeToken } from '../server/realtime.js';

const local = process.argv.includes('--local');
const required = local ? ['OPENAI_API_KEY'] : ['OPENAI_API_KEY', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'];
const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) {
  console.error(`설정 필요: ${missing.join(', ')}. 기존 모드는 유지합니다.`);
  process.exit(1);
}
let firebase;
try {
  await createRealtimeToken('en'); // Never log the short-lived credential.
  console.log('Realtime 임시 토큰 발급 성공.');
  const model = process.env.OPENAI_JUDGE_MODEL || 'gpt-4.1';
  const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`MODEL_${response.status}`);
  console.log('대화 진행·평가 모델 접근 확인 성공.');
  if (!local) {
    if (process.env.VITE_FIREBASE_PROJECT_ID !== process.env.FIREBASE_PROJECT_ID) throw Error('FIREBASE_PROJECT_MISMATCH');
    const { initializeApp, applicationDefault } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    firebase = initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
    await getFirestore(firebase).listCollections();
    console.log('Firestore 연결 성공.');
  }
  if (process.argv.includes('--activate')) {
    const path = new URL('../.env', import.meta.url);
    let env = await readFile(path, 'utf8');
    for (const [name, value] of Object.entries({ VITE_MODE: local ? 'local' : 'live', REVIEW_STORAGE: local ? 'local' : 'firebase' })) {
      const pattern = new RegExp(`^${name}=.*$`, 'm');
      env = pattern.test(env) ? env.replace(pattern, `${name}=${value}`) : `${env}\n${name}=${value}\n`;
    }
    await writeFile(path, env, { mode: 0o600 });
    console.log(local ? '실제 음성 + 이 컴퓨터에 저장하는 모드로 전환했습니다.' : '실제 음성 + Firebase 모드로 전환했습니다.');
    console.log('API 서버와 Vite를 재시작하세요.');
  }
  console.log('키 값은 출력하지 않았습니다. 마이크 입력·음성 재생은 브라우저에서 별도로 확인해야 합니다.');
} catch (error) {
  const code = /^(REALTIME|MODEL)_\d{3}$|^FIREBASE_PROJECT_MISMATCH$|^VOICE_(AUTH_FAILED|CONNECTION_SERVICE)$|^(insufficient_quota|rate_limit_exceeded)$/.test(error.message) ? error.message : 'CONNECTION_CHECK_FAILED';
  console.error(`연결 확인 실패 (${code}). 키 권한·모델·Firebase 설정을 확인하세요. 기존 모드는 유지합니다.`);
  process.exitCode = 1;
} finally {
  if (firebase) { const { deleteApp } = await import('firebase-admin/app'); await deleteApp(firebase); }
}
