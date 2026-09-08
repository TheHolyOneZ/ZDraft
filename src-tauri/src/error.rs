use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct CommandError {
    pub code: String,
    pub message: String,
    pub remedy: String,
    pub retryable: bool,
}

impl CommandError {
    pub fn new(
        code: impl Into<String>,
        message: impl Into<String>,
        remedy: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            remedy: remedy.into(),
            retryable: false,
        }
    }
}

impl From<zdraft_io::IoError> for CommandError {
    fn from(e: zdraft_io::IoError) -> Self {
        Self {
            code: e.code().to_string(),
            message: e.to_string(),
            remedy: e.remedy(),
            retryable: e.retryable(),
        }
    }
}

impl From<zdraft_io::VectorError> for CommandError {
    fn from(e: zdraft_io::VectorError) -> Self {
        Self {
            code: e.code().to_string(),
            message: e.to_string(),
            remedy: e.remedy(),
            retryable: false,
        }
    }
}

impl From<zdraft_io::PlantUmlError> for CommandError {
    fn from(e: zdraft_io::PlantUmlError) -> Self {
        Self {
            code: e.code().to_string(),
            message: e.to_string(),
            remedy: e.remedy(),

            retryable: matches!(e, zdraft_io::PlantUmlError::Timeout(_)),
        }
    }
}

pub type CommandResult<T> = std::result::Result<T, CommandError>;
