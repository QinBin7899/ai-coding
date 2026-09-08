use indexmap::IndexMap;
use serde::Serialize;
use std::path::PathBuf;
use std::str::FromStr;

use tauri::State;

use crate::app_config::AppType;
use crate::config::{get_home_dir, write_text_file};
use crate::hermes_config::MemoryKind;
use crate::prompt::Prompt;
use crate::prompt_files::prompt_file_path;
use crate::services::pi_prompt_files::{
    PiPromptFileKind, PiPromptFileService, PiPromptFileSnapshot, PiPromptTemplate,
    PiPromptTemplateService,
};
use crate::services::prompt::PromptService;
use crate::store::AppState;

#[tauri::command]
pub async fn get_prompts(
    app: String,
    state: State<'_, AppState>,
) -> Result<IndexMap<String, Prompt>, String> {
    let app_type = AppType::from_str(&app).map_err(|e| e.to_string())?;
    PromptService::get_prompts(&state, app_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_prompt(
    app: String,
    id: String,
    prompt: Prompt,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let app_type = AppType::from_str(&app).map_err(|e| e.to_string())?;
    PromptService::upsert_prompt(&state, app_type, &id, prompt).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_prompt(
    app: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let app_type = AppType::from_str(&app).map_err(|e| e.to_string())?;
    PromptService::delete_prompt(&state, app_type, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn enable_prompt(
    app: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let app_type = AppType::from_str(&app).map_err(|e| e.to_string())?;
    PromptService::enable_prompt(&state, app_type, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_prompt_from_file(
    app: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let app_type = AppType::from_str(&app).map_err(|e| e.to_string())?;
    PromptService::import_from_file(&state, app_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_current_prompt_file_content(app: String) -> Result<Option<String>, String> {
    let app_type = AppType::from_str(&app).map_err(|e| e.to_string())?;
    PromptService::get_current_file_content(app_type).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pi_prompt_file(kind: PiPromptFileKind) -> Result<PiPromptFileSnapshot, String> {
    PiPromptFileService::read(kind).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn replace_pi_prompt_file(
    kind: PiPromptFileKind,
    #[allow(non_snake_case)] expectedRevision: String,
    content: String,
) -> Result<PiPromptFileSnapshot, String> {
    PiPromptFileService::replace(kind, &expectedRevision, &content)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_pi_prompt_file(
    kind: PiPromptFileKind,
    #[allow(non_snake_case)] expectedRevision: String,
) -> Result<bool, String> {
    PiPromptFileService::delete(kind, &expectedRevision).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn list_pi_prompt_templates() -> Result<Vec<PiPromptTemplate>, String> {
    PiPromptTemplateService::list().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn upsert_pi_prompt_template(
    slug: String,
    #[allow(non_snake_case)] originalSlug: Option<String>,
    #[allow(non_snake_case)] expectedRevision: String,
    content: String,
) -> Result<PiPromptTemplate, String> {
    PiPromptTemplateService::upsert(&slug, originalSlug.as_deref(), &expectedRevision, &content)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn delete_pi_prompt_template(
    slug: String,
    #[allow(non_snake_case)] expectedRevision: String,
) -> Result<bool, String> {
    PiPromptTemplateService::delete(&slug, &expectedRevision).map_err(|error| error.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySyncTargetInfo {
    pub id: String,
    pub label: String,
    pub path: String,
    pub exists: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySyncOverview {
    pub source_path: String,
    pub source_exists: bool,
    pub targets: Vec<MemorySyncTargetInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySyncResult {
    pub synced_count: usize,
    pub targets: Vec<MemorySyncTargetInfo>,
}

fn get_memory_sync_targets() -> Result<Vec<(String, String, PathBuf)>, String> {
    let codex_path = prompt_file_path(&AppType::Codex).map_err(|e| e.to_string())?;
    let gemini_path = prompt_file_path(&AppType::Gemini).map_err(|e| e.to_string())?;
    let opencode_path = prompt_file_path(&AppType::OpenCode).map_err(|e| e.to_string())?;
    let openclaw_path = prompt_file_path(&AppType::OpenClaw).map_err(|e| e.to_string())?;
    let hermes_path = crate::hermes_config::get_hermes_dir()
        .join("memories")
        .join(MemoryKind::Memory.filename());
    let bincode_path = get_home_dir()
        .join(".config")
        .join("bincode")
        .join("AGENTS.md");

    Ok(vec![
        ("codex".to_string(), "Codex CLI".to_string(), codex_path),
        ("gemini".to_string(), "Gemini CLI".to_string(), gemini_path),
        (
            "hermes".to_string(),
            "Hermes Agent".to_string(),
            hermes_path,
        ),
        (
            "opencode".to_string(),
            "OpenCode".to_string(),
            opencode_path,
        ),
        (
            "openclaw".to_string(),
            "OpenClaw".to_string(),
            openclaw_path,
        ),
        ("bincode".to_string(), "bincode".to_string(), bincode_path),
    ])
}

#[tauri::command]
pub async fn get_memory_sync_overview() -> Result<MemorySyncOverview, String> {
    let source_path = prompt_file_path(&AppType::Claude).map_err(|e| e.to_string())?;
    let targets = get_memory_sync_targets()?
        .into_iter()
        .map(|(id, label, path)| MemorySyncTargetInfo {
            id,
            label,
            exists: path.exists(),
            path: path.to_string_lossy().to_string(),
        })
        .collect();

    Ok(MemorySyncOverview {
        source_exists: source_path.exists(),
        source_path: source_path.to_string_lossy().to_string(),
        targets,
    })
}

#[tauri::command]
pub async fn sync_memory_files(
    #[allow(non_snake_case)] targetIds: Vec<String>,
) -> Result<MemorySyncResult, String> {
    let source_path = prompt_file_path(&AppType::Claude).map_err(|e| e.to_string())?;
    if !source_path.exists() {
        return Err("未找到 ~/.claude/CLAUDE.md，请先创建".to_string());
    }

    let content =
        std::fs::read_to_string(&source_path).map_err(|e| format!("读取源记忆文件失败: {e}"))?;
    if content.trim().is_empty() {
        return Err("CLAUDE.md 为空，暂时没有可同步内容".to_string());
    }

    let selected = get_memory_sync_targets()?
        .into_iter()
        .filter(|(id, _, _)| targetIds.iter().any(|target_id| target_id == id))
        .collect::<Vec<_>>();

    if selected.is_empty() {
        return Err("请至少选择一个同步目标".to_string());
    }

    for (_, _, path) in &selected {
        write_text_file(path, &content).map_err(|e| format!("写入同步文件失败: {e}"))?;
    }

    Ok(MemorySyncResult {
        synced_count: selected.len(),
        targets: selected
            .into_iter()
            .map(|(id, label, path)| MemorySyncTargetInfo {
                id,
                label,
                exists: path.exists(),
                path: path.to_string_lossy().to_string(),
            })
            .collect(),
    })
}
