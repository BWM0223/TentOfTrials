use std::env;
use tracing_subscriber::{fmt, EnvFilter};

/// Supported log output formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogFormat {
    Text,
    Json,
}

impl LogFormat {
    /// Parse `TOT_LOG_FORMAT` env var. Panics on invalid values (acceptance criteria).
    pub fn from_env() -> Self {
        match env::var("TOT_LOG_FORMAT").as_deref() {
            Ok("json") => Self::Json,
            Ok("text") | Err(_) => Self::Text,  // default = text
            Ok(invalid) => {
                eprintln!("FATAL: TOT_LOG_FORMAT must be \"text\" or \"json\", got \"{invalid}\"");
                std::process::exit(1);
            }
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Json => "json",
        }
    }
}

/// Initialize the global tracing subscriber with the configured format.
/// Emits a startup log field recording the selected format.
pub fn init_logging() -> LogFormat {
    let format = LogFormat::from_env();
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into());

    match format {
        LogFormat::Text => {
            fmt().with_env_filter(filter).init();
        }
        LogFormat::Json => {
            fmt().with_env_filter(filter).json().init();
        }
    }

    tracing::info!(log_format = format.as_str(), "backend logging initialized");
    format
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_format_is_text() {
        // When TOT_LOG_FORMAT is unset, default to text
        env::remove_var("TOT_LOG_FORMAT");
        assert_eq!(LogFormat::from_env(), LogFormat::Text);
    }

    #[test]
    fn json_format_from_env() {
        env::set_var("TOT_LOG_FORMAT", "json");
        assert_eq!(LogFormat::from_env(), LogFormat::Json);
        env::remove_var("TOT_LOG_FORMAT");
    }

    #[test]
    fn text_format_from_env() {
        env::set_var("TOT_LOG_FORMAT", "text");
        assert_eq!(LogFormat::from_env(), LogFormat::Text);
        env::remove_var("TOT_LOG_FORMAT");
    }

    #[test]
    fn as_str_round_trips() {
        assert_eq!(LogFormat::Text.as_str(), "text");
        assert_eq!(LogFormat::Json.as_str(), "json");
    }
}
