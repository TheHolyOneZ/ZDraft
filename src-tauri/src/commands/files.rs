use std::path::PathBuf;

use serde::Serialize;
use ts_rs::TS;
use zdraft_io::{engine_for_extension, FolderEntry};

use crate::error::{CommandError, CommandResult};

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct OpenedFile {
    pub path: PathBuf,
    pub name: String,
    pub text: String,

    pub engine: Option<String>,

    pub layout_text: Option<String>,
}

#[tauri::command]
pub fn list_folder(path: PathBuf) -> CommandResult<Vec<FolderEntry>> {
    Ok(zdraft_io::list_folder(path)?)
}

#[tauri::command]
pub fn read_file(path: PathBuf) -> CommandResult<OpenedFile> {
    let text = zdraft_io::read_text(&path)?;
    let sidecar = zdraft_io::sidecar_path_for(&path);
    let layout_text = sidecar
        .exists()
        .then(|| zdraft_io::read_text(&sidecar))
        .transpose()?;

    Ok(OpenedFile {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        engine: engine_for_extension(&path).map(str::to_string),
        path,
        text,
        layout_text,
    })
}

#[tauri::command]
pub fn write_file(path: PathBuf, text: String) -> CommandResult<()> {
    zdraft_io::write_atomic(&path, &text)?;
    Ok(())
}

#[tauri::command]
pub fn path_exists(path: PathBuf) -> bool {
    path.exists()
}

#[tauri::command]
pub fn write_bytes(path: PathBuf, bytes: Vec<u8>) -> CommandResult<()> {
    std::fs::write(&path, bytes)
        .map_err(|e| CommandError::from(zdraft_io::IoError::write(&path, e)))
}
