use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RegistryHive {
    ClassesRoot,
    CurrentUser,
    LocalMachine,
    Users,
    CurrentConfig,
}

impl RegistryHive {
    pub fn short_name(self) -> &'static str {
        match self {
            Self::ClassesRoot => "HKCR",
            Self::CurrentUser => "HKCU",
            Self::LocalMachine => "HKLM",
            Self::Users => "HKU",
            Self::CurrentConfig => "HKCC",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryKey {
    pub hive: RegistryHive,
    pub path: String,
}

impl RegistryKey {
    pub fn new(hive: RegistryHive, path: impl AsRef<str>) -> Self {
        Self {
            hive,
            path: normalize_registry_path(path.as_ref()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryValue {
    pub hive: RegistryHive,
    pub key_path: String,
    pub name: String,
    pub data: RegistryValueData,
    pub modified_at_ms: Option<u128>,
}

impl RegistryValue {
    pub fn new(
        hive: RegistryHive,
        key_path: impl AsRef<str>,
        name: impl Into<String>,
        data: RegistryValueData,
    ) -> Self {
        Self {
            hive,
            key_path: normalize_registry_path(key_path.as_ref()),
            name: name.into(),
            data,
            modified_at_ms: None,
        }
    }

    pub fn with_modified_at_ms(mut self, modified_at_ms: u128) -> Self {
        self.modified_at_ms = Some(modified_at_ms);

        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RegistryValueData {
    String(String),
    ExpandString(String),
    Dword(u32),
    Qword(u64),
    Binary(Vec<u8>),
    MultiString(Vec<String>),
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryDocument {
    pub name: String,
    keys: BTreeMap<String, RegistryKey>,
    values: BTreeMap<String, RegistryValue>,
}

impl RegistryDocument {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            keys: BTreeMap::new(),
            values: BTreeMap::new(),
        }
    }

    pub fn with_key(mut self, key: RegistryKey) -> Self {
        self.keys.insert(registry_key_id(key.hive, &key.path), key);

        self
    }

    pub fn with_value(mut self, value: RegistryValue) -> Self {
        self.values.insert(
            registry_value_id(value.hive, &value.key_path, &value.name),
            value,
        );

        self
    }

    pub fn key(&self, hive: RegistryHive, path: impl AsRef<str>) -> RegistryResult<&RegistryKey> {
        let path = normalize_registry_path(path.as_ref());

        self.keys
            .get(&registry_key_id(hive, &path))
            .ok_or_else(|| RegistryError::KeyNotFound(registry_key_id(hive, &path)))
    }

    pub fn value(
        &self,
        hive: RegistryHive,
        key_path: impl AsRef<str>,
        name: &str,
    ) -> RegistryResult<&RegistryValue> {
        let key_path = normalize_registry_path(key_path.as_ref());
        let id = registry_value_id(hive, &key_path, name);

        self.values.get(&id).ok_or(RegistryError::ValueNotFound(id))
    }

    pub fn child_keys(
        &self,
        hive: RegistryHive,
        path: impl AsRef<str>,
    ) -> RegistryResult<Vec<&RegistryKey>> {
        let path = normalize_registry_path(path.as_ref());
        self.key(hive, &path)?;

        Ok(self
            .keys
            .values()
            .filter(|key| key.hive == hive && is_direct_child(&path, &key.path))
            .collect())
    }

    pub fn values(
        &self,
        hive: RegistryHive,
        key_path: impl AsRef<str>,
    ) -> RegistryResult<Vec<&RegistryValue>> {
        let key_path = normalize_registry_path(key_path.as_ref());
        self.key(hive, &key_path)?;

        Ok(self
            .values
            .values()
            .filter(|value| value.hive == hive && value.key_path == key_path)
            .collect())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegistryError {
    KeyNotFound(String),
    ValueNotFound(String),
}

pub type RegistryResult<T> = Result<T, RegistryError>;

fn registry_key_id(hive: RegistryHive, path: &str) -> String {
    if path.is_empty() {
        return hive.short_name().to_owned();
    }

    format!("{}/{}", hive.short_name(), path)
}

fn registry_value_id(hive: RegistryHive, key_path: &str, name: &str) -> String {
    format!("{}/{}", registry_key_id(hive, key_path), name)
}

fn normalize_registry_path(path: &str) -> String {
    path.replace('\\', "/")
        .split('/')
        .map(str::trim)
        .filter(|segment| !segment.is_empty() && *segment != ".")
        .collect::<Vec<_>>()
        .join("/")
}

fn is_direct_child(parent: &str, path: &str) -> bool {
    if parent == path {
        return false;
    }

    let prefix = if parent.is_empty() {
        String::new()
    } else {
        format!("{}/", parent)
    };

    path.strip_prefix(&prefix)
        .is_some_and(|relative| !relative.is_empty() && !relative.contains('/'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_document_stores_keys_and_values_by_normalized_path() {
        let document = RegistryDocument::new("machine")
            .with_key(RegistryKey::new(
                RegistryHive::LocalMachine,
                "Software\\OpenDiff",
            ))
            .with_value(
                RegistryValue::new(
                    RegistryHive::LocalMachine,
                    "Software/OpenDiff",
                    "InstallPath",
                    RegistryValueData::String("C:/Program Files/Open Diff".to_owned()),
                )
                .with_modified_at_ms(1_700_000_000_000),
            );

        let key = document
            .key(RegistryHive::LocalMachine, "Software/OpenDiff")
            .unwrap();
        let value = document
            .value(
                RegistryHive::LocalMachine,
                "Software/OpenDiff",
                "InstallPath",
            )
            .unwrap();

        assert_eq!(key.path, "Software/OpenDiff");
        assert_eq!(value.name, "InstallPath");
        assert_eq!(
            value.data,
            RegistryValueData::String("C:/Program Files/Open Diff".to_owned())
        );
        assert_eq!(value.modified_at_ms, Some(1_700_000_000_000));
    }

    #[test]
    fn registry_document_lists_direct_child_keys_and_values() {
        let document = RegistryDocument::new("machine")
            .with_key(RegistryKey::new(RegistryHive::CurrentUser, "Software"))
            .with_key(RegistryKey::new(
                RegistryHive::CurrentUser,
                "Software/OpenDiff",
            ))
            .with_key(RegistryKey::new(
                RegistryHive::CurrentUser,
                "Software/OpenDiff/Settings",
            ))
            .with_value(RegistryValue::new(
                RegistryHive::CurrentUser,
                "Software/OpenDiff",
                "Theme",
                RegistryValueData::String("dark".to_owned()),
            ));

        let children = document
            .child_keys(RegistryHive::CurrentUser, "Software")
            .unwrap();
        let values = document
            .values(RegistryHive::CurrentUser, "Software/OpenDiff")
            .unwrap();

        assert_eq!(children.len(), 1);
        assert_eq!(children[0].path, "Software/OpenDiff");
        assert_eq!(values.len(), 1);
        assert_eq!(values[0].name, "Theme");
    }

    #[test]
    fn registry_document_reports_missing_keys() {
        let document = RegistryDocument::new("machine");

        let error = document
            .key(RegistryHive::LocalMachine, "Software/Missing")
            .unwrap_err();

        assert!(matches!(
            error,
            RegistryError::KeyNotFound(path) if path == "HKLM/Software/Missing"
        ));
    }
}
