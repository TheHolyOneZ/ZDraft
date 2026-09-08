use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

const TIMEOUT: Duration = Duration::from_secs(30);

#[cfg(unix)]
const JAR_CANDIDATES: &[&str] = &[
    "/usr/share/plantuml/plantuml.jar",
    "/usr/share/java/plantuml.jar",
    "/usr/share/java/plantuml/plantuml.jar",
    "/usr/local/share/plantuml/plantuml.jar",
    "/opt/plantuml/plantuml.jar",
    "/opt/homebrew/opt/plantuml/libexec/plantuml.jar",
    "/usr/local/opt/plantuml/libexec/plantuml.jar",
];

#[cfg(windows)]
const JAR_CANDIDATES: &[&str] = &[
    r"C:\Program Files\PlantUML\plantuml.jar",
    r"C:\Program Files (x86)\PlantUML\plantuml.jar",
    r"C:\ProgramData\chocolatey\lib\plantuml\tools\plantuml.jar",
];

pub fn install_dir() -> Option<PathBuf> {
    user_jar_dirs()
        .into_iter()
        .next()
        .map(|d| d.join("plantuml"))
}

const DOWNLOAD_URL: &str =
    "https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar";

const MIN_JAR_BYTES: usize = 2 * 1024 * 1024;

const MAX_JAR_BYTES: u64 = 128 * 1024 * 1024;

pub fn install() -> PlantUmlResult<PathBuf> {
    let dir = install_dir().ok_or_else(|| {
        PlantUmlError::Download("this system has no home directory to install into".into())
    })?;

    std::fs::create_dir_all(&dir).map_err(|e| PlantUmlError::Write {
        path: dir.clone(),
        message: e.to_string(),
    })?;

    let body = ureq::get(DOWNLOAD_URL)
        .call()
        .map_err(|e| PlantUmlError::Download(e.to_string()))?
        .into_body()
        .with_config()
        .limit(MAX_JAR_BYTES)
        .read_to_vec()
        .map_err(|e| PlantUmlError::Download(e.to_string()))?;

    if body.len() < MIN_JAR_BYTES || !body.starts_with(b"PK") {
        return Err(PlantUmlError::Download(format!(
            "the download was {} bytes and not a jar",
            body.len()
        )));
    }

    let staged = dir.join("plantuml.jar.part");
    let final_path = dir.join("plantuml.jar");

    std::fs::write(&staged, &body).map_err(|e| PlantUmlError::Write {
        path: staged.clone(),
        message: e.to_string(),
    })?;

    if jar_version(&staged).is_none() {
        let _ = std::fs::remove_file(&staged);
        return Err(PlantUmlError::BadJar { path: final_path });
    }

    std::fs::rename(&staged, &final_path).map_err(|e| PlantUmlError::Write {
        path: final_path.clone(),
        message: e.to_string(),
    })?;

    Ok(final_path)
}

fn discovered_jar() -> Option<PathBuf> {
    user_jar_dirs()
        .into_iter()
        .map(|dir| dir.join("plantuml").join("plantuml.jar"))
        .chain(JAR_CANDIDATES.iter().map(PathBuf::from))
        .find(|p| p.is_file())
}

#[cfg(unix)]
fn user_jar_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(data) = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from) {
        dirs.push(data);
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        dirs.push(home.join(".local/share"));
    }

    dirs
}

#[cfg(windows)]
fn user_jar_dirs() -> Vec<PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .into_iter()
        .collect()
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
pub struct PlantUmlProbe {
    pub java: Option<String>,

    pub jar: Option<String>,

    pub version: Option<String>,

    pub jar_source: JarSource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "kebab-case")]
pub enum JarSource {
    Configured,

    Discovered,

    Environment,
    None,
}

