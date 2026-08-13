use serde::Deserialize;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SemanticAuditResult {
    pub status: String,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub evidence: SemanticAuditEvidence,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SemanticAuditEvidence {
    pub checked_tasks: usize,
    pub pending_tasks: usize,
    pub code_files: usize,
    pub doc_files: usize,
    pub other_files: usize,
    pub archived: bool,
}

fn is_code_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    [
        ".ts", ".tsx", ".js", ".jsx", ".rs", ".py", ".go", ".java", ".kt", ".swift", ".c", ".h",
        ".cpp", ".cs", ".rb", ".php",
    ]
    .iter()
    .any(|ext| lower.ends_with(ext))
}

fn is_doc_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".txt") || lower.ends_with(".rst")
}

fn parse_do_tasks(dod: &str) -> (usize, usize, bool) {
    let mut checked = 0;
    let mut pending = 0;
    let mut archived = false;
    for line in dod.lines() {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();
        if lower.starts_with("- [x]") {
            checked += 1;
        } else if lower.starts_with("- [ ]") {
            pending += 1;
        } else if lower.contains("journeystage: archived") {
            archived = true;
        }
    }
    (checked, pending, archived)
}

pub fn run_semantic_audit(dod: Option<&str>, files: &[(String, usize)]) -> SemanticAuditResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let mut code_files = 0usize;
    let mut doc_files = 0usize;
    let mut other_files = 0usize;
    for (path, _) in files {
        if is_code_file(path) {
            code_files += 1;
        } else if is_doc_file(path) {
            doc_files += 1;
        } else {
            other_files += 1;
        }
    }

    let mut checked_tasks = 0;
    let mut pending_tasks = 0;
    let mut archived = false;
    if let Some(dod) = dod {
        (checked_tasks, pending_tasks, archived) = parse_do_tasks(dod);
    }

    let evidence = SemanticAuditEvidence {
        checked_tasks,
        pending_tasks,
        code_files,
        doc_files,
        other_files,
        archived,
    };

    let status = if files.is_empty() {
        "NO_CHANGES".to_string()
    } else if dod.is_none() {
        errors.push("未提供旅程文档（DoD），无法执行语义对齐审查".to_string());
        "FAIL".to_string()
    } else if code_files == 0 && pending_tasks > 0 && !archived {
        errors.push(format!(
            "DoD 仍有 {} 项待办任务，但变更未包含代码实现",
            pending_tasks
        ));
        "FAIL".to_string()
    } else {
        if code_files == 0 && pending_tasks == 0 {
            warnings.push("变更未包含代码文件，且 DoD 无待办任务".to_string());
        }
        "PASS".to_string()
    };

    SemanticAuditResult {
        status,
        errors,
        warnings,
        evidence,
    }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MatrixManifest {
    pub version: u32,
    pub fail_fast: String,
    pub levels: Vec<MatrixLevel>,
    pub security_rules: SecurityRules,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MatrixLevel {
    pub level: u32,
    pub name: String,
    #[serde(default)]
    pub checks: Vec<MatrixCheck>,
    #[serde(default)]
    pub ai_audit: Option<AiAudit>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MatrixCheck {
    pub name: String,
    pub program: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub cwd: String,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
    #[serde(default)]
    pub requires: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiAudit {
    pub mode: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecurityRules {
    #[serde(default)]
    pub ignore_paths: Vec<String>,
    pub secrets: Vec<SecretRule>,
    pub debug_calls: DebugCalls,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecretRule {
    pub id: String,
    #[serde(default)]
    pub prefix: Option<String>,
    #[serde(default)]
    pub contains: Option<String>,
    #[serde(default)]
    pub min_length: Option<usize>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DebugCalls {
    #[serde(default)]
    pub ts: Vec<String>,
    #[serde(default)]
    pub rs: Vec<String>,
}

fn default_timeout_ms() -> u64 {
    120_000
}

pub fn load_manifest() -> Result<MatrixManifest, String> {
    let raw = include_str!("../../verify.matrix.json");
    serde_json::from_str(raw).map_err(|e| format!("verify.matrix.json parse error: {e}"))
}

pub fn platform_program(program: &str) -> String {
    if cfg!(windows) && matches!(program, "npm" | "npx") {
        format!("{program}.cmd")
    } else {
        program.to_string()
    }
}

pub fn secret_rule_hit(text: &str, rule: &SecretRule) -> bool {
    if let Some(needle) = &rule.contains {
        return text.to_lowercase().contains(&needle.to_lowercase());
    }
    if let Some(prefix) = &rule.prefix {
        let lower = text.to_lowercase();
        let needle = prefix.to_lowercase();
        if let Some(idx) = lower.find(&needle) {
            let rest: String = text
                .get(idx + prefix.len()..)
                .unwrap_or("")
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
                .collect();
            return rest.chars().count() >= rule.min_length.unwrap_or(16);
        }
    }
    false
}

pub fn debug_call_hit(line: &str, needle: &str) -> bool {
    let trimmed = line.trim_start();
    trimmed.starts_with(needle)
        && trimmed
            .get(needle.len()..)
            .map(|rest| rest.trim_start().starts_with('('))
            .unwrap_or(false)
}

pub fn scan_security_hits(file: &str, added_text: &str, rules: &SecurityRules) -> Vec<String> {
    let mut hits = Vec::new();
    let ignored = rules.ignore_paths.iter().any(|pattern| {
        let pattern = pattern.trim_end_matches('/');
        file == pattern || file.starts_with(&format!("{pattern}/"))
    });
    if ignored {
        return hits;
    }
    if let Some(rule) = rules
        .secrets
        .iter()
        .find(|rule| secret_rule_hit(added_text, rule))
    {
        hits.push(format!("{file}: 变更可能包含硬编码敏感信息（{}）", rule.id));
    }
    let needles = if file.ends_with(".ts") || file.ends_with(".tsx") {
        Some(&rules.debug_calls.ts)
    } else if file.ends_with(".rs") {
        Some(&rules.debug_calls.rs)
    } else {
        None
    };
    if let Some(needles) = needles {
        let debug_hit = added_text
            .lines()
            .any(|line| needles.iter().any(|needle| debug_call_hit(line, needle)));
        if debug_hit {
            hits.push(format!("{file}: 残留调试输出"));
        }
    }
    hits
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semantic_audit_accepts_no_changes_without_dod() {
        let result = run_semantic_audit(None, &[]);
        assert_eq!(result.status, "NO_CHANGES");
        assert!(result.errors.is_empty());
    }

    #[test]
    fn semantic_audit_requires_dod_when_changes_exist() {
        let result = run_semantic_audit(None, &[("src/lib/app.ts".to_string(), 10)]);
        assert_eq!(result.status, "FAIL");
        assert!(result.errors.iter().any(|error| error.contains("DoD")));
    }

    #[test]
    fn semantic_audit_blocks_doc_only_changes_with_pending_tasks() {
        let dod =
            "---\njourneyStage: ready\n---\n\n## 交付任务清单\n- [ ] 实现认证\n- [x] 完成调研\n";
        let result = run_semantic_audit(Some(dod), &[("docs/journey/topic.md".to_string(), 4)]);
        assert_eq!(result.status, "FAIL");
        assert!(result.evidence.pending_tasks == 1);
        assert!(result.evidence.checked_tasks == 1);
        assert!(!result.evidence.archived);
    }

    #[test]
    fn semantic_audit_blocks_non_code_changes_with_pending_tasks() {
        let dod = "## tasks\n- [ ] update config\n";
        let result = run_semantic_audit(Some(dod), &[("verify.matrix.json".to_string(), 8)]);
        assert_eq!(result.status, "FAIL");
        assert!(result.evidence.other_files == 1);
        assert!(result.evidence.code_files == 0);
        assert!(result.errors.iter().any(|error| error.contains("DoD")));
    }

    #[test]
    fn semantic_audit_passes_code_changes_with_pending_tasks() {
        let dod = "## 交付任务清单\n- [ ] 实现认证\n";
        let result = run_semantic_audit(
            Some(dod),
            &[
                ("src/lib/auth.ts".to_string(), 12),
                ("docs/journey/topic.md".to_string(), 2),
            ],
        );
        assert_eq!(result.status, "PASS");
        assert!(result.errors.is_empty());
        assert_eq!(result.evidence.code_files, 1);
        assert_eq!(result.evidence.doc_files, 1);
    }

    #[test]
    fn semantic_audit_ignores_pending_tasks_for_archived_journeys() {
        let dod = "---\njourneyStage: archived\n---\n\n## 交付任务清单\n- [ ] 剩余记录\n";
        let result = run_semantic_audit(Some(dod), &[("docs/archive.md".to_string(), 5)]);
        assert_eq!(result.status, "PASS");
        assert!(result.evidence.archived);
    }

    #[test]
    fn manifest_parses_with_full_shape() {
        let manifest = load_manifest().expect("verify.matrix.json must parse");
        assert_eq!(manifest.version, 1);
        assert_eq!(manifest.fail_fast, "level");
        assert_eq!(manifest.levels.len(), 4);
        for (index, level) in manifest.levels.iter().enumerate() {
            assert_eq!(level.level as usize, index + 1);
            assert!(!level.name.is_empty());
            assert!(
                !level.checks.is_empty(),
                "level {} must declare checks",
                level.level
            );
            for check in &level.checks {
                assert!(!check.program.is_empty());
                assert!(
                    check.cwd == "root" || check.cwd == "src-tauri" || check.program == "internal"
                );
                assert!(check.timeout_ms > 0);
            }
        }
        assert_eq!(
            manifest.levels[3]
                .ai_audit
                .as_ref()
                .map(|audit| audit.mode.as_str()),
            Some("cli")
        );
        assert!(manifest.levels[3]
            .checks
            .iter()
            .any(|check| check.name == "semantic audit"));
        assert!(!manifest.security_rules.secrets.is_empty());
        assert!(manifest
            .security_rules
            .ignore_paths
            .iter()
            .any(|path| path == "verify.matrix.json"));
        assert!(!manifest.security_rules.debug_calls.ts.is_empty());
        assert!(!manifest.security_rules.debug_calls.rs.is_empty());
    }

    #[test]
    fn security_rules_detect_shared_hits() {
        let manifest = load_manifest().unwrap();
        let rules = &manifest.security_rules;
        let fake_key = format!("sk-{}", "abcdefghijklmnop");
        let added = format!("const key = \"{fake_key}\";\nconsole.log(\"x\");");
        let hits = scan_security_hits("src/lib/leak.ts", &added, rules);
        assert_eq!(
            hits,
            vec![
                "src/lib/leak.ts: 变更可能包含硬编码敏感信息（sk-prefix）",
                "src/lib/leak.ts: 残留调试输出",
            ]
        );
        assert!(scan_security_hits("src/lib/leak.ts", "no secrets here", rules).is_empty());
        assert!(scan_security_hits("src-tauri/src/db.rs", "dbg!(x);", rules)
            .iter()
            .any(|hit| hit.contains("残留调试输出")));
        assert!(scan_security_hits(
            "src-tauri/src/db.rs",
            &format!("-----{} PRIVATE KEY-----", "BEGIN RSA"),
            rules
        )
        .iter()
        .any(|hit| hit.contains("硬编码敏感信息")));
    }

    #[test]
    fn platform_program_resolves_npm_shims() {
        let mapped = platform_program("npm");
        if cfg!(windows) {
            assert_eq!(mapped, "npm.cmd");
            assert_eq!(platform_program("cargo"), "cargo");
        } else {
            assert_eq!(mapped, "npm");
        }
    }
}
