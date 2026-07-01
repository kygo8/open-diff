# Beyond Compare 5 功能与 UI 记录

记录时间：2026-07-01
目标软件：Beyond Compare 5 for Windows
本机版本：5.2.3.32296
本机路径：`C:\Users\q1\AppData\Local\Programs\Beyond Compare 5\BCompare.exe`

## 采集范围与来源

本文件同时记录两类信息：

- 实机 UI 抓取：通过 Windows UI Automation 打开 Beyond Compare 5 的主要会话类型，记录窗口标题、菜单栏、工具栏按钮、路径/状态字段和截图。
- 功能核对：以 Scooter Software 官方 v5 帮助、版本说明、功能对比、命令行和脚本文档为依据补齐功能说明。

实机抓取产物：

- 原始 UI 数据：`docs/assets/beyond-compare-5-capture/ui-capture.json`
- 截图目录：`docs/assets/beyond-compare-5-capture/`
- 采集样例目录：`%TEMP%\bc5-ui-capture`

限制说明：

- 没有对用户真实文件、真实注册表远程目标、远程 FTP/SFTP/云服务执行写入操作。
- Clipboard Compare 是托盘后台组件，Explorer Integration 是资源管理器右键扩展，本文依据官方说明记录功能；未对系统右键菜单做写入式配置验证。
- Media Compare 以空会话打开并记录 UI；标签字段比较能力依据官方 v5 帮助和 v5 新特性说明核对。

## 软件定位

Beyond Compare 是面向开发、运维和数据整理场景的比较、合并、同步工具。核心能力是把文件夹结构、文本、表格、二进制、图片、注册表、媒体标签、可执行文件版本信息等不同数据源统一放进会话视图中比较，并支持保存会话、生成报告、脚本自动化和命令行集成。

## v5 重点变化

- UI 支持亮色/暗色模式。
- Text Compare 和 Text Edit 支持自动换行。
- Table Compare 重做，支持多个 Excel sheet 和多个 HTML table。
- Windows 支持 Windows 11 右键菜单与按显示器缩放。
- Media Compare 扩展到 FLAC、MP3、MP4/AAC。
- Text Merge 支持手动对齐多行选择。
- Version Compare 支持更多版本头字段并改进错误处理。
- v5.1 改进 Home View，让不常用比较类型更容易发现。
- v5.2 增加 Unix owner/group/file type 和更多 Windows 文件属性的比较/过滤能力，并扩展管理员策略。

## 版本与授权差异

Standard 版本包含主要比较、编辑、会话、报告、脚本、命令行和本地/网络/FTP/归档文件能力。Pro 版本额外包含：

- Text Merge：二路/三路文本合并。
- Folder Merge：二路/三路文件夹合并。
- Windows Source Control Integration。
- 内置 SFTP 与 FTP over SSL。
- Text Compare 文本替换规则，用于把指定替换标记为不重要差异。
- Folder Compare 对齐覆盖等高级对齐能力。
- 安全 FTP、WebDAV、Amazon S3、Dropbox、OneDrive、远程 Subversion 等高级远程/云存储能力。

## 顶层 UI 结构

Home 视图打开时，窗口标题为 `Home - Beyond Compare`。顶部主菜单实际抓到：

- `Session`
- `View`
- `Tools`
- `Help`

Home 视图左侧是会话管理树，实际抓到的节点：

- `New`
- `Folder Compare`
- `Folder Merge`
- `Folder Sync`
- `Text Compare`
- `Text Merge`
- `Hex Compare`
- `Media Compare`
- `Picture Compare`
- `Registry Compare`
- `Table Compare`
- `Version Compare`
- `Auto-saved`
- `Today`

Home 视图中央是大按钮入口，实际抓到：

- `Folder Compare`
- `Folder Merge`
- `Folder Sync`
- `Text Compare`
- `Text Merge`
- `Hex Compare`
- `Media Compare`
- `Picture Compare`
- `Registry Compare`
- `Table Compare`
- `Version Compare`
- `Text Edit`

