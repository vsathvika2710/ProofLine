# ProofLine update & cleanup notes

## Changes in this package
- Change Impact Graph now renders from the actual `ChangeImpactResult`; it no longer presents a hardcoded warranty graph for every simulation.
- Impact result lists show the computed claim, reason, suggested correction, and checked/unaffected assets.
- The dashboard simulation captures fact/value inputs before its visual delay, so demo actions do not depend on stale React state.
- Commit is blocked until the current selected fact/value has a matching simulation result; it is also blocked after that fact has already been changed by the commit.
- Generic exact-text fallback detection is added for facts without a dedicated detector. This is explicitly not semantic matching.
- Analytics cards now show counts derived from the current demo workspace. Unsupported health, savings, telemetry, and survey KPI claims were removed from this view.
- Scenario switching resets review tasks and audit logs to the scenario demo baseline rather than carrying state across scenarios.
- Removed unused Vite starter SVGs and unused image/icon assets after confirming no source references.

## Important remaining limitations
- This is still a demo/prototype. The impact detector uses hardcoded patterns plus exact old-value text matching; it is not a general semantic dependency engine.
- Frontend state is not durable storage. Backend persistence/authentication hardening remains outstanding.
- The full frontend build could not be verified in this environment because dependency installation timed out and the local `node_modules` was incomplete (`vite/client` and Node type definitions unavailable).
- Run `npm ci` and `npm run build` locally before submitting. Also test the main demo flow, scenario switching, scanning, review approve/reject, and refresh persistence.
