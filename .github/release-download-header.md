## 下载说明 / Which file to download

请按设备选择安装包（文件名中的版本号会随发行变化）。完整说明见仓库文档：[docs/下载说明.md](https://github.com/kygo8/open-diff/blob/master/docs/下载说明.md)。

| 你的设备 / Device                      | 下载这个文件 / Download                                                    | 不要下 / Avoid                     |
| -------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| **Windows** 64 位（几乎所有 Win10/11） | `*_windows_x64.msi`（安装版）或 `*_windows_x64_portable.zip`（绿色便携版） | `darwin_*`、`linux_*`、Source code |
| **Mac Apple 芯片**（M1/M2/M3/M4/M5…）  | `*_darwin_aarch64.dmg`（推荐）或 `*_darwin_aarch64.app.tar.gz`             | `*_darwin_x64.*`                   |
| **Mac Intel**                          | `*_darwin_x64.dmg`（推荐）或 `*_darwin_x64.app.tar.gz`                     | `*_darwin_aarch64.*`               |
| **Linux** Debian / Ubuntu / Mint       | `*_linux_amd64.deb`                                                        | 错用 `.rpm`（除非你清楚）          |
| **Linux** Fedora / RHEL / openSUSE     | `*_linux_x86_64.rpm`                                                       | 错用 `.deb`（除非你清楚）          |
| **Linux** 任意 x86_64、免安装试用      | `*_linux_amd64.AppImage`（先 `chmod +x`）                                  | Windows / macOS 包                 |

怎么确认芯片：Mac → 苹果菜单「关于本机」；Linux → `uname -m`（需为 `x86_64`）。当前无 32 位 Windows、无 Linux ARM 预编译包。**不要下载 Source code**（那是源码，不是安装包）。

### macOS：「已损坏，无法打开」？

当前 macOS 包**未**做 Apple 公证。Gatekeeper 隔离标记可能导致“已损坏”提示——**文件通常并未损坏**。把应用放到「应用程序」后，在「终端」执行：

```bash
xattr -cr /Applications/OpenDiff.app
```

然后重新打开。也可用「系统设置 → 隐私与安全性」里的「仍要打开」。详细步骤见 [下载说明 · macOS](https://github.com/kygo8/open-diff/blob/master/docs/下载说明.md#打开时提示已损坏无法打开)。Apple 芯片务必选 `darwin_aarch64`，Intel 选 `darwin_x64`。

---
