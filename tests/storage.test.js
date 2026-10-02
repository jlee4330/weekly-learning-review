import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalStore } from "../server/storage.js";
import { allowLocalRequest } from "../server/local-access.js";

test("local storage serializes updates, survives restart, and keeps evaluation private", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wlr-store-"));
  try {
    const file = join(dir, "reviews.json"), store = createLocalStore(file);
    await store.create({ id: "one", studentId: "alice", count: 0 });
    await store.create({ id: "two", studentId: "bob" });
    await Promise.all(Array.from({ length: 12 }, () => store.mutate("one", s => ({ ...s, count: s.count + 1 }))));
    await store.saveEvaluation("one", { score: 3, evidence: "private" });
    const reopened = createLocalStore(file);
    assert.equal((await reopened.get("one")).count, 12);
    assert.deepEqual((await reopened.list("alice")).map(s => s.id), ["one"]);
    assert.equal((await reopened.get("one")).score, undefined);
    assert.equal((await reopened.getEvaluation("one")).score, 3);
    await assert.rejects(store.mutate("one", () => { throw Error("FAILED"); }));
    await store.mutate("one", s => ({ ...s, draft: "preserved" }));
    assert.equal((await reopened.get("one")).draft, "preserved");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("local API rejects remote hosts, cross-origin calls and missing client headers", () => {
  const req = { socket: { remoteAddress: "127.0.0.1" }, headers: { host: "localhost:5174", origin: "http://localhost:5174", "x-review-client": "browser" } };
  assert.equal(allowLocalRequest(req), true);
  for (const headers of [
    { ...req.headers, origin: "https://example.com" },
    { ...req.headers, host: "example.com", origin: "https://example.com" },
    { ...req.headers, "x-review-client": undefined },
    { ...req.headers, origin: "http://localhost:9999" },
  ]) assert.equal(allowLocalRequest({ ...req, headers }), false);
  assert.equal(allowLocalRequest({ ...req, socket: { remoteAddress: "10.0.0.2" } }), false);
});

import { sessionKey } from "../server/storage.js";
test("session IDs carry the student key used for students/{key}/reviewSessions", () => {
  assert.equal(sessionKey("20261234~3f1c-uuid"), "20261234");
  assert.equal(sessionKey("plain-uuid"), null);
});

import { packSession, unpackSession } from "../server/storage.js";
test("Firestore stores only owner, week, status, times and messages; fixed values return on read", () => {
  const session = { id: "k~1", studentId: "uid", weekId: 1, status: "completed", messages: [{ id: "m", text: "hi" }], createdAt: "c", updatedAt: "u", completedAt: "d",
    mode: "conversation", language: "en", courseId: "id40018-2026", conversationVersion: "conversation-2", courseContextVersion: "v", rubricVersion: "r", evaluationStatus: "pending" };
  const stored = packSession(session);
  assert.deepEqual(Object.keys(stored).sort(), ["completedAt", "createdAt", "messages", "status", "studentId", "updatedAt", "weekId"]);
  const read = unpackSession("k~1", stored, "id40018-2026");
  assert.equal(read.id, "k~1"); assert.equal(read.mode, "conversation"); assert.equal(read.status, "completed"); assert.deepEqual(read.messages, session.messages);
});
