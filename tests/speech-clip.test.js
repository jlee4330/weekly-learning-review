import test from "node:test";
import assert from "node:assert/strict";
import { speechWindows } from "../src/services/speech-clip.js";

test("speech windows are padded, clamped and merged", () => {
  assert.deepEqual(speechWindows([{ start: 0.3, end: 2 }, { start: 2.4, end: 3 }, { start: 8, end: 9 }], 9.2), [[0, 3.5], [7.2, 9.2]]);
});

test("an utterance still open at pause runs to the end; no speech yields nothing", () => {
  assert.deepEqual(speechWindows([{ start: 5 }], 6), [[4.2, 6]]);
  assert.deepEqual(speechWindows([], 6), []);
});
