# 01 — Provider Control Orchestrator

**What to build:** Add a deep module that owns provider list, selected provider, health / smoke / model state, busy state and errors. Views and modal consume snapshot and commands through injected adapters.

**Blocked by:** None

**Status:** completed

- [x] `ProviderControlOrchestrator` snapshot / subscribe / command surface
- [x] `db.ts` adapter keeps Rust and browser fallback semantics in one place
- [x] `activeProviderFromSnapshot` prevents disabled providers from entering live workflows
- [x] Unit tests for selection, profile editing, lab state and active-provider fallback

## Comments

Review round 1: explicit `providerType` and active-provider routing were tightened before pushing.