Home 视图还包含最近/保存会话打开入口：`Open`，以及默认设置编辑入口：`Edit`。

截图：`docs/assets/beyond-compare-5-capture/home.png`

## 通用菜单与全局功能

通用 `Session` 菜单包含：

- `New Session`：创建指定类型的新会话。
- `New Tab`：在当前窗口打开 Home。
- `New Window`：打开新窗口并显示 Home。
- `Open Session`：打开 Home 以选择保存会话。
- `Load Workspace`：载入已保存工作区。
- `Save Workspace As...`：保存当前窗口/标签配置为工作区。
- `Close Tab`
- `Exit`

`Tools` 菜单包含：

- `Options`：程序偏好设置。
- `File Formats`：管理文本、表格、十六进制、图片、外部格式等文件格式规则。
- `Profiles`：管理 FTP、Amazon S3、Dropbox、OneDrive、Subversion、WebDAV 等 profile。
- `Source Control Integration`：Windows 下 SCC 源码管理集成。
- `Export Settings` / `Import Settings` / `Restore Factory Defaults`
- `Save Snapshot`
- `Edit Text File`
- `View Patch`

`Help` 菜单包含帮助目录、上下文帮助、官网、检查更新、支持、输入 license key、关于等入口。

## 会话类型 UI 总表

| 会话             | 实际窗口标题                                                           | 顶部菜单                                          | 主要工具栏按钮                                                                                                                                      | 截图                                                        |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Home             | `Home - Beyond Compare`                                                | Session, View, Tools, Help                        | 12 个会话入口、Open、Edit                                                                                                                           | `docs/assets/beyond-compare-5-capture/home.png`             |
| Folder Compare   | `left <--> right - Folder Compare - Beyond Compare`                    | Session, Actions, Edit, Search, View, Tools, Help | Home, All, Same, Minor, Rules, Copy, Expand, Collapse, Select, Files, Refresh, Swap, Stop, Filters, Peek                                            | `docs/assets/beyond-compare-5-capture/folder-compare.png`   |
| Folder Merge     | `merge-output - Folder Merge - Beyond Compare`                         | Session, Actions, Edit, Search, View, Tools, Help | Home, All, Same, Minor, Same OK, Rules, Merge, To Output, Expand, Collapse, Select, Files, Refresh, Swap, Stop, Filters, Peek                       | `docs/assets/beyond-compare-5-capture/folder-merge.png`     |
| Folder Sync      | `Update: left <--> right - Folder Sync - Beyond Compare`               | Session, Actions, Edit, Search, View, Tools, Help | Home, Minor, Expand, Collapse, Select, Refresh, Stop, Peek, Sync Now, Cancel, Accept                                                                | `docs/assets/beyond-compare-5-capture/folder-sync.png`      |
| Text Compare     | `text-left.txt <--> text-right.txt - Text Compare - Beyond Compare`    | Session, File, Edit, Search, View, Tools, Help    | Home, All, Diffs, Same, Context, Minor, Rules, Copy, Next Section, Prev Section, Swap, Reload                                                       | `docs/assets/beyond-compare-5-capture/text-compare.png`     |
| Text Merge       | `merge-output.txt - Text Merge - Beyond Compare`                       | Session, File, Edit, Search, View, Tools, Help    | Home, All, Same, Context, Minor, Same OK, Favor Left, Favor Right, Rules, Conflict, Left, Center, Right, Next Conflict, Prev Conflict, Swap, Reload | `docs/assets/beyond-compare-5-capture/text-merge.png`       |
| Table Compare    | `table-left.csv <--> table-right.csv - Table Compare - Beyond Compare` | Session, File, Edit, Search, View, Tools, Help    | Home, All, Diffs, Same, Minor, Rules, Copy, Next Diff, Prev Diff, Swap, Reload                                                                      | `docs/assets/beyond-compare-5-capture/table-compare.png`    |
| Hex Compare      | `bin-left.bin <--> bin-right.bin - Hex Compare - Beyond Compare`       | Session, File, Edit, Search, View, Tools, Help    | Home, All, Diffs, Same, Rules, Copy, Next Diff, Prev Diff, Swap, Reload                                                                             | `docs/assets/beyond-compare-5-capture/hex-compare.png`      |
| Picture Compare  | `pic-left.png <--> pic-right.png - Picture Compare - Beyond Compare`   | Session, File, Edit, View, Tools, Help            | Home, Tol, Range, Blend, Minor, Rules, Swap, Reload, Meta                                                                                           | `docs/assets/beyond-compare-5-capture/picture-compare.png`  |
| Registry Compare | `reg-left.reg <--> reg-right.reg - Registry Compare - Beyond Compare`  | Session, File, Edit, Search, View, Tools, Help    | Home, All, Diffs, Same, Copy, Next Diff, Prev Diff, Swap, Reload, Expand, Collapse                                                                  | `docs/assets/beyond-compare-5-capture/registry-compare.png` |
| Version Compare  | `BCompare.exe <--> BComp.exe - Version Compare - Beyond Compare`       | Session, File, Edit, Search, View, Tools, Help    | Home, All, Diffs, Same, Minor, Rules, Next Diff, Prev Diff, Swap, Reload                                                                            | `docs/assets/beyond-compare-5-capture/version-compare.png`  |
| Media Compare    | `New Media Compare - Media Compare - Beyond Compare`                   | Session, File, Edit, Search, View, Tools, Help    | Home, All, Diffs, Same, Minor, Rules, Next Diff, Prev Diff, Swap, Reload, Play2, 后滚, 前滚                                                         | `docs/assets/beyond-compare-5-capture/media-compare.png`    |
| Text Edit        | `text-left.txt - Text Edit - Beyond Compare`                           | Session, File, Edit, Search, View, Tools, Help    | Home, Undo, Redo, Cut, Copy, Paste, Delete, Syntax                                                                                                  | `docs/assets/beyond-compare-5-capture/text-edit.png`        |
| Text Patch       | `patch.diff - Text Patch - Beyond Compare`                             | Session, File, Edit, Search, View, Tools, Help    | Home, Next Section, Prev Section                                                                                                                    | `docs/assets/beyond-compare-5-capture/text-patch.png`       |

