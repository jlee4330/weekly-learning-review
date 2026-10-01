import test from 'node:test';
import assert from 'node:assert/strict';
import { asConversation, mergeMessages, completeConversation } from '../shared/conversation.js';
import { validateEvidence } from '../server/evaluation.js';
const base = () => asConversation({ turns: [], status: 'in_progress' });
const msg = { id:'student-1', role:'student', text:'Models can produce mistakes.', order:1, revision:2, complete:true, createdAt:'2026-10-01T00:00:00.000Z' };
test('streamed messages deduplicate and stale drafts never overwrite final speech', () => {
  const s = mergeMessages(base(), [msg, {...msg, revision:1, text:'Models'}]);
  assert.equal(s.messages.length,1); assert.equal(s.messages[0].text,msg.text);
  assert.equal(mergeMessages(s,[{...msg,revision:3,complete:false,text:'partial'}]).messages[0].complete,true);
  assert.throws(() => mergeMessages(s,[{...msg,role:'assistant',revision:4}]),/ROLE_CHANGED/);
  assert.equal(completeConversation(s).evaluationStatus,'pending');
  assert.throws(() => completeConversation(mergeMessages(base(),[{...msg,role:'assistant'}])),/NO_STUDENT/);
});
test('whole conversation evaluation only accepts complete student evidence', () => {
  const s = mergeMessages(base(),[msg,{...msg,id:'agent',role:'assistant',order:0}]);
  const result = { criteria:['accuracy','reasoning','application','tradeoffs'].map(criterion => ({ questionId:'conversation',criterion,status:'not_assessed',score:null,evidence:[] })) };
  result.criteria[0] = {...result.criteria[0],status:'assessed',score:3,evidence:[{turnId:msg.id,quote:'produce mistakes'}]};
  validateEvidence(result,s);
  result.criteria[0].evidence[0].turnId='agent';
  assert.throws(() => validateEvidence(result,s),/INVALID_EVIDENCE/);
});
