use std::path::PathBuf;

use zdraft_io::GitStatus;

#[tauri::command]
pub fn git_head_blob(path: PathBuf) -> Option<String> {
    zdraft_io::head_blob(path)
}

#[tauri::command]
pub fn git_status(path: PathBuf) -> GitStatus {
    zdraft_io::git_status(path)
}