## 功能按视图拆解

### Folder Compare

用途：比较两个文件夹结构。左右两侧可以是本地磁盘、网络路径、远程服务、归档文件或快照。

主要 UI：

- 左右路径栏。
- 文件/文件夹树形列表。
- 显示过滤按钮：All、Same、Minor 等。
- 操作按钮：Copy、Expand、Collapse、Select、Refresh、Swap、Stop、Filters、Peek。
- 底部状态字段会显示选择数量、字节数、剩余空间、加载时间等。

主要功能：

- 按名称、时间、大小、大小写、DOS/Unix 属性、内容、CRC、字节级、文件格式规则、exe/dll 版本等条件比较。
- 按文件名、目录名、大小、时间、属性、内容做过滤。
- 展开/折叠子目录，忽略文件夹结构，显示全部/差异/相同/孤立项/新旧项。
- 在两侧之间复制、移动、删除、重命名、改属性、改时间戳。
- 对选中文件打开子比较、Quick Compare、Open With、生成文件比较报告。
- 从当前基础目录切换到 Folder Merge 或 Folder Sync。
- 生成打印/HTML 报告。

### Folder Merge

用途：将两个或三个文件夹结构合并到输出文件夹。左、右是两个版本；中心侧可作为共同祖先；输出侧保存合并结果。

主要 UI：

- 四个路径栏：Left、Center、Right、Output。
- 文件夹树列表。
- `Merge` 与 `To Output` 操作按钮。
- `Same OK`、`Minor`、`Rules` 等差异分类按钮。

