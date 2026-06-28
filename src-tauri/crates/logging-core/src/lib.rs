use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredLogEvent {
    pub domain: LogDomain,
    pub action: String,
    pub status: LogStatus,
    pub message: String,
    pub details: Map<String, Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LogDomain {
    Sync,
    Script,
    Remote,
    Conversion,
    Report,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LogStatus {
    Started,
    Succeeded,
    Failed,
    Cancelled,
    Info,
}

impl StructuredLogEvent {
    pub fn new(
        domain: LogDomain,
        action: impl Into<String>,
        status: LogStatus,
        message: impl Into<String>,
    ) -> Self {
        Self {
            domain,
            action: action.into(),
            status,
            message: message.into(),
            details: Map::new(),
        }
    }

    pub fn with_detail(mut self, key: impl Into<String>, value: impl Serialize) -> Self {
        let value = serde_json::to_value(value).unwrap_or(Value::Null);

        self.details.insert(key.into(), value);

        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn structured_log_event_serializes_with_stable_field_names() {
        let event = StructuredLogEvent::new(
            LogDomain::Sync,
            "copyLeftToRight",
            LogStatus::Succeeded,
            "Copied file",
        )
        .with_detail("relativePath", "src/main.rs")
        .with_detail("bytes", 128_u64);

        let json = serde_json::to_value(event).expect("event should serialize");

        assert_eq!(json["domain"], "sync");
        assert_eq!(json["action"], "copyLeftToRight");
        assert_eq!(json["status"], "succeeded");
        assert_eq!(json["message"], "Copied file");
        assert_eq!(json["details"]["relativePath"], "src/main.rs");
        assert_eq!(json["details"]["bytes"], 128);
    }
}
