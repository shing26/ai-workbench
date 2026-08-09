use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub success: bool,
    pub backup_id: String,
    pub file_path: String,
    pub diff_delta: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileBackupEntry {
    pub backup_id: String,
    pub target_path: String,
    pub backup_path: String,
    pub is_new_file: bool,
    pub created_at: i64,
}

fn now_timestamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_millis())
        .unwrap_or(0);
    format!("{}{:03}", secs, millis)
}

fn sha8(content: &str) -> String {
    let digest = sha2::Sha256::digest(content.as_bytes());
    digest[..4]
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

fn manifest_path(project_path: &str) -> PathBuf {
    Path::new(project_path)
        .join(".hermes")
        .join("backups")
        .join("manifest.json")
}

fn read_manifest(project_path: &str) -> Vec<FileBackupEntry> {
    let path = manifest_path(project_path);
    fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn write_manifest(project_path: &str, entries: &[FileBackupEntry]) -> Result<(), String> {
    let path = manifest_path(project_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create backups dir: {}", e))?;
    }
    let json =
        serde_json::to_string_pretty(entries).map_err(|e| format!("Manifest serialize: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write manifest: {}", e))
}

fn resolve_project_relative(project_path: &str, relative_path: &str) -> Result<PathBuf, String> {
    let project = Path::new(project_path);
    let rel = Path::new(relative_path);
    if rel
        .components()
        .any(|c| matches!(c, Component::ParentDir | Component::RootDir))
    {
        return Err("Invalid path: traversal not allowed".into());
    }
    let full = project.join(rel);

    let project_canon =
        fs::canonicalize(project).map_err(|e| format!("Project path not accessible: {}", e))?;

    // 对 target 可能不存在的场景：canonicalize 其已存在的最近祖先目录
    let mut ancestor = full.clone();
    let mut suffix: Vec<PathBuf> = Vec::new();
    while !ancestor.exists() {
        let name = ancestor.file_name().map(|n| n.to_os_string());
        if let Some(name) = name {
            suffix.push(PathBuf::from(name));
        }
        if !ancestor.pop() {
            break;
        }
    }
    let ancestor_canon = fs::canonicalize(&ancestor)
        .map_err(|e| format!("Project ancestor not accessible: {}", e))?;
    let mut resolved = ancestor_canon;
    for seg in suffix.iter().rev() {
        resolved = resolved.join(seg);
    }
    if !resolved.starts_with(&project_canon) {
        return Err("Path escapes project directory".into());
    }
    if let Some(parent) = full.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dirs: {}", e))?;
    }
    Ok(full)
}

fn create_shadow_snapshot(project_path: &str, target: &PathBuf) -> Result<(String, bool), String> {
    let backups_dir = Path::new(project_path).join(".hermes").join("backups");
    fs::create_dir_all(&backups_dir).map_err(|e| format!("Failed to create backups dir: {}", e))?;

    let file_name = target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());
    let is_new_file = !target.exists();

    let backup_content = if is_new_file {
        String::new()
    } else {
        fs::read_to_string(target).map_err(|e| format!("Failed to read target file: {}", e))?
    };
    let ts = now_timestamp();
    let hash = sha8(&backup_content);
    let backup_id = format!("{}_{}_{}", ts, hash, file_name);
    let backup_path = backups_dir.join(format!("{}.bak", backup_id));
    fs::write(&backup_path, &backup_content)
        .map_err(|e| format!("Failed to write backup: {}", e))?;

    Ok((backup_id, is_new_file))
}

fn atomic_write(target: &PathBuf, content: &str) -> Result<(), String> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dirs: {}", e))?;
    }
    let tmp = target.with_extension("tmp");
    fs::write(&tmp, content).map_err(|e| format!("Failed to write temp file: {}", e))?;
    fs::rename(&tmp, target).map_err(|e| format!("Failed to atomically replace file: {}", e))
}

fn compute_diff_delta(old: &str, new: &str) -> String {
    let old_lines = old.lines().count() as i64;
    let new_lines = new.lines().count() as i64;
    let delta = new_lines - old_lines;
    if delta >= 0 {
        format!("+{}, -{}", delta, 0)
    } else {
        format!("+{}, -{}", 0, -delta)
    }
}

#[tauri::command]
pub async fn apply_code_snippet(
    app: tauri::AppHandle,
    project_path: String,
    relative_path: String,
    code_content: String,
) -> Result<ApplyResult, String> {
    let result = apply_code_snippet_inner(&project_path, &relative_path, &code_content)?;
    let _ = app.emit("FILE_UPDATED", &relative_path);
    Ok(result)
}

pub fn apply_code_snippet_inner(
    project_path: &str,
    relative_path: &str,
    code_content: &str,
) -> Result<ApplyResult, String> {
    let target = resolve_project_relative(project_path, relative_path)?;
    let old_content = fs::read_to_string(&target).unwrap_or_default();
    let (backup_id, is_new_file) = create_shadow_snapshot(project_path, &target)?;

    atomic_write(&target, code_content)?;

    let mut manifest = read_manifest(project_path);
    manifest.push(FileBackupEntry {
        backup_id: backup_id.clone(),
        target_path: relative_path.to_string(),
        backup_path: format!(".hermes/backups/{}.bak", backup_id),
        is_new_file,
        created_at: now_timestamp().parse().unwrap_or(0),
    });
    write_manifest(project_path, &manifest)?;

    Ok(ApplyResult {
        success: true,
        backup_id,
        file_path: relative_path.to_string(),
        diff_delta: compute_diff_delta(&old_content, code_content),
    })
}

