pub mod atomic;
pub mod error;
pub mod git;
pub mod plantuml;
pub mod sidecar;
pub mod tree;
pub mod vector;

pub use atomic::{read_text, write_atomic, MAX_TEXT_BYTES};
pub use error::{IoError, Result};
pub use git::{head_blob, status as git_status, GitStatus};
pub use plantuml::{
    install as plantuml_install, install_dir as plantuml_install_dir, probe as plantuml_probe,
    render_svg as plantuml_render, JarSource, PlantUmlError, PlantUmlProbe,
};
pub use sidecar::{
    detect_conflict, is_sidecar, sidecar_path_for, Conflict, EdgeHint, Layout, Pin, SequenceHints,
    Sidecar, ThemeRef, SIDECAR_VERSION,
};
pub use tree::{engine_for_extension, list_folder, DirEntryKind, FolderEntry};
pub use vector::{outline_text, to_pdf, VectorError};
