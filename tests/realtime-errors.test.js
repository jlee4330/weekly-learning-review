import test from 'node:test';
import assert from 'node:assert/strict';
import {realtimeError,canRetryResponse} from '../src/services/realtime-errors.js';
const failed=code=>({type:'response.done',response:{id:'r1',status:'failed',status_details:{error:{type:'server_error',code}},output:[]}});
test('nested Realtime failure causes are preserved without logging event content',()=>{
 const error=realtimeError(failed('insufficient_quota'));assert.equal(error.message,'insufficient_quota');assert.equal(error.diagnostics.responseId,'r1');assert.equal(error.diagnostics.eventType,'response.done');
 assert.equal(realtimeError({type:'error',error:{code:'invalid_request_error'}}).message,'invalid_request_error');
});
test('retry only an empty transient server response, never quota or partial speech',()=>{
 assert(canRetryResponse(failed('server_error')));assert(!canRetryResponse(failed('insufficient_quota')));
 const partial=failed('server_error');partial.response.output=[{content:[{transcript:'Already spoken'}]}];assert(!canRetryResponse(partial));
});
test('call handshake distinguishes authentication and request failures without retaining secrets',async()=>{
 const {realtimeConnectionError}=await import('../src/services/realtime-errors.js');
 for(const [status,expected] of [[401,'VOICE_SESSION_AUTH_FAILED'],[400,'VOICE_REQUEST_INVALID'],[403,'VOICE_ACCESS_DENIED'],[429,'rate_limit_exceeded']]){
  const e=await realtimeConnectionError(new Response(JSON.stringify({error:{message:'secret-value'}}),{status}));
  assert.equal(e.message,expected);assert.equal(e.diagnostics.status,status);
  assert(!JSON.stringify(e).includes('secret-value'));
 }
 const e=await realtimeConnectionError(new Response('not JSON',{status:500}));assert.equal(e.message,'CONNECTION_FAILED');
});
