# Speaking Practice private beta

The beta is disabled by default. Enable each part only after its release evidence has been recorded. Full MockTest is outside this rollout.

## Configuration

- `SPEAKING_BETA_ENABLED=true`
- `SPEAKING_BETA_LEARNER_IDS`: comma-separated invited learner IDs.
- `SPEAKING_BETA_PARTS`: comma-separated canonical scopes; initially `part_1` only.
- `SPEAKING_BETA_CONCURRENT_LIMIT=1`
- `SPEAKING_BETA_DAILY_LIMIT=5` (UTC calendar day).
- `GEMINI_BETA_API_KEY`: one project credential, server only.
- `DATABASE_URL` and configured durable S3 storage are required.

An ephemeral token admits one provider conversation. Reconnection reuses the token and resumption handle. Do not refresh the page to recover an active practice; save available audio and start a new practice. Interrupted recordings are retained locally until upload succeeds or the learner leaves the page.

## Automated verification

Run `bun run test:speaking:integration` with `SPEAKING_TEST_DATABASE_URL` naming an isolated database ending in `_test`. This applies migrations and verifies all scopes, concurrent finishes, immutable evidence, and transactional rollback.

Run `RUN_GEMINI_LIVE_SMOKE=true bun run test:speaking:live` with the single beta credential for the opt-in provider handshake, audio, transcript, and forced resumption check. Set `GEMINI_LIVE_SOAK_MS=660000` on that command for the eleven-minute connection-duration exercise with GoAway recovery. Ordinary tests never need this credential.

Run the complete gate in `docs/agents/testing.md` before release.

## Supervised release evidence

For each part, record five consecutive supervised sessions, including browser/version, date, completion, evidence persistence, feedback inspection, and interruption/reconnection results. Record one live connection-duration exercise exceeding ten minutes, microphone input/transcription, and a forced network outage. Never place raw learner audio or transcripts in release logs.

Verify adult consent precedes microphone access, teacher/other-learner denial, deletion, audio expiry, abandoned cleanup, and blocked uninvited access. Check the actual Google project quota before inviting learners; the application limit does not guarantee provider capacity.

Enable Part 1, then Part 2, then Part 3 only after those gates pass. Disable affected entries in `SPEAKING_BETA_PARTS` to stop new starts while retaining existing results and evaluation retries. Do not claim public production readiness from automated tests alone.
