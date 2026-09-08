use std::path::PathBuf;

use crate::error::{CommandError, CommandResult};

#[tauri::command]
pub fn write_pdf(path: PathBuf, svg: String) -> CommandResult<()> {
    let bytes = zdraft_io::to_pdf(&svg)?;

    std::fs::write(&path, bytes)
        .map_err(|e| CommandError::from(zdraft_io::IoError::write(&path, e)))
}

#[tauri::command]
pub fn outline_svg(svg: String) -> CommandResult<String> {
    Ok(zdraft_io::outline_text(&svg)?)
}
