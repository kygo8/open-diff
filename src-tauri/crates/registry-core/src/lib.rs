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
    Parse(String),
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

pub struct RegFileParser;

impl RegFileParser {
    pub fn parse(name: impl Into<String>, input: &str) -> RegistryResult<RegistryDocument> {
        let mut lines = input.lines();
        let Some(header) = lines.next().map(str::trim) else {
            return Err(RegistryError::Parse("missing REG file header".to_owned()));
        };

        if header != "Windows Registry Editor Version 5.00" && header != "REGEDIT4" {
            return Err(RegistryError::Parse(
                "unsupported REG file header".to_owned(),
            ));
        }

        let mut document = RegistryDocument::new(name);
        let mut current_key: Option<RegistryKey> = None;

        for raw_line in lines {
            let line = raw_line.trim();

            if line.is_empty() || line.starts_with(';') {
                continue;
            }

            if line.starts_with('[') && line.ends_with(']') {
                let key = parse_reg_key(&line[1..line.len() - 1])?;
                document = document.with_key(key.clone());
                current_key = Some(key);
                continue;
            }

            let Some(key) = &current_key else {
                return Err(RegistryError::Parse(
                    "value line appeared before a registry key".to_owned(),
                ));
            };

            let Some(value) = parse_reg_value(line, key)? else {
                continue;
            };

            document = document.with_value(value);
        }

        Ok(document)
    }
}

fn parse_reg_key(input: &str) -> RegistryResult<RegistryKey> {
    let (hive_name, path) = input
        .split_once('\\')
        .ok_or_else(|| RegistryError::Parse(format!("invalid registry key: {input}")))?;
    let hive = parse_hive(hive_name)?;

    Ok(RegistryKey::new(hive, path))
}

fn parse_hive(input: &str) -> RegistryResult<RegistryHive> {
    match input {
        "HKEY_CLASSES_ROOT" | "HKCR" => Ok(RegistryHive::ClassesRoot),
        "HKEY_CURRENT_USER" | "HKCU" => Ok(RegistryHive::CurrentUser),
        "HKEY_LOCAL_MACHINE" | "HKLM" => Ok(RegistryHive::LocalMachine),
        "HKEY_USERS" | "HKU" => Ok(RegistryHive::Users),
        "HKEY_CURRENT_CONFIG" | "HKCC" => Ok(RegistryHive::CurrentConfig),
        _ => Err(RegistryError::Parse(format!(
            "unsupported registry hive: {input}"
        ))),
    }
}

fn parse_reg_value(line: &str, key: &RegistryKey) -> RegistryResult<Option<RegistryValue>> {
    let (raw_name, raw_data) = line
        .split_once('=')
        .ok_or_else(|| RegistryError::Parse(format!("invalid registry value line: {line}")))?;

    if raw_data == "-" {
        return Ok(None);
    }

    let name = if raw_name == "@" {
        "@".to_owned()
    } else {
        parse_quoted(raw_name)?
    };
    let data = parse_reg_value_data(raw_data)?;

    Ok(Some(RegistryValue::new(key.hive, &key.path, name, data)))
}

fn parse_reg_value_data(input: &str) -> RegistryResult<RegistryValueData> {
    if input.starts_with('"') {
        return parse_quoted(input).map(RegistryValueData::String);
    }

    if let Some(hex) = input.strip_prefix("dword:") {
        return u32::from_str_radix(hex, 16)
            .map(RegistryValueData::Dword)
            .map_err(|_| RegistryError::Parse(format!("invalid dword value: {input}")));
    }

    if let Some(hex) = input.strip_prefix("hex:") {
        let mut bytes = Vec::new();

        for part in hex
            .split(',')
            .map(str::trim)
            .filter(|part| !part.is_empty())
        {
            bytes.push(
                u8::from_str_radix(part, 16)
                    .map_err(|_| RegistryError::Parse(format!("invalid hex byte: {part}")))?,
            );
        }

        return Ok(RegistryValueData::Binary(bytes));
    }

    Err(RegistryError::Parse(format!(
        "unsupported registry value data: {input}"
    )))
}

fn parse_quoted(input: &str) -> RegistryResult<String> {
    if !input.starts_with('"') || !input.ends_with('"') {
        return Err(RegistryError::Parse(format!(
            "expected quoted string: {input}"
        )));
    }

    let mut output = String::new();
    let mut escaped = false;

    for character in input[1..input.len() - 1].chars() {
        if escaped {
            output.push(match character {
                '\\' => '\\',
                '"' => '"',
                'n' => '\n',
                'r' => '\r',
                't' => '\t',
                other => other,
            });
            escaped = false;
            continue;
        }

        if character == '\\' {
            escaped = true;
        } else {
            output.push(character);
        }
    }

    Ok(output)
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

    #[test]
    fn parses_reg_files_into_registry_documents() {
        let document = RegFileParser::parse(
            "fixture.reg",
            r#"Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\Software\OpenDiff]
@="Default Label"
"InstallPath"="C:\\Program Files\\Open Diff"
"Enabled"=dword:00000001
"Payload"=hex:01,02,0a

[HKEY_CURRENT_USER\Software\OpenDiff\Settings]
"Theme"="dark"
"Removed"=-
"#,
        )
        .unwrap();

        assert_eq!(
            document
                .value(
                    RegistryHive::LocalMachine,
                    "Software/OpenDiff",
                    "InstallPath"
                )
                .unwrap()
                .data,
            RegistryValueData::String("C:\\Program Files\\Open Diff".to_owned())
        );
        assert_eq!(
            document
                .value(RegistryHive::LocalMachine, "Software/OpenDiff", "Enabled")
                .unwrap()
                .data,
            RegistryValueData::Dword(1)
        );
        assert_eq!(
            document
                .value(RegistryHive::LocalMachine, "Software/OpenDiff", "Payload")
                .unwrap()
                .data,
            RegistryValueData::Binary(vec![0x01, 0x02, 0x0a])
        );
        assert_eq!(
            document
                .value(
                    RegistryHive::CurrentUser,
                    "Software/OpenDiff/Settings",
                    "Theme"
                )
                .unwrap()
                .data,
            RegistryValueData::String("dark".to_owned())
        );
        assert!(matches!(
            document.value(
                RegistryHive::CurrentUser,
                "Software/OpenDiff/Settings",
                "Removed"
            ),
            Err(RegistryError::ValueNotFound(_))
        ));
    }

    #[test]
    fn rejects_reg_files_without_supported_header() {
        let error =
            RegFileParser::parse("broken.reg", "[HKEY_CURRENT_USER\\Software]").unwrap_err();

        assert!(matches!(error, RegistryError::Parse(_)));
    }
}
