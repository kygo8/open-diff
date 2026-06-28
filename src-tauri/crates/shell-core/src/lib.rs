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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_windows_context_menu_registration_script_for_files_and_directories() {
        let config = WindowsShellExtensionConfig::new(
            "Open Diff",
            "C:/Program Files/Open Diff/open-diff-app.exe",
        );

        let script = WindowsShellExtensionScriptBuilder::new(config).registration_script();

        assert!(script.contains("HKCU:\\Software\\Classes\\*\\shell\\OpenDiff"));
        assert!(script.contains("HKCU:\\Software\\Classes\\Directory\\shell\\OpenDiff"));
        assert!(script.contains("Compare with Open Diff"));
        assert!(script.contains("open-diff-app.exe"));
        assert!(script.contains("--shell-compare"));
        assert!(script.contains("%1"));
    }

    #[test]
    fn builds_windows_context_menu_uninstall_script_for_registered_keys() {
        let config = WindowsShellExtensionConfig::new(
            "Open Diff",
            "C:/Program Files/Open Diff/open-diff-app.exe",
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
}
