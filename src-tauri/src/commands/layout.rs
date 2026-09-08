use std::path::PathBuf;

use serde::Serialize;
use ts_rs::TS;
use zdraft_io::{Conflict, Sidecar};

use crate::error::CommandResult;

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum LayoutState {
    None,
    Ok { sidecar: Sidecar },

    Conflict { conflict: Conflict },

    Invalid { message: String },
}

#[tauri::command]
pub fn read_layout(diagram: PathBuf) -> CommandResult<LayoutState> {
    let path = zdraft_io::sidecar_path_for(&diagram);
    if !path.exists() {
        return Ok(LayoutState::None);
    }

    let text = zdraft_io::read_text(&path)?;

    if let Some(conflict) = zdraft_io::detect_conflict(&text) {
        return Ok(LayoutState::Conflict { conflict });
    }

    match zdraft_io::sidecar::parse(&text, &path) {
        Ok(sidecar) => Ok(LayoutState::Ok { sidecar }),
        Err(e) => Ok(LayoutState::Invalid {
            message: e.to_string(),
        }),
    }
}

#[tauri::command]
pub fn parse_layout(text: String) -> CommandResult<Sidecar> {
    Ok(zdraft_io::sidecar::parse(&text, "conflict")?)
}

#[tauri::command]
pub fn write_layout(diagram: PathBuf, sidecar: Sidecar) -> CommandResult<()> {
    let path = zdraft_io::sidecar_path_for(&diagram);

    if sidecar.is_empty() {
        if path.exists() {
            let _ = std::fs::remove_file(&path);
        }
        return Ok(());
    }

    let existing = path
        .exists()
        .then(|| zdraft_io::read_text(&path))
        .transpose()?;
    let text = zdraft_io::sidecar::to_toml_string(&sidecar, existing.as_deref());

    zdraft_io::write_atomic(&path, &text)?;
    Ok(())
}

#[tauri::command]
pub fn resolve_layout_conflict(diagram: PathBuf, text: String) -> CommandResult<()> {
    let path = zdraft_io::sidecar_path_for(&diagram);
    zdraft_io::write_atomic(&path, &text)?;
    Ok(())
}

#[tauri::command]
pub fn delete_layout(diagram: PathBuf) -> CommandResult<()> {
    let path = zdraft_io::sidecar_path_for(&diagram);
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| crate::error::CommandError::from(zdraft_io::IoError::write(&path, e)))?;
    }
    Ok(())
}

#[tauri::command]
pub fn layout_path_for(diagram: PathBuf) -> PathBuf {
    zdraft_io::sidecar_path_for(diagram)
}
