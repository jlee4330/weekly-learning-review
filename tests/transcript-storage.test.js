import test from 'node:test';
import assert from 'node:assert/strict';
import storage from '../config/review-firebase.json' with {type:'json'};
import login from '../config/course-auth.json' with {type:'json'};
test('transcript destination is separate from the existing course login project', () => {
 assert.equal(storage.firebase.projectId,'id40018-7e359');
 assert.equal(login.firebase.projectId,'id400018-ddasd');
});
