use serde::{Serialize, Serializer};

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{message}")]
    Message { code: &'static str, message: String },
    #[error("{context}: {source}")]
    Context {
        context: String,
        source: Box<AppError>,
    },
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Csv(#[from] csv::Error),
    #[error("{0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Base64(#[from] base64::DecodeError),
}

impl AppError {
    /// `code` is the stable wire identifier the frontend maps to user-facing
    /// copy; `message` is diagnostics-only context and never user-facing.
    pub fn message(code: &'static str, message: impl Into<String>) -> Self {
        Self::Message {
            code,
            message: message.into(),
        }
    }

    pub fn context(context: impl Into<String>, source: AppError) -> Self {
        Self::Context {
            context: context.into(),
            source: Box::new(source),
        }
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::Message { code, .. } => code,
            Self::Context { source, .. } => source.code(),
            Self::Io(_) => "io.unexpected",
            Self::Csv(_) => "parse.csv",
            Self::Json(_) => "parse.json",
            Self::Base64(_) => "data.base64",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}
