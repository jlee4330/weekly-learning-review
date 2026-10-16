# Firebase cutover — 2026-10-17 (KST)

## Completed

- Copied student records from `id40018-7e359/(default)` to `id40018ddasd/id40018`.
- Source: 88 existing documents (student profiles and weekly records). Target after migration: 88 documents.
- 55 documents copied/updated and read back with exact Firestore field comparison; 32 already identical; one newer target profile preserved. Source documents were not changed or deleted.
- Week 1: 32 sessions, 30 completed with transcripts (359 messages).
- Week 2: 25 sessions, 24 completed with transcripts (484 messages), one in progress.
- Private before/after backups and migration plan: `.data/migrations/2026-10-16T18-26-44-305Z/`. This directory is ignored by Git and excluded from deployment.
- The dashboard reads every week from the configured DB. The local UI adds a student-by-week overview, including missing records and saved transcript counts; student details retain every week's transcript.

## Production environment

Use the local, Git-ignored **`.env.vercel`**, not `.env` (which runs local storage). It contains the actual service-account JSON and API keys; keep it private.

| Variable | Value |
| --- | --- |
| `VITE_MODE` | `live` |
| `REVIEW_STORAGE` | `firebase` |
| `FIREBASE_PROJECT_ID` | `id40018ddasd` |
| `TRANSCRIPT_FIREBASE_PROJECT_ID` | `id40018ddasd` |
| `FIRESTORE_DATABASE_ID` | `id40018` |
| `AUDIO_STORAGE_BUCKET` | `id40018ddasd.firebasestorage.app` |
| `FIREBASE_SERVICE_ACCOUNT` | New project's full JSON, already included in the private file |
| `COURSE_AUTH_PROJECT_ID` / `VITE_FIREBASE_PROJECT_ID` | `id400018-ddasd` (existing student login project) |
| `UNLOCKED_WEEKS` / `VITE_UNLOCKED_WEEKS` | `1,2` |

The file also preserves the OpenAI configuration and dashboard access key. The different login project is intentional. Do not replace it with the data project.

In the Vercel project's Settings → Environment Variables, import the file or paste its contents into the environment-variable editor. Apply to **Production**, updating existing keys with the same names. Remove obsolete `GOOGLE_APPLICATION_CREDENTIALS` and `TRANSCRIPT_FIREBASE_CREDENTIALS` entries if present: local filesystem paths do not work on Vercel.

Then deploy the updated source containing the dashboard changes. Redeploying an old commit only changes environment values; it does not include the local dashboard edits. No production settings, Git push, or production deployment was performed in this migration task.

Environment-variable changes require a new deployment: [Vercel documentation](https://vercel.com/docs/environment-variables/managing-environment-variables).

## Final synchronization and verification

Until the new deployment serves production, students can still save to the old DB. Coordinate the cutover outside active review sessions; allow old sessions to finish. Run the migration again immediately before the cutover and once after old requests have finished to capture late writes. The script copies missing/newer records, preserves newer target records, and stops before writing on ambiguous equal-timestamp conflicts. It does not propagate deletions; inspect deliberate reset/deletion cases during the overlap instead of blindly restoring them.

From the repository directory:

```sh
MIGRATION_SOURCE_CREDENTIALS=/absolute/path/to/old-service-account.json node --env-file=.env scripts/migrate-review-data.mjs
MIGRATION_SOURCE_CREDENTIALS=/absolute/path/to/old-service-account.json node --env-file=.env scripts/migrate-review-data.mjs --apply
```

Each run creates a separate private backup. Target writes use update-time/existence preconditions and a single atomic commit to avoid overwriting a document changed during the migration.

After deployment, verify that the production dashboard shows both weeks, and a consented test review saves its transcript and audio in the new project. Do not delete the old project yet. Audio missing from the old project cannot be recovered by copying Firestore documents; the four existing new-bucket files were left untouched.
