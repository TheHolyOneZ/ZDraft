use std::path::PathBuf;

use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Default, Clone, Serialize, TS)]
#[ts(export)]
pub struct StartupArgs {
    pub folder: Option<PathBuf>,
    pub file: Option<PathBuf>,
}

#[tauri::command]
pub fn startup_args() -> StartupArgs {
    parse_args(std::env::args().skip(1))
}

fn parse_args(args: impl Iterator<Item = String>) -> StartupArgs {
    for arg in args {
        if arg.starts_with('-') {
            continue;
        }

        let path = PathBuf::from(&arg);
        if path.is_dir() {
            return StartupArgs {
                folder: Some(path),
                file: None,
            };
        }
        if path.is_file() {
            return StartupArgs {
                folder: path.parent().map(PathBuf::from),
                file: Some(path),
            };
        }
    }

    StartupArgs::default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_folder_argument_opens_that_folder() {
        let dir = tempfile::tempdir().unwrap();
        let args = parse_args(vec![dir.path().to_string_lossy().to_string()].into_iter());

        assert_eq!(args.folder.as_deref(), Some(dir.path()));
        assert!(args.file.is_none());
    }

    #[test]
    fn a_file_argument_opens_the_file_and_its_folder() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.dot");
        std::fs::write(&file, "digraph{}").unwrap();

        let args = parse_args(vec![file.to_string_lossy().to_string()].into_iter());

        assert_eq!(args.file, Some(file));
        assert_eq!(args.folder.as_deref(), Some(dir.path()));
    }

    #[test]
    fn flags_are_not_paths() {
        let args = parse_args(vec!["--devtools".to_string(), "-v".to_string()].into_iter());
        assert!(args.folder.is_none() && args.file.is_none());
    }

    #[test]
    fn a_path_that_does_not_exist_is_ignored() {
        let args = parse_args(vec!["/definitely/not/here".to_string()].into_iter());
        assert!(args.folder.is_none() && args.file.is_none());
    }
}