impl PlantUmlProbe {
    pub fn ready(&self) -> bool {
        self.java.is_some() && self.jar.is_some() && self.version.is_some()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PlantUmlError {
    #[error("Java is not installed, or not on the PATH")]
    NoJava,

    #[error("plantuml.jar was not found")]
    NoJar,

    #[error("{path} is not a file ZDraft can run")]
    BadJar { path: PathBuf },

    #[error("PlantUML did not finish within {0} seconds")]
    Timeout(u64),

    #[error("could not run PlantUML: {0}")]
    Spawn(String),

    #[error("PlantUML reported: {0}")]
    Failed(String),

    #[error("could not download PlantUML: {0}")]
    Download(String),

    #[error("could not write {path}: {message}")]
    Write { path: PathBuf, message: String },
}

impl PlantUmlError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::NoJava => "plantuml.no_java",
            Self::NoJar => "plantuml.no_jar",
            Self::BadJar { .. } => "plantuml.bad_jar",
            Self::Timeout(_) => "plantuml.timeout",
            Self::Spawn(_) => "plantuml.spawn",
            Self::Failed(_) => "plantuml.failed",
            Self::Download(_) => "plantuml.download",
            Self::Write { .. } => "plantuml.write",
        }
    }

    pub fn remedy(&self) -> String {
        match self {
            Self::NoJava => {
                "Install a Java runtime (JRE 8 or newer). PlantUML is a Java program and \
                 ZDraft does not bundle one — every other engine works without it."
                    .into()
            }
            Self::NoJar => "Download plantuml.jar from plantuml.com and set its path in Settings, \
                 or install your distribution's plantuml package."
                .into(),
            Self::BadJar { .. } => {
                "Point Settings at the plantuml.jar file itself, not the folder holding it.".into()
            }
            Self::Timeout(_) => "The diagram may be very large, or the jar may not be PlantUML. \
                 Try a smaller diagram to check the setup."
                .into(),
            Self::Spawn(_) => "Check that java runs from a terminal on this machine.".into(),
            Self::Failed(_) => "PlantUML rejected the source. The message above is its own.".into(),
            Self::Download(_) => "Check the network, or download plantuml.jar yourself and point \
                 Settings at it — the folder to use is shown above."
                .into(),
            Self::Write { path, .. } => format!(
                "ZDraft could not write to {}. Download plantuml.jar yourself and point Settings \
                 at wherever you put it.",
                path.display()
            ),
        }
    }
}

pub type PlantUmlResult<T> = std::result::Result<T, PlantUmlError>;

pub fn probe(configured: Option<&Path>) -> PlantUmlProbe {
    let java = java_version();

    let (jar, jar_source) = match configured {
        Some(path) if path.is_file() => (Some(path.to_path_buf()), JarSource::Configured),
        _ => match std::env::var_os("PLANTUML_JAR").map(PathBuf::from) {
            Some(path) if path.is_file() => (Some(path), JarSource::Environment),
            _ => match discovered_jar() {
                Some(path) => (Some(path), JarSource::Discovered),
                None => (None, JarSource::None),
            },
        },
    };

    let version = match (&java, &jar) {
        (Some(_), Some(path)) => jar_version(path),
        _ => None,
    };

    PlantUmlProbe {
        java,
        jar: jar.map(|p| p.to_string_lossy().into_owned()),
        version,
        jar_source,
    }
}

pub fn render_svg(
    source: &str,
    configured: Option<&Path>,
    skinparams: &[String],
) -> PlantUmlResult<String> {
    let found = probe(configured);

    if found.java.is_none() {
        return Err(PlantUmlError::NoJava);
    }
    let jar = found.jar.ok_or(PlantUmlError::NoJar)?;
    if found.version.is_none() {
        return Err(PlantUmlError::BadJar {
            path: PathBuf::from(&jar),
        });
    }

    let mut command = java();
    command.args([
        "-Djava.awt.headless=true",
        "-jar",
        &jar,
        "-tsvg",
        "-pipe",
        "-pipeNoStdErr",
        "-charset",
        "UTF-8",
    ]);

    for param in skinparams.iter().filter(|p| is_safe_skinparam(p)) {
        command.arg(format!("-S{param}"));
    }

    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| PlantUmlError::Spawn(e.to_string()))?;

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(source.as_bytes());
    }

    let output = wait_with_timeout(child, TIMEOUT)?;

    let svg = String::from_utf8_lossy(&output.stdout).into_owned();
    if !output.status.success() || !svg.contains("<svg") {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(PlantUmlError::Failed(first_useful_line(&stderr)));
    }

    Ok(svg)
}

