# Weekly Learning Review — Firestore transcript destination

Target project: **id40018ddasd**. Firestore database ID: **id40018** (`nam5`). Public web configuration: `review-firebase.json`.
Authentication remains on **id400018-ddasd** (`course-auth.json`), so existing students use their course accounts. The backend verifies that project's identity token, then writes to the new project using server credentials. The new project does not need a duplicate student account for this arrangement.

## Documents

- `students/{verifiedFirebaseUid}` — UID, email, student ID derived from the email, last activity.
- `students/{verifiedFirebaseUid}/weeklyTranscripts/week-02` — latest saved conversation for that week.
- `students/{verifiedFirebaseUid}/weeklyTranscripts/week-02/sessions/{sessionId}` — separate session records, so another review does not remove the prior session.

Transcripts retain speaker, message ID, order, revision, completion/interruption state and timestamps, plus session/week/language/content/rubric versions and student feedback. The existing backend enforces session ownership; browser clients do not write these documents directly. Raw audio is stored separately in Firebase Storage only after the student opts in on the start screen. Passwords are not stored here. Instructor-only evaluation evidence remains in the review store.

## Required before any cloud write

1. In the Firebase console for `id40018ddasd`, select the existing **Cloud Firestore** database `id40018`. Use locked/production rules (the Admin SDK writes on the server).
2. Project settings → Service accounts → Generate new private key. Save the downloaded JSON **outside this repository**.
3. Set `TRANSCRIPT_FIREBASE_CREDENTIALS=/absolute/path/to/the-file.json` in the local `.env`. Set `FIREBASE_PROJECT_ID` and `TRANSCRIPT_FIREBASE_PROJECT_ID` to `id40018ddasd` and `FIRESTORE_DATABASE_ID=id40018` when installing the matching server credential. Do not put credential contents in chat, this public JSON, or a `VITE_` variable.
4. Run `node --env-file=.env scripts/check-transcript-storage.mjs --write`. This writes, reads and deletes one isolated `_connectionChecks` document; it does not read student data.
5. Restart `npm run server`. New transcript updates, completion and feedback are mirrored into Firestore.

The Firebase web API key is public application configuration, not permission for Admin writes. No Analytics SDK was enabled because analytics is not needed to save transcripts.

## Current boundary

The runtime still uses the existing local review store and mirrors it to the configured Firestore destination when credentials are available. Mirror writes are serialized for each student/week to prevent older snapshots overtaking newer writes. A failed mirror is logged; it does not turn a local save into a successful cloud save. There is no durable cloud retry queue or automatic backfill of previous local records. On 2026-10-02, real Firestore write/read/delete checks passed for project id40018-7e359. The actual transcript writer was also verified for student UID, week and session paths, incremental transcript updates and completion status. All synthetic test documents were deleted. The running API server was restarted with mirroring enabled.

## Conversation voice recordings

The optional consent checkbox defaults to unchecked on every visit to the start screen. The session records `audioConsent` and `audioConsentAt`. Without consent, no audio archive recorder or upload is started; transcript saving continues normally.

Consented student microphone audio and remote agent audio, mixed into one stream with Web Audio is saved through the authenticated, owner-checked `POST /api/sessions/:id/audio` route to `students/{studentId}/Week{N}/{startedAt}.webm` (or `.m4a`) in the configured Firebase Storage bucket. Each approximately five-minute part is a self-contained recording at a requested 48 kbps; the browser and server enforce a 4 MiB maximum. Pausing closes the current part and resuming starts a new one. End and connection errors flush the remaining audio. Restart/back discard pending audio and wait for in-flight uploads before deleting the week's files. A tab close can lose the last unfinished part. Recording/upload failures show a separate notice and do not block transcript completion. There is no durable retry queue.

A provisioned Storage bucket and working Admin credentials are required; check the project's Blaze/Storage setup separately. The demo upload method is a no-op. The archive mixer is never connected to speakers or sent back to WebRTC. It is released when the conversation closes. Microphone tests and temporary student-only playback clips are not uploaded. Physical speaker sound picked up by the microphone may still be present; headphones reduce this.

Earlier validation on 2026-10-11 against the previous project returned a missing-bucket error. This was resolved by the project switch verified below. Browser-generated WebM parts decoded successfully; unit/API and browser tests passed.

## Project switch status (2026-10-11)

The public configuration and local `.env` now target `id40018ddasd`, with bucket `id40018ddasd.firebasestorage.app` in `us-east1`. Course login remains on `id400018-ddasd`. The new service account is installed in the git-ignored `secrets/` directory with owner-only file permissions. The local `.env.vercel` file has also been updated, but hosted Vercel environment variables and deployment have not been changed.

Storage verification succeeded: uploaded a browser-generated 4,160-byte WebM with two synthetic tones, downloaded it and compared the bytes, then deleted it and verified deletion. No student audio was used.

Firestore uses the existing named database `id40018` in `nam5`, not `(default)`. Both session storage and transcript mirroring, as well as the connection-check script, now honor `FIRESTORE_DATABASE_ID`. The earlier 404 only applied to `(default)`; no new database is needed. A synthetic write/read/delete probe passed, and the real transcript writer passed save/read/clear/remove checks. All synthetic documents were removed. The local app retains its local review store and mirrors completed transcripts into this named cloud database. The local `.env.vercel` also sets the database ID; the hosted deployment still needs these environment updates.

Existing records in the previous project are not automatically migrated. Analytics has not been enabled.
