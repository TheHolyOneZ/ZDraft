use std::path::{Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum IoError {
    #[error("could not read {path}: {source}")]
    Read {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("could not write {path}: {source}")]
    Write {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("{path} is not valid UTF-8")]
    NotUtf8 { path: PathBuf },

    #[error("{path} has no parent directory to write a temporary file into")]
    NoParent { path: PathBuf },

    #[error("could not parse {path}: {message}")]
    Parse { path: PathBuf, message: String },

    #[error("{path} is larger than the {limit} byte limit for a text file")]
    TooLarge { path: PathBuf, limit: u64 },
}

impl IoError {
    pub fn read(path: impl AsRef<Path>, source: std::io::Error) -> Self {
        Self::Read {
            path: path.as_ref().to_path_buf(),
            source,
        }
    }

    pub fn write(path: impl AsRef<Path>, source: std::io::Error) -> Self {
        Self::Write {
            path: path.as_ref().to_path_buf(),
            source,
        }
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::Read { .. } => "io.read",
            Self::Write { .. } => "io.write",
            Self::NotUtf8 { .. } => "io.not_utf8",
            Self::NoParent { .. } => "io.no_parent",
            Self::Parse { .. } => "io.parse",
            Self::TooLarge { .. } => "io.too_large",
        }
    }

    pub fn remedy(&self) -> String {
        match self {
            Self::Read { path, source } if source.kind() == std::io::ErrorKind::PermissionDenied => {
                format!("Check read permissions on {}.", path.display())
            }
            Self::Read { path, source } if source.kind() == std::io::ErrorKind::NotFound => {
                format!("{} no longer exists. It may have been moved or deleted.", path.display())
            }
            Self::Read { .. } => "Check that the file exists and is readable.".into(),
            Self::Write { path, source }
                if source.kind() == std::io::ErrorKind::PermissionDenied =>
            {
                format!(
                    "ZDraft could not write {}. Check write permissions on its folder — \
                     layout pins need somewhere to live next to the diagram.",
                    path.display()
                )
            }
            Self::Write { .. } => "Check that the folder exists and is writable.".into(),
            Self::NotUtf8 { .. } => {
                "ZDraft reads diagram sources as UTF-8. Re-save the file in UTF-8.".into()
            }
            Self::NoParent { .. } => {
                "Open the diagram from a folder rather than a filesystem root.".into()
            }
            Self::Parse { .. } => {
                "The layout sidecar is malformed. Delete it to fall back to pure auto-layout, \
                 or fix the reported line."
                    .into()
            }
            Self::TooLarge { .. } => {
                "Open a smaller file. This limit exists so a stray binary never locks up the editor."
                    .into()
            }
        }
    }

    pub fn retryable(&self) -> bool {
        matches!(
            self,
            Self::Read { source, .. } | Self::Write { source, .. }
                if matches!(
                    source.kind(),
                    std::io::ErrorKind::Interrupted | std::io::ErrorKind::TimedOut
                )
        )
    }
}

pub type Result<T> = std::result::Result<T, IoError>;