fn wait_with_timeout(
    mut child: std::process::Child,
    limit: Duration,
) -> PlantUmlResult<std::process::Output> {
    let start = std::time::Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                return child
                    .wait_with_output()
                    .map_err(|e| PlantUmlError::Spawn(e.to_string()))
            }
            Ok(None) => {
                if start.elapsed() >= limit {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(PlantUmlError::Timeout(limit.as_secs()));
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => return Err(PlantUmlError::Spawn(e.to_string())),
        }
    }
}

fn is_safe_skinparam(param: &str) -> bool {
    let Some((name, value)) = param.split_once('=') else {
        return false;
    };

    !name.is_empty()
        && name.chars().all(|c| c.is_ascii_alphanumeric())
        && !value.is_empty()
        && !value.starts_with('-')
        && value.len() <= 64
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '#' | '-' | '_' | '.' | ' '))
}

#[cfg(windows)]
fn java() -> Command {
    use std::os::windows::process::CommandExt;

    const NO_WINDOW: u32 = 0x0800_0000;

    let mut command = Command::new("java");
    command.creation_flags(NO_WINDOW);
    command
}

#[cfg(not(windows))]
fn java() -> Command {
    Command::new("java")
}

fn java_version() -> Option<String> {
    let output = java().arg("-version").stdin(Stdio::null()).output().ok()?;

    if !output.status.success() {
        return None;
    }

    let text = if output.stderr.is_empty() {
        String::from_utf8_lossy(&output.stdout)
    } else {
        String::from_utf8_lossy(&output.stderr)
    };

    Some(first_useful_line(&text))
}

fn jar_version(jar: &Path) -> Option<String> {
    let output = java()
        .arg("-jar")
        .arg(jar)
        .arg("-version")
        .stdin(Stdio::null())
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().find(|l| l.contains("PlantUML version"))?;
    Some(line.trim().to_string())
}

