use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JourneyModel {
    #[allow(dead_code)]
    version: u32,
    stages: Vec<String>,
    transitions: HashMap<String, Vec<String>>,
}

fn model() -> &'static JourneyModel {
    static MODEL: OnceLock<JourneyModel> = OnceLock::new();
    MODEL.get_or_init(|| {
        serde_json::from_str(include_str!("../../journey-stages.json"))
            .expect("journey-stages.json must parse")
    })
}

pub fn stage_valid(stage: &str) -> bool {
    model().stages.iter().any(|candidate| candidate == stage)
}

pub fn transition_allowed(from: &str, to: &str) -> bool {
    if from == to {
        return true;
    }
    model()
        .transitions
        .get(from)
        .map(|targets| targets.iter().any(|target| target == to))
        .unwrap_or(false)
}

pub fn replace_frontmatter_stage(content: &str, stage: &str) -> String {
    let mut fence_seen = 0;
    let mut in_frontmatter = false;
    let mut out: Vec<String> = Vec::new();
    for line in content.lines() {
        if line.trim() == "---" {
            fence_seen += 1;
            in_frontmatter = fence_seen == 1;
            out.push(line.to_string());
            continue;
        }
        if in_frontmatter && line.starts_with("journeyStage:") {
            out.push(format!("journeyStage: {stage}"));
            continue;
        }
        out.push(line.to_string());
    }
    out.join("\n")
}

pub fn append_record(content: &str, record: &str, stage: &str) -> String {
    let updated = replace_frontmatter_stage(content, stage);
    format!("{}\n\n{}", updated.trim_end(), record.trim())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_parses_full_journey_model() {
        assert_eq!(model().version, 1);
        assert_eq!(model().stages.len(), 5);
        for stage in &model().stages {
            assert!(model().transitions.contains_key(stage));
        }
    }

    #[test]
    fn transition_rules_match_agreed_flow() {
        assert!(transition_allowed("idea", "discussing"));
        assert!(transition_allowed("idea", "ready"));
        assert!(transition_allowed("idea", "archived"));
        assert!(transition_allowed("discussing", "ready"));
        assert!(transition_allowed("ready", "building"));
        assert!(transition_allowed("building", "archived"));
        assert!(transition_allowed("archived", "ready"));
        assert!(!transition_allowed("idea", "building"));
        assert!(!transition_allowed("discussing", "building"));
        assert!(!transition_allowed("archived", "idea"));
        assert!(transition_allowed("ready", "ready"));
    }

    #[test]
    fn frontmatter_stage_replaces_only_inside_frontmatter() {
        let content = "---\nprojectId: p1\njourneyStage: ready\n---\n\n# Title\njourneyStage: keep";
        let updated = replace_frontmatter_stage(content, "archived");
        assert!(updated.contains("journeyStage: archived"));
        assert!(updated.contains("journeyStage: keep"));
        assert_eq!(
            updated
                .lines()
                .filter(|line| *line == "journeyStage: archived")
                .count(),
            1
        );
    }

    #[test]
    fn append_record_keeps_existing_doc_and_adds_record() {
        let content = "---\njourneyStage: ready\n---\n\n# Topic\n\nbody";
        let updated = append_record(content, "## 归档记录\n\n- 项目: Demo", "archived");
        assert!(updated.starts_with("---\njourneyStage: archived"));
        assert!(updated.contains("body"));
        assert!(updated.ends_with("## 归档记录\n\n- 项目: Demo"));
    }
}
