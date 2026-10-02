// Opt-in live integration check. Uses a temporary database and real OpenAI calls.
// node --env-file=.env scripts/verify-conversation.mjs /absolute/path/to/spoken-answer.wav
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { openingFor } from '../shared/course-dialogue.js';
import { weekContent } from '../server/course-content.js';
import { weeks } from '../shared/questions.js';
const weekId = Number(process.argv[3] || 1);
const selectedWeek = weeks.find(w => w.id === weekId && w.reviewAvailable);
assert(selectedWeek, 'Choose a week with a review');
const dir = await mkdtemp(join(tmpdir(),'wlr-conversation-'));
const api = spawn(process.execPath,['server/index.js'],{env:{...process.env,REVIEW_AUTH:'none',PORT:'3193',REVIEW_STORAGE:'local',REVIEW_DATA_FILE:join(dir,'reviews.json')},stdio:['ignore','pipe','pipe']});
let vite, browser, page;
try {
  await once(api.stdout,'data');
  process.env.VITE_AUTH_PROVIDER='none'; process.env.REVIEW_API_PORT='3193'; process.env.VITE_MODE='local';
  vite = await createServer({server:{host:'127.0.0.1',port:5193,strictPort:true},logLevel:'silent'}); await vite.listen();
  browser = await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  page = await browser.newPage();
  const failures=[]; page.on('pageerror',e=>failures.push(e.message));
  await page.route('**/fixture.wav',async route=>route.fulfill({contentType:'audio/wav',body:await readFile(process.argv[2])}));
  // Only microphone input is synthetic; all API requests go through the real proxy.
  await page.addInitScript(() => {
    window.voiceEvents = [];
    const original = RTCPeerConnection.prototype.createDataChannel;
    RTCPeerConnection.prototype.createDataChannel = function(...args) { window.testPeer = this; const dc = original.apply(this,args); dc.addEventListener('message', event => { const e = JSON.parse(event.data); if (!e.type.endsWith('.delta')) window.voiceEvents.push({type:e.type,code:e.error?.code, message:e.error?.message}); }); return dc; };
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext(); await context.resume();
      const destination = context.createMediaStreamDestination();
      const clock = context.createOscillator(), silence = context.createGain(); silence.gain.value = 0.000001; clock.connect(silence); silence.connect(destination); clock.start();
      window.speakFixture = async () => { const bytes = await (await fetch('/fixture.wav')).arrayBuffer(); const buffer = await context.decodeAudioData(bytes); const source = context.createBufferSource(); source.buffer=buffer; source.connect(destination); source.start(); };
      return destination.stream;
    };
  });
  await page.goto('http://127.0.0.1:5193');
  await page.locator('.week-row').filter({hasText:selectedWeek.title}).getByRole('button',{name:'Start review',exact:true}).click();
  await page.getByRole('button',{name:'Test microphone',exact:true}).click();
  await page.getByRole('button',{name:'Start conversation',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.agent-utterance h1')?.textContent.length>60,{},{timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.voice-status')?.textContent.includes('I’m listening'),{},{timeout:45000});
  await page.evaluate(()=>window.speakFixture());
  await page.waitForFunction(()=>Number(document.querySelector('.continuous-wave')?.getAttribute('aria-valuenow'))>10,{},{timeout:15000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.conversation-history strong')].some(e=>e.textContent==='You'),{},{timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('.conversation-history .transcript-turn').length>=3,{},{timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.voice-status')?.textContent.includes('I’m listening'),{},{timeout:45000});
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.waitForSelector('audio[controls]');
  await page.locator('audio[controls]').evaluate(audio => audio.play());
  await page.waitForFunction(()=>document.querySelector('audio[controls]')?.currentTime > 0);
  await page.locator('audio[controls]').evaluate(audio => audio.pause());
  await page.screenshot({path:'tests/screenshots/continuous-conversation.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path:'tests/screenshots/continuous-conversation-mobile.png',fullPage:true});
  // Leave mid-conversation: wait for the transcript to save, then return to the list.
  await page.waitForFunction(()=>document.querySelector('.conversation-history summary small')?.textContent === 'Saved',{},{timeout:15000});
  await page.goto(page.url().split('#')[0]);
  await page.getByRole('button',{name:'Continue review',exact:true}).click();
  await page.getByRole('button',{name:'Test microphone',exact:true}).click();
  await page.getByRole('button',{name:'Continue conversation',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.conversation-history .transcript-turn').length>=4,{},{timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.voice-status')?.textContent.includes('I’m listening'),{},{timeout:45000});
  assert.equal(await page.getByRole('alert').count(),0);
  await page.getByRole('button',{name:'End conversation',exact:true}).click();
  await page.waitForSelector('.done-banner',{timeout:90000});
  const data = JSON.parse(await readFile(join(dir,'reviews.json'),'utf8'));
  const records = Object.values(data.sessions); const s = records[0];
  assert.equal(s.language,'en'); assert.equal(s.courseContextVersion, weekContent(s.weekId).version);
  const normalize = text => text.toLowerCase().replace(/[^a-z0-9]/g,'');
  assert.equal(normalize(s.messages.find(m=>m.role==='assistant').text), normalize(openingFor(selectedWeek)));
  assert.equal(s.status,'completed'); assert.equal(s.mode,'conversation'); assert(s.messages.filter(m=>m.role==='assistant').length>=2); assert(s.messages.some(m=>m.role==='student'&&m.complete)); assert.equal(failures.length,0,failures.join('\n'));
  console.log(JSON.stringify({completed:true,weekId:s.weekId,messages:s.messages.length,feedback:s.evaluationStatus,consoleErrors:failures.length,followup:s.messages.filter(m=>m.role==='assistant')[1]?.text}));
} catch (error) {
  if (page) { console.log(await page.evaluate(() => ({events:window.voiceEvents,alerts:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent), state:document.querySelector('.voice-status')?.textContent}))); await page.screenshot({path:'tests/screenshots/conversation-error.png',fullPage:true}); }
  throw error;
} finally { await browser?.close(); await vite?.close(); api.kill(); await rm(dir,{recursive:true,force:true}); }
