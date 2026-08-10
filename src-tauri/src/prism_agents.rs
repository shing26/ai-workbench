use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AgentSpec {
    pub id: String,
    pub name: String,
    pub role: String,
    pub kpi: String,
    pub prompt: String,
    pub active: bool,
}

fn parse_frontmatter(content: &str) -> (std::collections::HashMap<String, String>, String) {
    let mut fields = std::collections::HashMap::new();
    let mut body = content.to_string();
    if let Some(stripped) = content.strip_prefix("---") {
        if let Some(end) = stripped.find("\n---") {
            let fm = &stripped[..end];
            body = stripped[end + 4..].to_string();
            for line in fm.lines() {
                if let Some((k, v)) = line.split_once(':') {
                    fields.insert(k.trim().to_string(), v.trim().to_string());
                }
            }
        }
    }
    (fields, body.trim().to_string())
}

fn id_from_filename(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "agent".into())
}

pub fn load_agent_specs(project_path: &str) -> Result<Vec<AgentSpec>, String> {
    let agents_dir: PathBuf = Path::new(project_path).join(".hermes").join("agents");
    if !agents_dir.exists() {
        return Ok(Vec::new());
    }
    let mut specs = Vec::new();
    for entry in fs::read_dir(&agents_dir).map_err(|e| format!("read agents dir: {}", e))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().map(|e| e != "md").unwrap_or(true) {
            continue;
        }
        let content = fs::read_to_string(&path).unwrap_or_default();
        let (fields, body) = parse_frontmatter(&content);
        if fields.is_empty() && body.is_empty() {
            continue;
        }
        let id = fields
            .get("id")
            .cloned()
            .unwrap_or_else(|| id_from_filename(&path));
        specs.push(AgentSpec {
            id,
            name: fields.get("name").cloned().unwrap_or_default(),
            role: fields.get("role").cloned().unwrap_or_default(),
            kpi: fields.get("kpi").cloned().unwrap_or_default(),
            prompt: body,
            active: fields.get("active").map(|v| v != "false").unwrap_or(true),
        });
    }
    specs.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(specs)
}

pub fn ensure_default_agent_specs(project_path: &str) -> Result<usize, String> {
    let agents_dir: PathBuf = Path::new(project_path).join(".hermes").join("agents");
    fs::create_dir_all(&agents_dir).map_err(|e| format!("create agents dir: {}", e))?;

    let defaults: Vec<(&str, &str)> = vec![
        (
            "cto",
            "---\nid: cto\nname: CTO\nrole: 技术架构师\nkpi: 可行性、架构一致性、性能\nactive: true\n---\n你是 Prism Station 的 CTO。从架构可行性、系统一致性、性能与可维护性角度独立评估需求，质疑不合理的实现路径，提出技术选型建议。",
        ),
        (
            "cdo",
            "---\nid: cdo\nname: CDO\nrole: 设计负责人\nkpi: 用户体验、信息架构、视觉一致性\nactive: true\n---\n你是 Prism Station 的 CDO（Chief Design Officer）。从用户体验、信息架构、交互与视觉一致性角度独立评审需求，指出体验风险并给出设计方案建议。",
        ),
        (
            "ciso",
            "---\nid: ciso\nname: CISO\nrole: 安全审计官\nkpi: 数据安全、权限边界、注入防护\nactive: true\n---\n你是 Prism Station 的 CISO。从安全角度独立审计需求，识别数据泄露、越权访问、注入与密钥泄露风险，要求安全边界与最小权限原则。",
        ),
    ];

    let mut created = 0;
    for (id, content) in defaults {
        let path = agents_dir.join(format!("{}.md", id));
        if !path.exists() {
            fs::write(&path, content).map_err(|e| format!("write agent spec: {}", e))?;
            created += 1;
        }
    }
    Ok(created)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter_and_body() {
        let content = "---\nid: cto\nname: CTO\nrole: architect\nkpi: feasibility\nactive: true\n---\nYou are the CTO.";
        let (fields, body) = parse_frontmatter(content);
        assert_eq!(fields.get("id").map(|s| s.as_str()), Some("cto"));
        assert_eq!(fields.get("name").map(|s| s.as_str()), Some("CTO"));
        assert_eq!(body, "You are the CTO.");
    }

    #[test]
    fn empty_content_skipped() {
        let dir = std::env::temp_dir().join(format!("prism-agents-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let agents_dir = dir.join(".hermes").join("agents");
        fs::create_dir_all(&agents_dir).unwrap();
        fs::write(agents_dir.join("cto.md"), "no frontmatter").unwrap();

        let specs = load_agent_specs(dir.to_str().unwrap()).unwrap();
        // body non-empty, fields empty -> id from filename, prompt = body
        assert_eq!(specs.len(), 1);
        assert_eq!(specs[0].id, "cto");
        assert_eq!(specs[0].prompt, "no frontmatter");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn ensure_defaults_creates_three_specs() {
        let dir = std::env::temp_dir().join(format!("prism-defaults-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let created = ensure_default_agent_specs(dir.to_str().unwrap()).unwrap();
        assert_eq!(created, 3);
        // idempotent
        let second = ensure_default_agent_specs(dir.to_str().unwrap()).unwrap();
        assert_eq!(second, 0);

        let specs = load_agent_specs(dir.to_str().unwrap()).unwrap();
        assert_eq!(specs.len(), 3);
        let ids: Vec<&str> = specs.iter().map(|s| s.id.as_str()).collect();
        assert!(ids.contains(&"cto") && ids.contains(&"cdo") && ids.contains(&"ciso"));
        let _ = fs::remove_dir_all(&dir);
    }
}
