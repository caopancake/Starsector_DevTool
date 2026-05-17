use std::{error::Error, fmt};

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug)]
pub enum AppError {
    Message(String),
    Context {
        context: String,
        source: Box<AppError>,
    },
    Io(std::io::Error),
    Csv(csv::Error),
    Json(serde_json::Error),
    Base64(base64::DecodeError),
}

impl AppError {
    pub fn message(message: impl Into<String>) -> Self {
        Self::Message(message.into())
    }

    pub fn context(context: impl Into<String>, source: AppError) -> Self {
        Self::Context {
            context: context.into(),
            source: Box::new(source),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Message(message) => write!(f, "{message}"),
            Self::Context { context, source } => write!(f, "{context}: {source}"),
            Self::Io(error) => write!(f, "{error}"),
            Self::Csv(error) => write!(f, "{error}"),
            Self::Json(error) => write!(f, "{error}"),
            Self::Base64(error) => write!(f, "{error}"),
        }
    }
}

impl Error for AppError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Context { source, .. } => Some(source.as_ref()),
            Self::Io(error) => Some(error),
            Self::Csv(error) => Some(error),
            Self::Json(error) => Some(error),
            Self::Base64(error) => Some(error),
            Self::Message(_) => None,
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<csv::Error> for AppError {
    fn from(value: csv::Error) -> Self {
        Self::Csv(value)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        Self::Json(value)
    }
}

impl From<base64::DecodeError> for AppError {
    fn from(value: base64::DecodeError) -> Self {
        Self::Base64(value)
    }
}
