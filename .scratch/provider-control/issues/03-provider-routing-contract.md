# 03 — Provider Type and Runtime Routing Contract

**What to build:** Make explicit `providerType` authoritative across Rust and browser fallback, with legacy inference only during migration and isomorphic Provider Lab behavior.

**Blocked by:** None

**Status:** completed

- [x] Explicit `ollama` / `openai-compatible` / `custom` type routing
- [x] One-time legacy inference on migration; explicit type never overwritten
- [x] Browser health timeout aligned to Rust 6s
- [x] Browser smoke uses default model and one-shot stream like Rust
- [x] Delete and profile update commands in Rust and browser fallback

## Comments

Review round 1: fixed disabled-provider leakage into live contexts, explicit type authority and health/smoke isomorphism.
