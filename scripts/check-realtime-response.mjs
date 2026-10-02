// Opt-in real OpenAI smoke test. Isolated local store; Firebase mirroring disabled.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
const dir=await mkdtemp(join(tmpdir(),'wlr-voice-'));
const api=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'3195',REVIEW_STORAGE:'local',REVIEW_AUTH:'none',TRANSCRIPT_FIREBASE_CREDENTIALS:'',REVIEW_DATA_FILE:join(dir,'reviews.json')},stdio:['ignore','pipe','pipe']});
let vite,browser;
try {
 await once(api.stdout,'data');process.env.REVIEW_API_PORT='3195';process.env.VITE_MODE='local';process.env.VITE_AUTH_PROVIDER='none';
 vite=await createServer({server:{host:'127.0.0.1',port:5195,strictPort:true},logLevel:'silent'});await vite.listen();
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});const page=await browser.newPage();await page.goto('http://127.0.0.1:5195');
 await page.evaluate(async()=>{
  const {repository}=await import('/src/services/api.js');const {RealtimeConversation}=await import('/src/services/conversation-voice.js');
  const session=await repository.create(1,'en');window.voiceCheck={events:[],errors:[],texts:[]};
  const v=new RealtimeConversation();window.checkVoice=v;
  const handle=v.handleEvent.bind(v);v.handleEvent=e=>{if(e.type==='response.done')window.voiceCheck.events.push({status:e.response.status,code:e.response.status_details?.error?.code,type:e.response.status_details?.error?.type});handle(e);};
  await v.begin(session,{onMessage:m=>{if(m.complete)window.voiceCheck.texts.push(m.text);},onState:state=>{window.voiceCheck.state=state;},onError:e=>{window.voiceCheck.errors.push(e.diagnostics||{code:e.message});}});
 });
 await page.waitForFunction(()=>window.voiceCheck.errors.length || (window.voiceCheck.texts.length && window.voiceCheck.state==='listening'),{},{timeout:60000});
 const result=await page.evaluate(()=>({events:window.voiceCheck.events,errors:window.voiceCheck.errors,completedUtterances:window.voiceCheck.texts.length}));console.log(JSON.stringify(result));
 if(result.errors.length)process.exitCode=1;
 await page.evaluate(()=>window.checkVoice.close());
} finally {await browser?.close();await vite?.close();api.kill();await rm(dir,{recursive:true,force:true});}
