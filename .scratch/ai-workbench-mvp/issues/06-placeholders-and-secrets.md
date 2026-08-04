# 06 — Placeholder Views + Secret Management
**What to build:** 知识中枢/自动化执行台/创收工作台的占位视图；Rust 侧 Tauri commands 对接 Windows 凭据管理器。
**Blocked by:** 02-app-shell.md
**Status:** completed
- [ ] Knowledge Hub placeholder: heading + description of future functionality
- [ ] Automation Workbench placeholder: heading + description of future functionality
- [ ] Monetization Workbench placeholder: heading + description of future functionality
- [ ] Rust: add `keyring` crate dependency to Cargo.toml
- [ ] Rust: implement `set_secret` Tauri command (store key-value in Windows Credential Manager)
- [ ] Rust: implement `get_secret` Tauri command (retrieve value by key)
- [ ] Rust: implement `delete_secret` Tauri command (remove entry by key)
- [ ] Frontend: add test buttons/UI to invoke secret commands and display results
- [ ] Verify: set_secret stores, get_secret retrieves, delete_secret removes; placeholder views render