主要功能：

- 二路/三路文件夹合并。
- 自动合并可合并项，冲突项需要人工处理。
- 将选中内容复制到输出侧。
- 比较输出与左/中/右任一侧。
- 支持过滤、展开折叠、选择、刷新、源控件子菜单、Explorer 上下文菜单。

### Folder Sync

用途：专门用于同步两个文件夹，通过复制或删除完成目标同步。

主要 UI：

- 左右路径栏。
- 同步计划列表。
- `Sync Now`、`Accept`、`Cancel`。
- 操作按钮包括 Refresh、Stop、Peek。

主要功能：

- 运行同步任务。
- 将项目设置为 Leave Alone、Copy Right to Left、Copy Left to Right、Delete Left、Delete Right。
- 保存同步会话供重复执行。
- 打开当前基础目录的 Folder Compare。
- 支持过滤、选择、刷新和资源管理器上下文菜单。

### Text Compare

用途：对比两个文本文件，可横向并排或上下布局。

主要 UI：

- 两个同步滚动的文本编辑窗格。
- 差异缩略图/定位条。
- 当前行详情区，可切换文本详情、十六进制详情、对齐详情。
- 工具栏包含 All、Diffs、Same、Context、Minor、Rules、Copy、Next Section、Prev Section、Swap、Reload。

主要功能：

- 比较本地/网络文件、远程服务文件、归档内文件、网页内容。
- 支持从剪贴板打开文本进行比较。
- 用颜色区分重要差异和不重要差异。
- 支持编辑、复制差异到另一侧、按段落/行导航、查找文本。
- 支持自动换行、语法高亮、规则/文件格式控制差异重要性。
- 支持生成 Text Compare 报告。
- 可从当前比较打开 Text Merge 或比较父文件夹。

### Text Merge

用途：合并两个或三个文本来源到一个输出文件。

主要 UI：

- 左、右来源窗格；可选中心来源窗格；输出窗格可编辑。
- 工具栏包含 Favor Left、Favor Right、Conflict、Left、Center、Right、Next Conflict、Prev Conflict。
- 支持隐藏 Center Pane 和 Detached Output Pane。

主要功能：

- 自动构造初始输出内容。
- 用 Take/Left/Center/Right 类命令选取指定来源内容。
- 手动编辑输出结果。
- 自动合并，冲突时导航和人工处理。
- 支持自动换行和多行手动对齐。
- 注意：输出文件已有内容在保存合并结果时会被当前输出覆盖。

### Table Compare

用途：比较 CSV、表格文本、Excel sheet、HTML table 等表格数据。

主要 UI：

- 两个同步滚动的网格。
- 工具栏包含 All、Diffs、Same、Minor、Rules、Copy、Next Diff、Prev Diff、Swap、Reload。
- 行 gutter 用颜色标记行级比较状态。

主要功能：

- 按单元格比较。
- 可配置比较列，不要求比较列顺序与源文件列顺序一致。
- 可指定一个或多个 key 列用于行对齐。
- 未指定 key 列时可先排序再对齐。
- v5 支持多个 Excel sheet 和多个 HTML table。

### Hex Compare

用途：按字节比较两个文件的原始内容，以十六进制方式显示。

主要 UI：

- 左右文件路径栏。
- 十六进制/字节视图。
- 工具栏包含 All、Diffs、Same、Rules、Copy、Next Diff、Prev Diff、Swap、Reload。

主要功能：

- 字节级差异定位。
- 适合二进制、未知格式、压缩文件等不适合文本规则解析的文件。
- 支持导航、复制、重新加载、换侧比较。

### Picture Compare

用途：视觉对比两张图片。

主要 UI：

- 两侧图片区域。
- 工具栏包含 Tol、Range、Blend、Minor、Rules、Swap、Reload、Meta。

主要功能：