fn first_useful_line(text: &str) -> String {
    text.lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .unwrap_or("PlantUML produced no output")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_prefers_the_configured_jar_over_anything_it_finds() {
        let dir = tempfile::tempdir().unwrap();
        let jar = dir.path().join("plantuml.jar");
        std::fs::write(&jar, b"not really a jar").unwrap();

        let found = probe(Some(&jar));

        assert_eq!(found.jar.as_deref(), Some(jar.to_string_lossy().as_ref()));
        assert_eq!(found.jar_source, JarSource::Configured);
    }

    #[test]
    fn a_file_that_is_not_plantuml_reports_no_version() {
        let dir = tempfile::tempdir().unwrap();
        let jar = dir.path().join("plantuml.jar");
        std::fs::write(&jar, b"not really a jar").unwrap();

        assert!(probe(Some(&jar)).version.is_none());
    }

    #[test]
    fn a_configured_path_that_does_not_exist_is_ignored() {
        let found = probe(Some(Path::new("/nonexistent/plantuml.jar")));
        assert_ne!(found.jar_source, JarSource::Configured);
    }

    #[test]
    fn ready_needs_all_three_parts() {
        let base = PlantUmlProbe {
            java: Some("openjdk 21".into()),
            jar: Some("/x/plantuml.jar".into()),
            version: Some("PlantUML version 1".into()),
            jar_source: JarSource::Discovered,
        };
        assert!(base.ready());

        assert!(!PlantUmlProbe {
            version: None,
            ..base.clone()
        }
        .ready());
        assert!(!PlantUmlProbe {
            java: None,
            ..base.clone()
        }
        .ready());
        assert!(!PlantUmlProbe { jar: None, ..base }.ready());
    }

    #[test]
    fn skinparams_are_held_to_what_a_theme_can_produce() {
        assert!(is_safe_skinparam("backgroundColor=transparent"));
        assert!(is_safe_skinparam("defaultFontColor=#A5F3FC"));
        assert!(is_safe_skinparam("defaultFontName=Inter Variable"));

        assert!(!is_safe_skinparam("backgroundColor"));
        assert!(!is_safe_skinparam("=transparent"));
        assert!(!is_safe_skinparam("background Color=x"));
        assert!(!is_safe_skinparam("x=--pipe"));
        assert!(!is_safe_skinparam("x=a;rm -rf /"));
        assert!(!is_safe_skinparam("x=$(whoami)"));
        assert!(!is_safe_skinparam(&format!("x={}", "a".repeat(65))));
    }

    #[test]
    fn rendering_without_a_jar_says_which_part_is_missing() {
        let err = render_svg(
            "@startuml\na -> b\n@enduml",
            Some(Path::new("/nope.jar")),
            &[],
        );

        match err {
            Err(PlantUmlError::NoJar) | Err(PlantUmlError::NoJava) => {}
            Err(PlantUmlError::BadJar { .. }) => {}
            other => panic!("expected a missing-piece error, got {other:?}"),
        }
    }

    #[test]
    fn every_error_offers_a_remedy() {
        let errors = [
            PlantUmlError::NoJava,
            PlantUmlError::NoJar,
            PlantUmlError::BadJar {
                path: PathBuf::from("/x"),
            },
            PlantUmlError::Timeout(30),
            PlantUmlError::Spawn("x".into()),
            PlantUmlError::Failed("x".into()),
        ];

        for error in errors {
            assert!(!error.remedy().is_empty(), "{} has no remedy", error.code());
            assert!(!error.code().is_empty());
        }
    }

    #[test]
    fn first_useful_line_skips_the_blanks_java_likes_to_print() {
        assert_eq!(first_useful_line("\n\n  boom  \nstack\n"), "boom");
        assert_eq!(first_useful_line("   \n"), "PlantUML produced no output");
    }

    #[test]
    fn looks_where_a_user_can_actually_write() {
        let dir = tempfile::tempdir().unwrap();
        let jar = dir.path().join("plantuml").join("plantuml.jar");
        std::fs::create_dir_all(jar.parent().unwrap()).unwrap();
        std::fs::write(&jar, b"not really a jar").unwrap();

        temp_env::with_vars(
            [
                ("XDG_DATA_HOME", Some(dir.path().as_os_str())),
                ("PLANTUML_JAR", None),
            ],
            || {
                let probe = probe(None);
                assert_eq!(probe.jar.as_deref(), Some(jar.to_str().unwrap()));
                assert_eq!(probe.jar_source, JarSource::Discovered);

                assert_eq!(probe.version, None);
            },
        );
    }

    #[test]
    fn a_configured_path_still_wins_over_the_user_directory() {
        let dir = tempfile::tempdir().unwrap();
        let theirs = dir.path().join("plantuml").join("plantuml.jar");
        std::fs::create_dir_all(theirs.parent().unwrap()).unwrap();
        std::fs::write(&theirs, b"x").unwrap();

        let chosen = dir.path().join("chosen.jar");
        std::fs::write(&chosen, b"x").unwrap();

        temp_env::with_var("XDG_DATA_HOME", Some(dir.path().as_os_str()), || {
            let probe = probe(Some(&chosen));
            assert_eq!(probe.jar.as_deref(), Some(chosen.to_str().unwrap()));
            assert_eq!(probe.jar_source, JarSource::Configured);
        });
    }
}
