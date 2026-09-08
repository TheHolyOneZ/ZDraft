use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::{IoError, Result};
use crate::sidecar::is_sidecar;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum DirEntryKind {
    Folder,

    Diagram,

    Document,
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FolderEntry {
    pub name: String,
    pub path: PathBuf,
    pub kind: DirEntryKind,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,

    pub has_layout: bool,
}

pub fn engine_for_extension(path: impl AsRef<Path>) -> Option<&'static str> {
    let ext = path.as_ref().extension()?.to_str()?.to_ascii_lowercase();
    Some(match ext.as_str() {
        "mmd" | "mermaid" => "mermaid",
        "dot" | "gv" => "graphviz",
        "d2" => "d2",
        "puml" | "plantuml" | "pu" | "iuml" => "plantuml",
        _ => return None,
    })
}

fn is_document(path: impl AsRef<Path>) -> bool {
    path.as_ref()
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_ascii_lowercase().as_str(), "md" | "markdown" | "mdx"))
        .unwrap_or(false)
}

pub fn list_folder(dir: impl AsRef<Path>) -> Result<Vec<FolderEntry>> {
    let dir = dir.as_ref();
    let read = std::fs::read_dir(dir).map_err(|e| IoError::read(dir, e))?;

    let mut entries = Vec::new();

    for item in read {
        let Ok(item) = item else { continue };
        let path = item.path();
        let name = item.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if is_sidecar(&path) {
            continue;
        }

        let is_dir = item.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let engine = engine_for_extension(&path).map(str::to_string);

        let kind = if is_dir {
            DirEntryKind::Folder
        } else if engine.is_some() {
            DirEntryKind::Diagram
        } else if is_document(&path) {
            DirEntryKind::Document
        } else {
            DirEntryKind::Other
        };

        let has_layout = !is_dir && crate::sidecar::sidecar_path_for(&path).exists();

        entries.push(FolderEntry {
            name,
            path,
            kind,
            engine,
            has_layout,
        });
    }

    entries.sort_by(|a, b| {
        let group = |e: &FolderEntry| u8::from(e.kind != DirEntryKind::Folder);
        group(a)
            .cmp(&group(b))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            .then_with(|| a.name.cmp(&b.name))
    });

    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_extensions_to_engines() {
        assert_eq!(engine_for_extension("a.mmd"), Some("mermaid"));
        assert_eq!(engine_for_extension("a.MMD"), Some("mermaid"));
        assert_eq!(engine_for_extension("a.dot"), Some("graphviz"));
        assert_eq!(engine_for_extension("a.gv"), Some("graphviz"));
        assert_eq!(engine_for_extension("a.d2"), Some("d2"));
        assert_eq!(engine_for_extension("a.puml"), Some("plantuml"));
        assert_eq!(engine_for_extension("a.txt"), None);
        assert_eq!(engine_for_extension("noext"), None);
    }

    #[test]
    fn lists_folders_first_then_files_case_insensitively() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("templates")).unwrap();
        std::fs::write(dir.path().join("Zebra.mmd"), "").unwrap();
        std::fs::write(dir.path().join("apple.d2"), "").unwrap();

        let names: Vec<_> = list_folder(dir.path())
            .unwrap()
            .into_iter()
            .map(|e| e.name)
            .collect();
        assert_eq!(names, ["templates", "apple.d2", "Zebra.mmd"]);
    }

    #[test]
    fn hides_sidecars_and_dotfiles() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.mmd"), "").unwrap();
        std::fs::write(dir.path().join("a.mmd.zlayout.toml"), "").unwrap();
        std::fs::write(dir.path().join(".hidden"), "").unwrap();

        let names: Vec<_> = list_folder(dir.path())
            .unwrap()
            .into_iter()
            .map(|e| e.name)
            .collect();
        assert_eq!(names, ["a.mmd"]);
    }

    #[test]
    fn flags_files_that_already_have_pins() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("pinned.mmd"), "").unwrap();
        std::fs::write(dir.path().join("pinned.mmd.zlayout.toml"), "version = 1\n").unwrap();
        std::fs::write(dir.path().join("plain.mmd"), "").unwrap();

        let entries = list_folder(dir.path()).unwrap();
        let by = |n: &str| entries.iter().find(|e| e.name == n).unwrap().has_layout;
        assert!(by("pinned.mmd"));
        assert!(!by("plain.mmd"));
    }

    #[test]
    fn classifies_markdown_as_a_document() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("README.md"), "").unwrap();
        std::fs::write(dir.path().join("notes.txt"), "").unwrap();

        let entries = list_folder(dir.path()).unwrap();
        let kind = |n: &str| entries.iter().find(|e| e.name == n).unwrap().kind;
        assert_eq!(kind("README.md"), DirEntryKind::Document);
        assert_eq!(kind("notes.txt"), DirEntryKind::Other);
    }

    #[test]
    fn a_missing_folder_names_itself() {
        let err = list_folder("/definitely/not/here").unwrap_err();
        assert_eq!(err.code(), "io.read");
        assert!(err.to_string().contains("/definitely/not/here"));
    }
}