#[tauri::command]
pub async fn rollback_snapshot(
    app: tauri::AppHandle,
    project_path: String,
    backup_id: String,
) -> Result<bool, String> {
    let ok = rollback_snapshot_inner(&project_path, &backup_id)?;
    let _ = app.emit("FILE_RESTORED", &backup_id);
    Ok(ok)
}

pub fn rollback_snapshot_inner(project_path: &str, backup_id: &str) -> Result<bool, String> {
    let manifest = read_manifest(project_path);
    let entry = manifest
        .iter()
        .find(|e| e.backup_id == backup_id)
        .ok_or_else(|| format!("Backup not found: {}", backup_id))?;

    let target = resolve_project_relative(project_path, &entry.target_path)?;
    let backups_dir = Path::new(project_path).join(".hermes").join("backups");
    let backup_file = backups_dir.join(format!("{}.bak", backup_id));

    if entry.is_new_file {
        let _ = fs::remove_file(&target);
    } else {
        let content = fs::read_to_string(&backup_file)
            .map_err(|e| format!("Failed to read backup: {}", e))?;
        atomic_write(&target, &content)?;
    }

    Ok(true)
}

#[tauri::command]
pub fn list_snapshots(project_path: String) -> Result<Vec<FileBackupEntry>, String> {
    Ok(read_manifest(&project_path))
}

#[tauri::command]
pub fn prune_snapshots(project_path: String, keep: usize) -> Result<usize, String> {
    let mut manifest = read_manifest(&project_path);
    let total = manifest.len();
    if total <= keep {
        return Ok(0);
    }
    let to_remove: Vec<String> = manifest
        .iter()
        .take(total - keep)
        .map(|e| e.backup_id.clone())
        .collect();
    let backups_dir = Path::new(&project_path).join(".hermes").join("backups");
    for id in &to_remove {
        let _ = fs::remove_file(backups_dir.join(format!("{}.bak", id)));
    }
    manifest.retain(|e| !to_remove.contains(&e.backup_id));
    write_manifest(&project_path, &manifest)?;
    Ok(to_remove.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_project(tag: &str) -> String {
        let dir = std::env::temp_dir().join(format!("hermes-s7-{}-{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir.to_string_lossy().to_string()
    }

    #[test]
    fn apply_creates_backup_and_atomic_write() {
        let project = tmp_project("apply");
        let target = Path::new(&project).join("src").join("bento.css");
        fs::create_dir_all(target.parent().unwrap()).unwrap();
        fs::write(&target, "original").unwrap();

        let result = apply_code_snippet_inner(&project, "src/bento.css", "new content")
            .expect("apply should succeed");
        assert!(result.success);
        assert!(!result.backup_id.is_empty());

        let backups = list_snapshots(project.clone()).unwrap();
        assert_eq!(backups.len(), 1);
        let restored = fs::read_to_string(&target).unwrap();
        assert_eq!(restored, "new content");

        let _ = fs::remove_dir_all(&project);
    }

    #[test]
    fn rollback_restores_original() {
        let project = tmp_project("rollback");
        let target = Path::new(&project).join("a.txt");
        fs::write(&target, "ORIGINAL").unwrap();

        let result = apply_code_snippet_inner(&project, "a.txt", "MODIFIED").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "MODIFIED");

        rollback_snapshot_inner(&project, &result.backup_id).expect("rollback should succeed");
        assert_eq!(fs::read_to_string(&target).unwrap(), "ORIGINAL");

        let _ = fs::remove_dir_all(&project);
    }

    #[test]
    fn path_traversal_rejected() {
        let project = tmp_project("traversal");
        let err = apply_code_snippet_inner(&project, "../evil.txt", "x");
        assert!(err.is_err());
        let _ = fs::remove_dir_all(&project);
    }

    #[test]
    fn missing_parent_dirs_created() {
        let project = tmp_project("missingdir");
        let target = Path::new(&project)
            .join("deep")
            .join("nested")
            .join("file.ts");
        apply_code_snippet_inner(&project, "deep/nested/file.ts", "code")
            .expect("should create dirs");
        assert!(target.exists());
        assert_eq!(fs::read_to_string(&target).unwrap(), "code");
        let _ = fs::remove_dir_all(&project);
    }

    #[test]
    fn repeated_apply_keeps_unique_backups() {
        let project = tmp_project("repeat");
        let target = Path::new(&project).join("f.rs");
        fs::write(&target, "v1").unwrap();

        let r1 = apply_code_snippet_inner(&project, "f.rs", "v2").unwrap();
        let r2 = apply_code_snippet_inner(&project, "f.rs", "v3").unwrap();
        assert_ne!(r1.backup_id, r2.backup_id);

        let backups = list_snapshots(project.clone()).unwrap();
        assert_eq!(backups.len(), 2);
        let _ = fs::remove_dir_all(&project);
    }

    #[test]
    fn prune_removes_oldest_keep_latest() {
        let project = tmp_project("prune");
        let target = Path::new(&project).join("p.txt");
        fs::write(&target, "v0").unwrap();
        apply_code_snippet_inner(&project, "p.txt", "v1").unwrap();
        apply_code_snippet_inner(&project, "p.txt", "v2").unwrap();
        apply_code_snippet_inner(&project, "p.txt", "v3").unwrap();

        let removed = prune_snapshots(project.clone(), 1).unwrap();
        assert_eq!(removed, 2);
        assert_eq!(list_snapshots(project.clone()).unwrap().len(), 1);
        let _ = fs::remove_dir_all(&project);
    }
}
