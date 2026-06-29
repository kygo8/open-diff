#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellCompareSessionType {
    Text,
    Folder,
    Hex,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellCompareAction {
    pub left: String,
    pub right: String,
    pub session_type: ShellCompareSessionType,
    pub route: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShellCompareOutcome {
    PendingLeft { left: String },
    Ready(ShellCompareAction),
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ShellCompareFlow {
    pending_left: Option<String>,
}

impl ShellCompareFlow {
    pub fn select_path(
        &mut self,
        path: impl Into<String>,
    ) -> Result<ShellCompareOutcome, ShellCompareFlowError> {
        let path = normalize_shell_path(path.into())?;

        let Some(left) = self.pending_left.take() else {
            self.pending_left = Some(path.clone());

            return Ok(ShellCompareOutcome::PendingLeft { left: path });
        };

        let session_type = classify_shell_compare_session(&left, &path);
        let route = route_for_shell_compare_session(session_type).to_owned();

        Ok(ShellCompareOutcome::Ready(ShellCompareAction {
            left,
            right: path,
            session_type,
            route,
        }))
    }

    pub fn pending_left(&self) -> Option<&str> {
        self.pending_left.as_deref()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShellCompareFlowError {
    EmptyPath,
    Io(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellCompareStateStore {
    path: std::path::PathBuf,
}

impl ShellCompareStateStore {
    pub fn new(path: impl AsRef<std::path::Path>) -> Self {
        Self {
            path: path.as_ref().to_path_buf(),
        }
    }

    pub fn select_path(
        &self,
        path: impl Into<String>,
    ) -> Result<ShellCompareOutcome, ShellCompareFlowError> {
        let mut flow = ShellCompareFlow {
            pending_left: self.read_pending_left()?,
        };
        let outcome = flow.select_path(path)?;

        match &outcome {
            ShellCompareOutcome::PendingLeft { left } => self.write_pending_left(left)?,
            ShellCompareOutcome::Ready(_) => self.clear_pending_left()?,
        }

        Ok(outcome)
    }

    fn read_pending_left(&self) -> Result<Option<String>, ShellCompareFlowError> {
        match std::fs::read_to_string(&self.path) {
            Ok(value) => Ok(Some(value)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(ShellCompareFlowError::Io(error.to_string())),
        }
    }

    fn write_pending_left(&self, left: &str) -> Result<(), ShellCompareFlowError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| ShellCompareFlowError::Io(error.to_string()))?;
        }

        std::fs::write(&self.path, left)
            .map_err(|error| ShellCompareFlowError::Io(error.to_string()))
    }

    fn clear_pending_left(&self) -> Result<(), ShellCompareFlowError> {
        match std::fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(ShellCompareFlowError::Io(error.to_string())),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsShellExtensionConfig {
    pub product_name: String,
    pub executable_path: String,
    pub verb_key: String,
}

impl WindowsShellExtensionConfig {
    pub fn new(product_name: impl Into<String>, executable_path: impl Into<String>) -> Self {
        Self {
            product_name: product_name.into(),
            executable_path: executable_path.into(),
            verb_key: "OpenDiff".to_owned(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsShellExtensionScriptBuilder {
    config: WindowsShellExtensionConfig,
}

impl WindowsShellExtensionScriptBuilder {
    pub fn new(config: WindowsShellExtensionConfig) -> Self {
        Self { config }
    }

    pub fn registration_script(&self) -> String {
        let label = powershell_quote(&format!("Compare with {}", self.config.product_name));
        let executable = powershell_quote(&self.config.executable_path);
        let command = powershell_quote(&format!(
            "& {} --shell-compare \"%1\"",
            powershell_quote(&self.config.executable_path)
        ));
        let file_key = self.file_context_menu_key();
        let directory_key = self.directory_context_menu_key();

        format!(
            r#"# Register Open Diff Windows context menu entries for the current user.
$ErrorActionPreference = 'Stop'

$entries = @(
  @{{
    Key = '{file_key}'
    Label = {label}
    Command = {command}
  }},
  @{{
    Key = '{directory_key}'
    Label = {label}
    Command = {command}
  }}
)

foreach ($entry in $entries) {{
  New-Item -Path $entry.Key -Force | Out-Null
  New-ItemProperty -Path $entry.Key -Name 'MUIVerb' -Value $entry.Label -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $entry.Key -Name 'Icon' -Value {executable} -PropertyType String -Force | Out-Null
  New-Item -Path "$($entry.Key)\command" -Force | Out-Null
  Set-ItemProperty -Path "$($entry.Key)\command" -Name '(default)' -Value $entry.Command
}}
"#
        )
    }

    pub fn uninstall_script(&self) -> String {
        let file_key = self.file_context_menu_key();
        let directory_key = self.directory_context_menu_key();

        format!(
            r#"# Remove Open Diff Windows context menu entries for the current user.
$ErrorActionPreference = 'Stop'

$keys = @(
  '{file_key}',
  '{directory_key}'
)

foreach ($key in $keys) {{
  if (Test-Path -LiteralPath $key) {{
    Remove-Item -LiteralPath $key -Recurse -Force
  }}
}}
"#
        )
    }

    fn file_context_menu_key(&self) -> String {
        format!(
            "HKCU:\\Software\\Classes\\*\\shell\\{}",
            self.config.verb_key
        )
    }

    fn directory_context_menu_key(&self) -> String {
        format!(
            "HKCU:\\Software\\Classes\\Directory\\shell\\{}",
            self.config.verb_key
        )
    }
}

fn powershell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn normalize_shell_path(path: String) -> Result<String, ShellCompareFlowError> {
    let trimmed = path.trim();

    if trimmed.is_empty() {
        return Err(ShellCompareFlowError::EmptyPath);
    }

    Ok(trimmed.replace('\\', "/"))
}

fn classify_shell_compare_session(left: &str, right: &str) -> ShellCompareSessionType {
    let left_extension = extension(left);
    let right_extension = extension(right);

    if left_extension.is_none() && right_extension.is_none() {
        return ShellCompareSessionType::Folder;
    }

    if left_extension
        .zip(right_extension)
        .is_some_and(|(left, right)| is_text_extension(left) && is_text_extension(right))
    {
        return ShellCompareSessionType::Text;
    }

    ShellCompareSessionType::Hex
}

fn route_for_shell_compare_session(session_type: ShellCompareSessionType) -> &'static str {
    match session_type {
        ShellCompareSessionType::Text => "/compare/text",
        ShellCompareSessionType::Folder => "/compare/folder",
        ShellCompareSessionType::Hex => "/compare/hex",
    }
}

fn extension(path: &str) -> Option<&str> {
    path.rsplit('/')
        .next()?
        .rsplit_once('.')
        .map(|(_, ext)| ext)
}

fn is_text_extension(extension: &str) -> bool {
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "cfg"
            | "css"
            | "csv"
            | "diff"
            | "html"
            | "ini"
            | "js"
            | "json"
            | "jsx"
            | "log"
            | "md"
            | "patch"
            | "rs"
            | "toml"
            | "ts"
            | "tsx"
            | "txt"
            | "vue"
            | "xml"
            | "yaml"
            | "yml"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_windows_context_menu_registration_script_for_files_and_directories() {
        let config = WindowsShellExtensionConfig::new(
            "OpenDiff",
            "C:/Program Files/OpenDiff/open-diff-app.exe",
        );

        let script = WindowsShellExtensionScriptBuilder::new(config).registration_script();

        assert!(script.contains("HKCU:\\Software\\Classes\\*\\shell\\OpenDiff"));
        assert!(script.contains("HKCU:\\Software\\Classes\\Directory\\shell\\OpenDiff"));
        assert!(script.contains("Compare with OpenDiff"));
        assert!(script.contains("open-diff-app.exe"));
        assert!(script.contains("--shell-compare"));
        assert!(script.contains("%1"));
    }

    #[test]
    fn builds_windows_context_menu_uninstall_script_for_registered_keys() {
        let config = WindowsShellExtensionConfig::new(
            "OpenDiff",
            "C:/Program Files/OpenDiff/open-diff-app.exe",
        );

        let script = WindowsShellExtensionScriptBuilder::new(config).uninstall_script();

        assert!(script.contains("Remove-Item"));
        assert!(script.contains("HKCU:\\Software\\Classes\\*\\shell\\OpenDiff"));
        assert!(script.contains("HKCU:\\Software\\Classes\\Directory\\shell\\OpenDiff"));
    }

    #[test]
    fn escapes_single_quotes_in_product_and_executable_paths() {
        let config = WindowsShellExtensionConfig::new(
            "Open Diff's Tool",
            "C:/Tools/Open Diff's/open-diff-app.exe",
        );

        let script = WindowsShellExtensionScriptBuilder::new(config).registration_script();

        assert!(script.contains("'Compare with Open Diff''s Tool'"));
        assert!(script.contains("'C:/Tools/Open Diff''s/open-diff-app.exe'"));
    }

    #[test]
    fn shell_compare_first_selection_records_pending_left_path() {
        let mut flow = ShellCompareFlow::default();

        let outcome = flow
            .select_path("D:/work/left.txt")
            .expect("first path should be accepted");

        assert_eq!(
            outcome,
            ShellCompareOutcome::PendingLeft {
                left: "D:/work/left.txt".to_owned(),
            }
        );
    }

    #[test]
    fn shell_compare_second_selection_builds_text_compare_action() {
        let mut flow = ShellCompareFlow::default();

        flow.select_path("D:/work/left.txt")
            .expect("first path should be accepted");
        let outcome = flow
            .select_path("D:/work/right.txt")
            .expect("second path should compare");

        assert_eq!(
            outcome,
            ShellCompareOutcome::Ready(ShellCompareAction {
                left: "D:/work/left.txt".to_owned(),
                right: "D:/work/right.txt".to_owned(),
                session_type: ShellCompareSessionType::Text,
                route: "/compare/text".to_owned(),
            })
        );
        assert!(flow.pending_left().is_none());
    }

    #[test]
    fn shell_compare_selects_folder_route_for_two_directories() {
        let mut flow = ShellCompareFlow::default();

        flow.select_path("D:/work/src")
            .expect("first path should be accepted");
        let outcome = flow
            .select_path("D:/work/dist")
            .expect("second path should compare");

        assert!(matches!(
            outcome,
            ShellCompareOutcome::Ready(ShellCompareAction {
                session_type: ShellCompareSessionType::Folder,
                route,
                ..
            }) if route == "/compare/folder"
        ));
    }

    #[test]
    fn shell_compare_state_store_persists_pending_selection_between_invocations() {
        let path = unique_temp_file("shell-state");
        let store = ShellCompareStateStore::new(&path);

        let first = store
            .select_path("D:/work/left.txt")
            .expect("first shell invocation should store left path");
        let second = store
            .select_path("D:/work/right.txt")
            .expect("second shell invocation should compare");

        assert_eq!(
            first,
            ShellCompareOutcome::PendingLeft {
                left: "D:/work/left.txt".to_owned()
            }
        );
        assert!(matches!(second, ShellCompareOutcome::Ready(_)));
        assert!(!path.exists());
    }

    fn unique_temp_file(label: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-{label}-{stamp}.txt"))
    }
}
