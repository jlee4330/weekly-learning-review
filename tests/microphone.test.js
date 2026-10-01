import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inputLevel} from '../src/services/microphone.js';
test('microphone meter is silent at zero and increases with RMS amplitude',()=>{assert.equal(inputLevel(new Float32Array(64)),0);const low=inputLevel(new Float32Array(64).fill(.01));const high=inputLevel(new Float32Array(64).fill(.1));assert.ok(low>0&&high>low&&high<=1);assert.equal(inputLevel([1,-1]),1);assert.equal(inputLevel([]),0)});