- 默认关联 GIF、ICO、JPG/JPEG、PNG、TIFF、BMP 等图片类型。
- 支持根据系统和第三方 codec 处理 PDF、RAW、PSD、JPEG 2000、Windows metafile 等更多格式。
- 以 32bpp 数据进行比较；HDR、wide-gamut、额外色彩空间不是当前支持重点。
- 可调整容差、范围、混合显示，并查看元数据。

### Registry Compare

用途：比较本机/网络机器 live registry 或 `.reg` 导出文件。

主要 UI：

- 两侧 registry 或 `.reg` 路径栏。
- 键和值的树/表结构。
- 工具栏包含 All、Diffs、Same、Copy、Next Diff、Prev Diff、Swap、Reload、Expand、Collapse。

主要功能：

- 按名称排序并对齐 key/value。
- key 颜色表示差异或孤立项。
- value 颜色突出字符级差异。
- 加载后可直接编辑 live registry，包含复制、删除、重命名、添加，以及双击值修改类型和数据。

### Media Compare

用途：比较媒体文件的标签字段。

主要 UI：

- 空会话标题为 `New Media Compare - Media Compare - Beyond Compare`。
- 工具栏包含 All、Diffs、Same、Minor、Rules、Next Diff、Prev Diff、Swap、Reload、Play、前滚/后滚。

主要功能：

- 支持 FLAC、MP3、MP4/AAC 等媒体标签比较。
- 差异字段会被高亮。
- 提供播放和定位相关控制。

### Version Compare

用途：比较 Windows 可执行文件的版本信息。

主要 UI：

- 两侧可执行文件路径栏。
- 版本字段比较表。
- 工具栏包含 All、Diffs、Same、Minor、Rules、Next Diff、Prev Diff、Swap、Reload。

主要功能：

- 比较 `.exe` 等文件的版本资源字段。
- v5 改进更多 header 字段、MUI 处理和错误处理。

### Text Edit

用途：单窗格文本编辑器。

主要 UI：

- 单个文本编辑窗格。
- 工具栏包含 Undo、Redo、Cut、Copy、Paste、Delete、Syntax。

主要功能：

- 直接编辑文本文件。
- 支持语法规则、文本格式、编码/行尾相关设置。
- 可作为 Folder/File Compare 中 Open With 的内置编辑器。

### Text Patch

用途：读取 patch/diff 文件，并以比较视图重建补丁中的差异。

主要 UI：

- patch 内容视图。
- 工具栏包含 Next Section、Prev Section。

主要功能：

- 打开 `.diff` 或 `.patch`。
- 可由 Text Compare 报告或其他 diff 工具生成的 patch 文件重建比较。

### Clipboard Compare

用途：后台监控 Windows 剪贴板中的文本更新，并从托盘入口查看历史。

主要功能：

- 点击托盘图标查看最近剪贴板文本条目。
- 可对剪贴板条目执行 Save As、Delete、Open With Text Edit。
- 可配置 `Ctrl+Alt+C` 打开最近两条剪贴板文本的比较。
- 删除历史条目不影响 Windows 当前剪贴板。

### Explorer Integration

用途：把 Beyond Compare 加入 Windows Explorer 右键菜单。

主要命令：

- `Compare`
- `Compare to <file/folder>`
- `Compare Left to <folder>\<file>`
- `Select Left File / Select Left Folder`
- `Compare Using`
- `Compare to <file> Using`
- `Compare Using Hex`
- `Compare to Clipboard`
- `Compare to Registry`
- `Sync`
- `Sync with <folder>`
- `Merge`
- `Merge with <file/folder>`
- `Select Center File / Select Center Folder`
- `Open for Compare`
- `Edit`
- `View Patch`

## 设置与规则系统

Program Options 包含：

- Startup
- Tabs
- Appearance，包括 Folder Views、File Views、Picture Compare 颜色和字体。
- Text Editing
- Next Difference
- Backups
- File Operations
- Archive Types
- Commands，用于自定义快捷键，并控制菜单/工具栏命令显隐。
- Open With
- Tweaks

