use std::path::PathBuf;

use zdraft_io::PlantUmlProbe;

use crate::error::CommandResult;

#[tauri::command]
pub fn plantuml_probe(jar: Option<PathBuf>) -> PlantUmlProbe {
    zdraft_io::plantuml_probe(jar.as_deref())
}

#[tauri::command]
pub fn plantuml_render(
    source: String,
    jar: Option<PathBuf>,
    skinparams: Option<Vec<String>>,
) -> CommandResult<String> {
    zdraft_io::plantuml_render(&source, jar.as_deref(), &skinparams.unwrap_or_default())
        .map_err(Into::into)
}

#[tauri::command]
pub fn plantuml_install_dir() -> Option<String> {
    zdraft_io::plantuml_install_dir().map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn plantuml_install() -> CommandResult<String> {
    zdraft_io::plantuml_install()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(Into::into)
}
