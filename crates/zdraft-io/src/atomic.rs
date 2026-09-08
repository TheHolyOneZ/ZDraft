use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::error::{IoError, Result};

pub fn write_atomic(path: impl AsRef<Path>, contents: &str) -> Result<()> {
    let path = path.as_ref();
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| IoError::NoParent {
            path: path.to_path_buf(),
        })?;

    if !parent.exists() {
        fs::create_dir_all(parent).map_err(|e| IoError::write(parent, e))?;
    }

    let tmp = temp_sibling(path);

    {
        let mut file = File::create(&tmp).map_err(|e| IoError::write(&tmp, e))?;
        file.write_all(contents.as_bytes())
            .map_err(|e| IoError::write(&tmp, e))?;
        file.flush().map_err(|e| IoError::write(&tmp, e))?;
        file.sync_all().map_err(|e| IoError::write(&tmp, e))?;
    }

    #[cfg(unix)]
    if let Ok(meta) = fs::metadata(path) {
        let _ = fs::set_permissions(&tmp, meta.permissions());
    }

    if let Err(e) = rename_replacing(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(IoError::write(path, e));
    }

    #[cfg(unix)]
    if let Ok(dir) = File::open(parent) {
        let _ = dir.sync_all();
    }

    Ok(())
}

const RENAME_ATTEMPTS: u32 = 4;
const RENAME_BACKOFF: std::time::Duration = std::time::Duration::from_millis(20);

fn rename_replacing(from: &Path, to: &Path) -> std::io::Result<()> {
    let mut last = None;

    for attempt in 0..RENAME_ATTEMPTS {
        match fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    return Err(e);
                }
                last = Some(e);
            }
        }

        if attempt + 1 < RENAME_ATTEMPTS {
            std::thread::sleep(RENAME_BACKOFF * (attempt + 1));
        }
    }

    Err(last.expect("the loop runs at least once"))
}

fn temp_sibling(path: &Path) -> PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);

    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let stem = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    path.with_file_name(format!(".{}.zdraft-tmp-{}-{}", stem, std::process::id(), n))
}

pub const MAX_TEXT_BYTES: u64 = 16 * 1024 * 1024;

pub fn read_text(path: impl AsRef<Path>) -> Result<String> {
    let path = path.as_ref();

    if let Ok(meta) = fs::metadata(path) {
        if meta.len() > MAX_TEXT_BYTES {
            return Err(IoError::TooLarge {
                path: path.to_path_buf(),
                limit: MAX_TEXT_BYTES,
            });
        }
    }

    let bytes = fs::read(path).map_err(|e| IoError::read(path, e))?;
    String::from_utf8(bytes).map_err(|_| IoError::NotUtf8 {
        path: path.to_path_buf(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.zlayout.toml");

        write_atomic(&path, "version = 1\n").unwrap();
        assert_eq!(read_text(&path).unwrap(), "version = 1\n");
    }

    #[test]
    fn overwrites_without_truncating_first() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.toml");

        write_atomic(&path, "first, and quite a lot longer than the replacement").unwrap();
        write_atomic(&path, "second").unwrap();

        assert_eq!(read_text(&path).unwrap(), "second");
    }

    #[test]
    fn leaves_no_temp_files_behind() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.toml");

        write_atomic(&path, "x").unwrap();
        write_atomic(&path, "y").unwrap();

        let leftovers: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .filter(|n| n.contains("zdraft-tmp"))
            .collect();

        assert!(leftovers.is_empty(), "left temp files: {leftovers:?}");
    }

    #[test]
    fn creates_missing_parent_directories() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested/deeper/a.toml");

        write_atomic(&path, "x").unwrap();
        assert_eq!(read_text(&path).unwrap(), "x");
    }

    #[test]
    fn temp_name_is_a_sibling_so_the_rename_stays_on_one_device() {
        let path = Path::new("/tmp/docs/architecture.d2.zlayout.toml");
        let tmp = temp_sibling(path);
        assert_eq!(tmp.parent(), path.parent());
    }

    #[test]
    fn temp_names_do_not_collide() {
        let path = Path::new("/tmp/a.toml");
        assert_ne!(temp_sibling(path), temp_sibling(path));
    }

    #[test]
    fn rejects_non_utf8() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bad.mmd");
        fs::write(&path, [0xff, 0xfe, 0x00]).unwrap();

        assert!(matches!(read_text(&path), Err(IoError::NotUtf8 { .. })));
    }

    #[test]
    fn every_error_offers_a_remedy() {
        let cases = [
            IoError::read("/x", std::io::Error::from(std::io::ErrorKind::NotFound)),
            IoError::read(
                "/x",
                std::io::Error::from(std::io::ErrorKind::PermissionDenied),
            ),
            IoError::write(
                "/x",
                std::io::Error::from(std::io::ErrorKind::PermissionDenied),
            ),
            IoError::NotUtf8 { path: "/x".into() },
            IoError::NoParent { path: "/x".into() },
            IoError::Parse {
                path: "/x".into(),
                message: "bad".into(),
            },
            IoError::TooLarge {
                path: "/x".into(),
                limit: 1,
            },
        ];

        for case in cases {
            assert!(!case.remedy().is_empty(), "{} has no remedy", case.code());
        }
    }
}
