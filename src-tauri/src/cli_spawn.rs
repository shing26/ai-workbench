use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncBufReadExt;

#[derive(Clone, Serialize)]
pub struct CliSpawnResult {
    pub run_id: String,
}

#[derive(Clone, Serialize)]
pub struct CliLogLine {
    pub run_id: String,
    pub line: String,
    pub stream: String,
}

#[derive(Clone, Serialize)]
pub struct CliExited {
    pub run_id: String,
    pub exit_code: i32,
}

const ALLOWED_COMMANDS: &[&str] = &[
    "claude",
    "claude.exe",
    "aider",
    "aider.exe",
    "codex",
    "codex.exe",
    "git",
    "git.exe",
    "npx",
    "npx.cmd",
    "npm",
    "npm.cmd",
    "cargo",
    "cargo.exe",
    "pnpm",
    "pnpm.cmd",
    "yarn",
    "yarn.cmd",
    "python",
    "python.exe",
    "python3",
    "node",
    "node.exe",
];

fn blocked_shell_chars(s: &str) -> bool {
    s.chars().any(|c| matches!(c, ';' | '&' | '|' | '$' | '`' | '>' | '<'))
}

fn is_destructive_command(command: &str) -> bool {
    let lower = command.to_lowercase();
    let fragments = [
        "rm -rf",
        "rm -fr",
        "rmdir /s",
        "rmdir /q",
        "rd /s",
        "del /f",
        "del /q",
        "format ",
        "mkfs",
        "dd ",
        "shutdown",
        "chkdsk",
        "sfc ",
        "diskpart",
    ];
    fragments.iter().any(|f| lower.contains(f))
}

fn is_within(base: &Path, candidate: &Path) -> bool {
    let base = base.canonicalize().unwrap_or_else(|_| base.to_path_buf());
    let candidate = candidate
        .canonicalize()
        .unwrap_or_else(|_| candidate.to_path_buf());
    candidate.starts_with(&base)
}

fn validate_spawn_request(project_path: &str, command: &str, cwd: Option<&str>) -> Result<(), String> {
    let project = PathBuf::from(project_path);
    if project_path.trim().is_empty() {
        return Err("Empty project path".into());
    }
    let command = command.trim();
    if command.is_empty() {
        return Err("Empty command".into());
    }
    let exe_name = Path::new(command)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| command.to_string());
    if !ALLOWED_COMMANDS.contains(&exe_name.to_lowercase().as_str()) {
        return Err(format!("Command not allowed: {}", command));
    }
    if blocked_shell_chars(command) {
        return Err(format!("Command contains blocked shell characters: {}", command));
    }
    if is_destructive_command(command) {
        return Err(format!("Command blocked as destructive: {}", command));
    }
    if let Some(cwd) = cwd {
        if !cwd.trim().is_empty() && !is_within(&project, Path::new(cwd)) {
            return Err(format!("Working directory outside project scope: {}", cwd));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn spawn_cli_process(
    app: AppHandle,
    project_path: String,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<CliSpawnResult, String> {
    validate_spawn_request(&project_path, &command, cwd.as_deref())?;

    let run_id = format!(
        "cli-{}-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
        uuid_short()
    );

    let working_dir = cwd
        .filter(|c| !c.trim().is_empty())
        .unwrap_or_else(|| project_path.clone());

    let spawn_app = app.clone();
    let spawn_run_id = run_id.clone();

    tauri::async_runtime::spawn(async move {
        let _ = spawn_inner(
            &spawn_app,
            &spawn_run_id,
            &command,
            &args,
            &working_dir,
        )
        .await;
    });

    Ok(CliSpawnResult { run_id })
}

fn uuid_short() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:x}", nanos % 0x1_0000_0000_0000_0000)
}

async fn spawn_inner(
    app: &AppHandle,
    run_id: &str,
    command: &str,
    args: &[String],
    working_dir: &str,
) -> Result<i32, String> {
    let exe_name = Path::new(command)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| command.to_string());

    let mut cmd = tokio::process::Command::new(exe_name);
    cmd.args(args)
        .current_dir(working_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    #[cfg(windows)]
    {
        cmd.kill_on_drop(true);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", command, e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let app_out = app.clone();
    let run_id_out = run_id.to_string();
    let stdout_task = tokio::task::spawn(async move {
        if let Some(stdout) = stdout {
            let reader = tokio::io::BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_out.emit(
                    "cli_log_line",
                    CliLogLine {
                        run_id: run_id_out.clone(),
                        line: line.clone(),
                        stream: "stdout".into(),
                    },
                );
            }
        }
    });

    let app_err = app.clone();
    let run_id_err = run_id.to_string();
    let stderr_task = tokio::task::spawn(async move {
        if let Some(stderr) = stderr {
            let reader = tokio::io::BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_err.emit(
                    "cli_log_line",
                    CliLogLine {
                        run_id: run_id_err.clone(),
                        line: line.clone(),
                        stream: "stderr".into(),
                    },
                );
            }
        }
    });

    let status = child.wait().await.map_err(|e| format!("wait failed: {}", e))?;
    let exit_code = status.code().unwrap_or(-1);

    let _ = stdout_task.await;
    let _ = stderr_task.await;

    let _ = app.emit(
        "cli_exited",
        CliExited {
            run_id: run_id.to_string(),
            exit_code,
        },
    );

    let _ = app.emit(
        "cli_log_line",
        CliLogLine {
            run_id: run_id.to_string(),
            line: format!("[exit {}]", exit_code),
            stream: "system".into(),
        },
    );

    Ok(exit_code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_shell_chars() {
        assert!(blocked_shell_chars("echo hi && ls"));
        assert!(blocked_shell_chars("a | b"));
        assert!(blocked_shell_chars("$HOME"));
        assert!(blocked_shell_chars("`cmd`"));
        assert!(blocked_shell_chars("a;b"));
        assert!(!blocked_shell_chars("claude"));
        assert!(!blocked_shell_chars("git status"));
    }

    #[test]
    fn rejects_destructive_commands() {
        assert!(is_destructive_command("rm -rf /"));
        assert!(is_destructive_command("rm -fr /tmp"));
        assert!(is_destructive_command("format c:"));
        assert!(!is_destructive_command("claude"));
        assert!(!is_destructive_command("git status"));
    }

    #[test]
    fn is_within_scope() {
        assert!(is_within(Path::new("/work/app"), Path::new("/work/app/src")));
        assert!(is_within(Path::new("/work/app"), Path::new("/work/app")));
        assert!(!is_within(Path::new("/work/app"), Path::new("/work")));
        assert!(!is_within(Path::new("/work/app"), Path::new("/etc")));
    }

    #[test]
    fn allowed_command_passes_validation() {
        assert!(validate_spawn_request("/work/app", "claude", None).is_ok());
        assert!(validate_spawn_request("/work/app", "git", None).is_ok());
    }

    #[test]
    fn rejects_unknown_command() {
        let res = validate_spawn_request("/work/app", "curl", None);
        assert!(res.is_err());
        let res = validate_spawn_request("/work/app", "rm -rf /", None);
        assert!(res.is_err());
    }

    #[test]
    fn rejects_out_of_scope_cwd() {
        let res = validate_spawn_request("/work/app", "claude", Some("/etc"));
        assert!(res.is_err());
        let res = validate_spawn_request("/work/app", "claude", Some("/work/app/sub"));
        assert!(res.is_ok());
    }
}
