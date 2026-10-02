# Course account connection

`course-auth.json` contains the existing course site's **public Firebase web configuration**, copied from `dasd2026/src/firebase.js`. It contains no student list, passwords, password hashes, OpenAI keys, or server credentials.

- Firebase project: `id400018-ddasd`.
- Provider: email/password, matching the existing course site.
- A student ID becomes `<studentId>@kaist.ac.kr`; a full email is used as entered (normalized to lowercase).
- Students sign in with their existing course password. Accounts are shared through Firebase Auth; existing browser login state is not automatically shared across different website origins.
- Account creation/password recovery remain on the course site. No test accounts are created by this project.

Current local configuration: `VITE_MODE=local`, `REVIEW_STORAGE=local`, `VITE_AUTH_PROVIDER=firebase`, `REVIEW_AUTH=firebase`. The UI sends a Firebase ID token and the loopback-only API verifies its signature, expiry, issuer and project audience. Records are owned and filtered by verified Firebase UID. Previously anonymous `local-student` records are not assigned to a signed-in student automatically.

The local server verifies ID tokens using Firebase's public signing certificates with an explicit project ID. It does not administer Firebase users, read the course student collection, or access Firestore. It does not perform the Admin account-revocation lookup; an already issued token may remain valid until expiry. Cloud mode retains Admin revocation checks and requires server credentials plus course membership.

The current course website allows students to update their own profile document. Its `role` field is **not** used to grant review instructor access. Instructor access requires server-issued custom claims.

To use Firestore later, configure Admin credentials and membership separately. **Do not deploy this project's standalone deny-all Firestore rules over the existing course project's rules.** This login integration does not require changing existing Firebase rules or data.

Verification: `node --env-file=.env scripts/verify-course-login.mjs` checks the login UI, ID conversion, rejected-credential handling, small-screen layout, and rejection of absent/invalid API tokens. Firebase login responses are intercepted for the error-path UI test; it does not claim a real student sign-in succeeded.

Reference: https://firebase.google.com/docs/auth/admin/verify-id-tokens
