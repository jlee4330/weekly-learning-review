import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as netServer } from 'node:net';
import { createServer } from 'vite';

async function freePort() {
  const server = netServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('browser requests through the real Vite proxy can save drafts while other origins stay blocked', { timeout: 20000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wlr-proxy-'));
  const port = await freePort();
  let vite;
  const oldPort = process.env.REVIEW_API_PORT;
  const api = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, NODE_ENV: 'test', REVIEW_STORAGE: 'local', REVIEW_DATA_FILE: join(dir, 'reviews.json'), PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await Promise.race([
      once(api.stdout, 'data'),
      once(api, 'exit').then(([code]) => { throw Error(`API exited: ${code}`); }),
    ]);
    process.env.REVIEW_API_PORT = String(port);
    vite = await createServer({ server: { port: await freePort(), host: '127.0.0.1', strictPort: true }, logLevel: 'silent' });
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    const headers = { Origin: origin, 'X-Review-Client': 'browser', 'Content-Type': 'application/json' };
    const created = await fetch(`${origin}/api/sessions`, { method: 'POST', headers, body: JSON.stringify({ weekId: 1, language: 'en' }) });
    assert.equal(created.status, 200);
    const session = await created.json();
    const saved = await fetch(`${origin}/api/sessions/${session.id}/draft`, { method: 'POST', headers, body: JSON.stringify({ text: 'This answer must survive a reload.' }) });
    assert.equal(saved.status, 200);
    const sessions = await (await fetch(`${origin}/api/sessions`, { headers })).json();
    assert.equal(sessions[0].draft, 'This answer must survive a reload.');
    for (const badHeaders of [{ ...headers, Origin: 'https://example.com' }, { Origin: origin }]) {
      const denied = await fetch(`${origin}/api/sessions`, { headers: badHeaders });
      assert.equal(denied.status, 403);
    }
  } finally {
    if (oldPort === undefined) delete process.env.REVIEW_API_PORT;
    else process.env.REVIEW_API_PORT = oldPort;
    await vite?.close();
    if (api.exitCode === null) { api.kill(); await once(api, 'exit'); }
    await rm(dir, { recursive: true, force: true });
  }
});