Session Settings 覆盖各会话类型：

- Folder Compare：Specs、Comparison、Handling、Name Filters、Other Filters、Misc。
- Folder Merge：Specs、Comparison、Handling、Name Filters、Other Filters、Misc。
- Folder Sync：Specs、Sync、Comparison、Handling、Name Filters、Other Filters、Misc。
- Text Compare：Specs、Format、Importance、Alignment、Replacements。
- Text Merge：Specs、Format、Importance、Alignment。
- Table Compare：Specs、Format、Sheets、Columns、Rows。
- Hex Compare：Specs、Format、Comparison。
- Media Compare：Specs、Importance。
- Picture Compare：Specs、Format、Replacements。
- Registry Compare：Specs。
- Version Compare：Specs、Importance。

File Formats 支持：

- Text Formats：General、Conversion、Grammar、Misc。
- Table Format：General、Conversion、Type、Regional。
- Hex Format：General、Conversion。
- Picture Format：General、Conversion。
- External Format。

Profiles 支持：

- FTP Profiles：Global、Login、Server、Connection、Proxy、Listings、Transfer。
- Amazon S3 Profiles。
- Dropbox Profiles。
- OneDrive Profiles。
- Subversion Profiles。
- WebDAV Profiles。

## 报告、命令行与脚本

报告：

- Folder Compare Report。
- File Compare Report。
- Text Compare Report。
- 支持打印和 HTML 报告，Folder Compare HTML 报告可链接到单个文件比较报告。

命令行入口：

- `BCompare.exe` / `bcompare`：主程序入口。
- `BComp.exe`：GUI 入口，适合版本控制系统调用。
- `BComp.com` / `bcomp`：控制台入口，可等待比较完成并返回 exit code。

命令行可打开：

- 保存会话。
- 保存工作区。
- 两个文件夹。
- 两个文件。
- 三个或四个文件，用于 Text Merge。
- 脚本文件。
- `.bcpkg` 设置包。
- `.diff` / `.patch`。
- stdin。

重要命令行开关：

- `/fv=<type>`：指定视图类型，可选 Text Compare、Text Merge、Table Compare、Hex Compare、Media Compare、Picture Compare、Registry Compare、Version Compare、Folder Compare、Folder Merge、Folder Sync、Text Edit、Text Patch。
- `/qc=<type>`：快速比较并设置返回码。
- `/sync`：打开 Folder Sync。
- `/automerge`：无冲突时自动合并。
- `/mergeoutput=<filename>`：指定合并输出。
- `/reviewconflicts`：自动合并失败且有冲突时打开交互窗口。
- `/ro`、`/ro1`、`/ro2` 等：设置只读。
- `/silent`：脚本或设置导入时抑制交互。
- `/solo`：强制新实例。

脚本：

- 使用 `BCompare.exe @"C:\path\script.txt"` 运行。
- 脚本按行处理，命令大小写不敏感。
- `#` 后为注释。
- 参数可使用 `%1` 到 `%9`。
- 可用 `%date%`、`%time%`、`%fn_time%` 等动态变量。
- 支持无 UI 的批处理任务、文件操作、报告生成和定时任务。

## 官方来源

- Beyond Compare v5 Help：<https://www.scootersoftware.com/v5help/index.html>
- What's New in Version 5：<https://www.scootersoftware.com/home/v5whatsnew>
- Standard vs. Pro：<https://www.scootersoftware.com/kb/editions>
- Feature List by Version：<https://www.scootersoftware.com/kb/feature_compare>
- Common Commands：<https://www.scootersoftware.com/v5help/commandsbc.html>
- Command Line Reference：<https://www.scootersoftware.com/v5help/command_line_reference.html>
- Scripts：<https://www.scootersoftware.com/v5help/scripts.html>
- Explorer Integration：<https://www.scootersoftware.com/v5help/bcshellex.html>
