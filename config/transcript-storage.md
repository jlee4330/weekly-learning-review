# Weekly Learning Review — Firestore transcript destination

Project: **id40018-7e359**. Public web configuration: `review-firebase.json`.
Authentication remains on **id400018-ddasd** (`course-auth.json`), so existing students use their course accounts. The backend verifies that project's identity token, then writes to the new project using server credentials. The new project does not need a duplicate student account for this arrangement.

## Documents

- `students/{verifiedFirebaseUid}` — UID, email, student ID derived from the email, last activity.
- `students/{verifiedFirebaseUid}/weeklyTranscripts/week-02` — latest saved conversation for that week.
- `students/{verifiedFirebaseUid}/weeklyTranscripts/week-02/sessions/{sessionId}` — separate session records, so another review does not remove the prior session.

Transcripts retain speaker, message ID, order, revision, completion/interruption state and timestamps, plus session/week/language/content/rubric versions and student feedback. The existing backend enforces session ownership; browser clients do not write these documents directly. Raw audio and passwords are not stored here. Instructor-only evaluation evidence remains in the review store.

## Required before any cloud write

1. In the Firebase console for `id40018-7e359`, create a **Cloud Firestore** database if it does not exist. Use locked/production rules (the Admin SDK writes on the server).
2. Project settings → Service accounts → Generate new private key. Save the downloaded JSON **outside this repository**.
3. Set `TRANSCRIPT_FIREBASE_CREDENTIALS=/absolute/path/to/the-file.json` in the local `.env`. The project ID is already configured. Do not put credential contents in chat, this public JSON, or a `VITE_` variable.
4. Run `node --env-file=.env scripts/check-transcript-storage.mjs --write`. This writes, reads and deletes one isolated `_connectionChecks` document; it does not read student data.
5. Restart `npm run server`. New transcript updates, completion and feedback are mirrored into Firestore.

The Firebase web API key is public application configuration, not permission for Admin writes. No Analytics SDK was enabled because analytics is not needed to save transcripts.

## Current boundary

The runtime still uses the existing local review store and mirrors it to the configured Firestore destination when credentials are available. Mirror writes are serialized for each student/week to prevent older snapshots overtaking newer writes. A failed mirror is logged; it does not turn a local save into a successful cloud save. There is no durable cloud retry queue or automatic backfill of previous local records. On 2026-10-02, real Firestore write/read/delete checks passed for project id40018-7e359. The actual transcript writer was also verified for student UID, week and session paths, incremental transcript updates and completion status. All synthetic test documents were deleted. The running API server was restarted with mirroring enabled.
