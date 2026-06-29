# SVN 外部比较工具集成

Open Diff 可以通过 `open-diff-cli svn-diff` 作为 Subversion 的外部 diff wrapper 使用。

## 工作方式

Subversion 的 `diff-cmd` 会接收 GNU diff 风格参数。`open-diff-cli svn-diff` 会从这些参数中取最后两个文件路径，并执行文本对比。

## 生成配置说明

使用以下命令生成 Subversion 配置片段和 Windows wrapper 脚本模板：

```powershell
open-diff-cli svn-diff-config "C:/Program Files/OpenDiff/open-diff-cli.exe" "C:/Tools/open-diff-svn-diff.cmd"
```

输出内容包含：

- `[helpers] diff-cmd` 配置片段。
- `diff-extensions = -u` 建议配置。
- Windows `.cmd` wrapper 脚本模板。
- 一次性 `svn diff --diff-cmd` 示例。

## Subversion 配置片段

将生成的配置加入 Subversion 用户配置文件的 `[helpers]` 段：

```ini
[helpers]
diff-cmd = C:/Tools/open-diff-svn-diff.cmd
diff-extensions = -u
```

## Windows Wrapper 示例

创建 `C:/Tools/open-diff-svn-diff.cmd`：

```bat
@echo off
"C:/Program Files/OpenDiff/open-diff-cli.exe" svn-diff %*
```

## 一次性运行

不修改全局配置时，可以在仓库中使用：

```powershell
svn diff --diff-cmd "C:/Tools/open-diff-svn-diff.cmd"
```
