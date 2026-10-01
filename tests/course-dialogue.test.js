import test from 'node:test';
import assert from 'node:assert/strict';
import { weeks } from '../shared/questions.js';
import { conversationInstructions } from '../shared/conversation-config.js';
import { openingFor } from '../shared/course-dialogue.js';
import { realtimeSession } from '../server/realtime.js';
import context from '../server/course-context.json' with {type:'json'};

test('every available week has an explicit course-specific opening', () => {
  for (const week of weeks.filter(w=>w.reviewAvailable)) {
    const opening = openingFor(week);
    assert(opening.startsWith(`Hi! Welcome to your Week ${week.id}`));
    assert(opening.includes(week.title));
    assert.equal((opening.match(/\?/g)||[]).length,1);
  }
});
test('Week 1 dialogue uses lecture content, not the old foundation-model-only draft', () => {
  const prompt = conversationInstructions({messages:[],questions:[{objective:'WRONG DRAFT TOPIC'}]},weeks[0],context.weeks[1]);
  assert(prompt.includes('Bayes')); assert(prompt.includes('governance')); assert(prompt.includes('Probability-Based'));
  assert(!prompt.includes('WRONG DRAFT TOPIC'));
  assert(prompt.includes('Speak English only')); assert(prompt.includes('Then WAIT for the student'));
});
test('mismatched lecture weeks are not mixed into scheduled topics; Realtime stays English', () => {
  assert.equal(context.weeks[4].detailStatus,'schedule_only_lecture_week_mismatch');
  assert.equal(context.weeks[4].topics.length,0);
  const config = realtimeSession('ko',{mode:'conversation',weekId:4,language:'ko'});
  assert.equal(config.audio.input.transcription.language,'en');
  assert(config.instructions.includes('Vector Embedding'));
  assert(!config.instructions.includes('Single vs. Multi-Agent'));
});
