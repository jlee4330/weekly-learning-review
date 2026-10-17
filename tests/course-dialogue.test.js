import test from 'node:test';
import assert from 'node:assert/strict';
import { weeks } from '../shared/questions.js';
import { conversationInstructions } from '../shared/conversation-config.js';
import { openingFor } from '../shared/course-dialogue.js';
import { realtimeSession } from '../server/realtime.js';
import { weekContent, parseSummary } from '../server/course-content.js';
import { readdirSync } from 'node:fs';

test('every available week has an explicit course-specific opening', () => {
  for (const week of weeks.filter(w=>w.reviewAvailable)) {
    const opening = openingFor(week);
    assert(opening.startsWith(`Hi! Welcome to your Week ${week.id}`));
    assert(opening.includes(week.title));
    assert.equal((opening.match(/\?/g)||[]).length,1);
  }
});
test('Week 1 dialogue uses lecture content, not the old foundation-model-only draft', () => {
  const prompt = conversationInstructions({messages:[],questions:[{objective:'WRONG DRAFT TOPIC'}]},weeks[0],weekContent(1));
  assert(prompt.includes('Bayes')); assert(prompt.includes('governance')); assert(prompt.includes('probability-based'));
  assert(prompt.includes('QUESTION GUIDE')); assert(prompt.includes('w01-q03')); assert(prompt.includes('exactly 3 questions')); assert(prompt.includes("That's the end of today's review"));
  assert(prompt.includes('NEVER state the answer')); assert(prompt.includes('Partly right')); assert(prompt.includes('Do not introduce missing answer terms')); assert(prompt.includes("Let's now move on to the next question.")); assert(!prompt.includes('2. UNDERSTAND'));
  assert(!prompt.includes('WRONG DRAFT TOPIC'));
  assert(prompt.includes('Speak English only')); assert(prompt.includes('Then WAIT for the student'));
});
test('Week 5 uses the current knowledge-augmented lecture; Realtime stays English', () => {
  assert.equal(weekContent(5).status,'lecture_and_schedule');
  assert(!weekContent(5).summary.includes('Single vs. Multi-Agent'));
  const config = realtimeSession('ko',{mode:'conversation',weekId:5,language:'ko'});
  assert.equal(config.audio.input.transcription.language,'en');
  assert(config.instructions.includes('Vector Embedding'));
  assert(!config.instructions.includes('Single vs. Multi-Agent'));
});
test('every week has a content folder with front matter and a question guide', () => {
  assert.equal(readdirSync(new URL('../content/weeks/', import.meta.url)).filter(name => name.startsWith('week-')).length, 16);
  for (const week of weeks) {
    const content = weekContent(week.id);
    assert(content.summary.startsWith(`# Week ${String(week.id).padStart(2,'0')}`));
    assert(Array.isArray(content.questions));
    for (const q of content.questions) assert(q.id && q.question && ['understand','connect','reflect'].includes(q.phase) && (!q.type || ['explain','short','open'].includes(q.type)));
  }
  assert.deepEqual(parseSummary('---\nweek: 1\nscope: a: b\n---\n# Body').meta, { week: '1', scope: 'a: b' });
});

test('released question guides require explanations and five non-answer-giving support exchanges', () => {
  for (const id of [1, 2, 3, 5]) {
    const content = weekContent(id);
    const prompt = conversationInstructions({ messages: [] }, weeks[id - 1], content);
    assert(prompt.includes('five completed hint-and-response exchanges'));
    assert(prompt.includes('The initial answer is not a hint exchange'));
    assert(prompt.includes('Keywords alone never demonstrate understanding'));
    assert(prompt.includes('For the last question, use CLOSE'));
    assert(!prompt.includes('about three hint exchanges'));
    for (const q of content.questions) {
      assert.equal(q.hints.length, 5);
      assert(q.goodEnough.includes('a list of keywords'));
    }
  }
});
