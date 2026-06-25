//! Logging configuration and startup verification.
//!
//! Reads the `TOT_LOG_FORMAT` environment variable to select the
//! tracing subscriber format (`text` or `json`).  The selected format
//! is emitted as a structured startup field so operators can confirm
//! the active mode from the first log line.

use std::env;
use tracing_subscriber::{fmt, EnvFilter};

/// Supported backend log formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogFormat {
    /// Human-readable text output (default).
    Text,
    /// Machine-readable JSON output (production / log aggregators).
    Json,
}

impl LogFormat {
    /// Parse from the `TOT_LOG_FORMAT` environment variable.
    ///
    /// Returns `None` for unknown values so the caller can treat them as
    /// a fatal startup error, preserving the existing invalid-value
    /// failure behaviour.
    pub fn from_env() -> Option<Self> {
        match env::var("TOT_LOG_FORMAT").as_deref() {
            Ok("json") => Some(Self::Json),
            Ok("text") | Err(_) => Some(Self::Text), // default is text
            Ok(other) => {
                eprintln!(
                    "[tent-backend] invalid TOT_LOG_FORMAT={:?}; expected 'text' or 'json'",
                    other
                );
                None
            }
        }
    }

    /// String representation used in the startup log field.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Json => "json",
        }
    }
}

/// Initialise the global tracing subscriber and emit the startup format field.
///
/// Call once at the top of `main()` before any other code runs.
/// Panics if called more than once (tracing-subscriber contract).
///
/// # Errors
/// Returns `Err` when `TOT_LOG_FORMAT` is set to an unsupported value.
pub fn init() -> anyhow::Result<LogFormat> {
    let fmt = LogFormat::from_env()
        .ok_or_else(|| anyhow::anyhow!("invalid TOT_LOG_FORMAT value; expected 'text' or 'json'"))?;

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into());

    match fmt {
        LogFormat::Json => {
            fmt::Subscriber::builder()
                .with_env_filter(filter)
                .json()
                .init();
        }
        LogFormat::Text => {
            fmt::Subscriber::builder()
                .with_env_filter(filter)
                .init();
        }
    }

    // Emit the startup confirmation field so operators can verify the
    // selected formatter from the very first log event.
    tracing::info!(
        log_format = fmt.as_str(),
        "logging initialised"
    );

    Ok(fmt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_is_default_when_var_absent() {
        // Remove the variable so we hit the Err(_) arm.
        unsafe { env::remove_var("TOT_LOG_FORMAT") };
        assert_eq!(LogFormat::from_env(), Some(LogFormat::Text));
    }

    #[test]
    fn json_is_selected_when_set() {
        unsafe { env::set_var("TOT_LOG_FORMAT", "json") };
        assert_eq!(LogFormat::from_env(), Some(LogFormat::Json));
        unsafe { env::remove_var("TOT_LOG_FORMAT") };
    }

    #[test]
    fn text_explicit_is_selected_when_set() {
        unsafe { env::set_var("TOT_LOG_FORMAT", "text") };
        assert_eq!(LogFormat::from_env(), Some(LogFormat::Text));
        unsafe { env::remove_var("TOT_LOG_FORMAT") };
    }

    #[test]
    fn invalid_value_returns_none() {
        unsafe { env::set_var("TOT_LOG_FORMAT", "xml") };
        assert_eq!(LogFormat::from_env(), None);
        unsafe { env::remove_var("TOT_LOG_FORMAT") };
    }

    #[test]
    fn as_str_matches_env_values() {
        assert_eq!(LogFormat::Text.as_str(), "text");
        assert_eq!(LogFormat::Json.as_str(), "json");
    }
}
