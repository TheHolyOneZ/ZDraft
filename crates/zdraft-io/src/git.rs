use std::path::Path;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub repository: bool,

    pub tracked: bool,

    pub head: Option<String>,
}

impl GitStatus {
    fn none() -> Self {
        Self {
            repository: false,
            tracked: false,
            head: None,
        }
    }
}

pub fn head_blob(path: impl AsRef<Path>) -> Option<String> {
    let path = path.as_ref();
    let repo = gix::discover(path.parent()?).ok()?;

    let relative = relative_to(&repo, path)?;
    let mut tree = repo.head_commit().ok()?.tree().ok()?;
    let entry = tree.peel_to_entry_by_path(&relative).ok()??;

    let object = entry.object().ok()?;

    if object.kind != gix::object::Kind::Blob {
        return None;
    }

    String::from_utf8(object.data.clone()).ok()
}

pub fn status(path: impl AsRef<Path>) -> GitStatus {
    let path = path.as_ref();
    let Some(parent) = path.parent() else {
        return GitStatus::none();
    };
    let Ok(repo) = gix::discover(parent) else {
        return GitStatus::none();
    };

    let head = repo
        .head_name()
        .ok()
        .flatten()
        .map(|name| name.shorten().to_string())
        .or_else(|| {
            repo.head_id()
                .ok()
                .map(|id| id.to_hex_with_len(7).to_string())
        });

    let tracked = relative_to(&repo, path)
        .and_then(|relative| {
            let mut tree = repo.head_commit().ok()?.tree().ok()?;
            tree.peel_to_entry_by_path(&relative).ok()?
        })
        .is_some();

    GitStatus {
        repository: true,
        tracked,
        head,
    }
}

fn relative_to(repo: &gix::Repository, path: &Path) -> Option<std::path::PathBuf> {
    let workdir = repo.workdir()?.canonicalize().ok()?;

    let parent = path.parent()?.canonicalize().ok()?;
    let name = path.file_name()?;

    Some(parent.strip_prefix(&workdir).ok()?.join(name))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn repo_with(name: &str, contents: &str) -> Option<tempfile::TempDir> {
        let dir = tempfile::tempdir().ok()?;
        let root = dir.path();

        let git = |args: &[&str]| {
            Command::new("git")
                .args(args)
                .current_dir(root)
                .env("GIT_AUTHOR_NAME", "t")
                .env("GIT_AUTHOR_EMAIL", "t@example.com")
                .env("GIT_COMMITTER_NAME", "t")
                .env("GIT_COMMITTER_EMAIL", "t@example.com")
                .output()
                .ok()
                .filter(|o| o.status.success())
        };

        git(&["init", "-q", "-b", "main"])?;
        std::fs::write(root.join(name), contents).ok()?;
        git(&["add", name])?;
        git(&["commit", "-q", "-m", "first"])?;

        Some(dir)
    }

    #[test]
    fn reads_the_committed_version_not_the_one_on_disk() {
        let Some(dir) = repo_with("a.dot", "digraph { a; }\n") else {
            return;
        };
        let file = dir.path().join("a.dot");

        std::fs::write(&file, "digraph { a; b; }\n").unwrap();

        assert_eq!(head_blob(&file).as_deref(), Some("digraph { a; }\n"));
    }

    #[test]
    fn a_file_that_was_never_committed_has_no_committed_version() {
        let Some(dir) = repo_with("a.dot", "digraph { a; }\n") else {
            return;
        };
        let new = dir.path().join("b.dot");
        std::fs::write(&new, "digraph { b; }\n").unwrap();

        assert!(head_blob(&new).is_none());
        assert!(!status(&new).tracked);

        assert!(status(&new).repository);
    }

    #[test]
    fn a_folder_outside_a_repository_is_not_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.dot");
        std::fs::write(&file, "digraph { a; }\n").unwrap();

        assert!(head_blob(&file).is_none());
        assert_eq!(status(&file), GitStatus::none());
    }

    #[test]
    fn names_the_branch_head_points_at() {
        let Some(dir) = repo_with("a.dot", "digraph { a; }\n") else {
            return;
        };
        assert_eq!(
            status(dir.path().join("a.dot")).head.as_deref(),
            Some("main")
        );
    }

    #[test]
    fn finds_a_file_in_a_subdirectory() {
        let Some(dir) = repo_with("a.dot", "digraph { a; }\n") else {
            return;
        };

        let sub = dir.path().join("docs");
        std::fs::create_dir(&sub).unwrap();
        std::fs::write(sub.join("b.dot"), "digraph { b; }\n").unwrap();

        Command::new("git")
            .args(["add", "docs/b.dot"])
            .current_dir(dir.path())
            .output()
            .unwrap();
        Command::new("git")
            .args(["commit", "-q", "-m", "second"])
            .current_dir(dir.path())
            .env("GIT_AUTHOR_NAME", "t")
            .env("GIT_AUTHOR_EMAIL", "t@example.com")
            .env("GIT_COMMITTER_NAME", "t")
            .env("GIT_COMMITTER_EMAIL", "t@example.com")
            .output()
            .unwrap();

        assert_eq!(
            head_blob(sub.join("b.dot")).as_deref(),
            Some("digraph { b; }\n")
        );
    }
}
