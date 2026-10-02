import {test,expect} from '@playwright/test';
test('empty server failure retries once, retains opening, and stops retrying after close',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {RealtimeConversation}=await import('/src/services/conversation-voice.js');
  const errors=[], sent=[];const v=new RealtimeConversation();
  v.onState=()=>{};v.onError=e=>errors.push(e.message);v.send=e=>sent.push(e);v.openingPending=true;v.openingInstructions='A fixed opening';
  const failed={type:'response.done',response:{status:'failed',status_details:{error:{code:'server_error'}},output:[]}};
  v.handleEvent(failed);await new Promise(r=>setTimeout(r,1150));
  v.handleEvent(failed);const beforeClose=sent.length;
  const second=new RealtimeConversation();second.onState=()=>{};second.onError=()=>{};second.send=e=>sent.push(e);second.handleEvent(failed);second.close();await new Promise(r=>setTimeout(r,1150));v.close();
  return {errors,sent,beforeClose};
 });
 expect(result.errors).toEqual(['server_error']);expect(result.sent).toHaveLength(1);expect(result.sent[0].response.instructions).toBe('A fixed opening');
});
