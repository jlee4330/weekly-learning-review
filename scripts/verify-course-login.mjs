// UI/error-path and unauthenticated API checks; no real student's credentials are used.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const dir = await mkdtemp(join(tmpdir(),'wlr-login-'));
const api = spawn(process.execPath,['server/index.js'],{env:{...process.env,REVIEW_STORAGE:'local',REVIEW_AUTH:'firebase',REVIEW_DATA_FILE:join(dir,'reviews.json'),PORT:'3194'},stdio:['ignore','pipe','pipe']});
let vite,browser;
try {
  await once(api.stdout,'data');
  process.env.VITE_MODE='local'; process.env.VITE_AUTH_PROVIDER='firebase'; process.env.REVIEW_API_PORT='3194';
  vite=await createServer({server:{host:'127.0.0.1',port:5194,strictPort:true},logLevel:'silent'}); await vite.listen();
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
  let requestedEmail;
  await page.route('https://identitytoolkit.googleapis.com/**',async route=>{
    requestedEmail=route.request().postDataJSON()?.email;
    await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{code:400,message:'INVALID_LOGIN_CREDENTIALS'}})});
  });
  await page.goto('http://127.0.0.1:5194');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Student ID or email').fill('20260000');
  await page.getByLabel('Password',{exact:true}).fill('test-only-not-a-real-password');
  await page.getByRole('dialog').getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Check your student ID or email'}).waitFor();
  assert.equal(requestedEmail,'20260000@kaist.ac.kr');
  assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');
  await page.screenshot({path:'tests/screenshots/course-login.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const token of [null,'invalid.token.value']) {
    const r=await page.request.get('http://127.0.0.1:5194/api/sessions',{headers:{'X-Review-Client':'browser',...(token?{Authorization:`Bearer ${token}`}:{})}});
    assert.equal(r.status(),401);
  }
  console.log('Login form, student ID conversion, invalid-credential handling, mobile layout, and API token rejection passed. Real account sign-in not attempted.');
} finally {await browser?.close();await vite?.close();api.kill();await rm(dir,{recursive:true,force:true});}
