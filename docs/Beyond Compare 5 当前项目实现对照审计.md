# Beyond Compare 5 当前项目实现对照审计

## 审计依据

- 目标文档：`docs/Beyond Compare 5 功能与 UI 记录.md`
- 目标截图：`docs/assets/beyond-compare-5-capture/*.png`
- 当前项目代码：`src/`、`src-tauri/`
- 判定口径：
  - “正确实现”表示当前代码已有真实数据处理或与目标功能方向一致的可用能力。
  - “错误实现”表示入口、文案或状态看似存在，但行为不真实，或 UI/交互明显偏离目标软件截图。
  - “未实现”表示目标文档记录的 Beyond Compare 5 功能在当前代码中没有对应实现，或只有后端能力但没有暴露到 UI/命令。

## 总体结论

当前项目不是 Beyond Compare 5 UI 的高保真复刻，而是一个自有 Workbench 风格的差异比较应用。路由和会话目录几乎把所有会话类型都标为已实现，但真实完成度分层明显：

- Text Compare、Folder Compare、Table Compare、Hex Compare、Picture Compare、Registry Compare、Media Compare、Version Compare 有真实后端比较调用。
- Folder Sync 只有预览，没有执行同步。
- Folder Merge 只有生成合并计划，没有执行输出合并。
- Text Merge 不是实际三方合并，只是硬编码冲突示例加保存输出。
- Home、菜单栏、工具栏、会话树和大量操作按钮与 Beyond Compare 5 截图不一致。
- 多处 UI 使用硬编码演示数据、状态提示或假操作，容易被误认为已完成。

## 正确实现的部分

### 应用入口与会话路由

- 会话路由覆盖较全：`/compare/text`、`/compare/folder`、`/sync/folder`、`/merge/text`、`/compare/table`、`/compare/hex`、`/compare/picture`、`/merge/folder`、`/edit/text`、`/patch/text`、`/compare/registry`、`/compare/media`、`/compare/version` 等已注册在 `src/app/router.ts`。
- 会话目录包含目标软件主要类型，并提供标题、摘要、优先级和 route：`src/app/sessionCatalog.ts`。

### Text Compare

- 有真实文本 diff 后端：`src/api/diff.ts` 调用 Tauri `diff_text`。
- 后端支持 Myers、Patience、Histogram 算法，以及忽略空白、大小写、行尾和正则忽略：`src-tauri/src/commands.rs`、`src-tauri/crates/diff-core/src/lib.rs`。
- 前端能读取左右文件、运行比较、查找、复制当前差异方向、忽略当前差异、书签和 HTML 预览：`src/views/TextCompareView.vue`。

### Folder Compare

- 有真实本地文件夹扫描和对齐：`src-tauri/src/commands.rs` 的 `compare_folder_paths` 调用 `folder_core::scan_local_folder` 和 `align_folder_trees`。
- 前端能调用 `compareFolderPaths` 并把响应映射成树表：`src/views/FolderCompareView.vue`。
- 后端库已有文件复制、移动、删除、重命名、属性修改、touch、报告模型等基础函数：`src-tauri/crates/folder-core/src/lib.rs`。

### Table Compare

- 有真实 CSV 比较：`compare_table_csv` 会解析左右 CSV，映射列，按第 1 列对齐行并返回 changed cells。
- 前端支持加载左右文本文件、运行 CSV 比较、显示列映射、差异单元格、搜索和差异导航：`src/views/TableCompareView.vue`。

### Hex Compare

- 有真实二进制文件读取和差异扫描：`compare_hex_files` 读取左右文件并返回窗口单元格和差异区间。
- 前端能按路径运行比较、同步滚动、按差异过滤显示：`src/views/HexCompareView.vue`。

### Picture Compare

- 有真实图片读取、元数据比较和同尺寸像素差异扫描：`compare_picture_files`。
- 前端有缩放、旋转、翻转、偏移、overlay、像素预览和统计展示：`src/views/PictureCompareView.vue`。

### Registry Compare

- 支持比较两个 `.reg` 文本导出：`compare_registry_exports` 使用 registry parser 后构建键和值差异。
- 前端支持从 launch 文件读取 `.reg` 文本并运行比较：`src/views/RegistryCompareView.vue`。

### Media Compare

- 有真实媒体元数据读取和字段比较：`compare_media_files`。
- 前端能输入左右媒体路径并展示容器、时长、codec、采样率、声道、码率和字段差异：`src/views/MediaCompareView.vue`。

### Version Compare

- Windows 下支持读取可执行文件版本资源：`compare_version_files` 使用 `WindowsVersionInfoReader`。
- 前端能输入左右路径并显示 fixed info、string info 字段差异：`src/views/VersionCompareView.vue`。

### Text Edit 与 Text Patch

- Text Edit 能真实读取和保存文本文件，并提供查找、替换、未保存状态、行数/字符数：`src/views/TextEditView.vue`。
- Text Patch 能解析 unified diff，展示文件、hunk 和增删上下文行：`src/views/TextPatchView.vue`。

### 设置类页面

- File Formats 页面能在前端创建、编辑、导入、导出格式定义：`src/views/FileFormatView.vue`。
- Remote Profiles 页面能管理远程配置草稿：`src/views/RemoteProfileView.vue`。
- Settings 页面有主题、语言、快捷键、共享会话导入等能力：`src/views/SettingsView.vue`。

## 错误实现与偏差

### 全局 UI 与菜单栏偏差

- 目标 Home 菜单是 `Session / View / Tools / Help`；各会话窗口菜单一般是 `Session / File / Edit / Search / View / Tools / Help` 或包含 `Actions`。当前 `AppLayout` 菜单是项目自定义的 `file / edit / search / view / session / actions / tools`，且没有真正的 Help 菜单。
- 目标软件每个会话都有专属工具栏按钮，例如 Text Compare 的 `Home, All, Diffs, Same, Context, Minor, Rules, Copy, Next Section, Prev Section, Swap, Reload`。当前项目使用统一 `WorkbenchShell` 和自定义按钮，工具栏结构、顺序、命名和截图不一致。
- Help 图标只是顶栏图标入口，不等于目标软件 Help 菜单中的帮助目录、上下文帮助、官网、检查更新、支持、License、About 等。

### Home View 偏差

- 目标 Home 中央有 12 个会话入口，左侧有 `New / Folder Compare / Folder Merge / Folder Sync / Text Compare / Text Merge / Hex Compare / Media Compare / Picture Compare / Registry Compare / Table Compare / Version Compare / Auto-saved / Today` 等树节点。当前 quick start 只有 `text-compare`、`folder-compare`、`text-merge`、`folder-sync` 4 个。
- 当前 Home 的历史记录是硬编码示例，工作区总会话数 `142` 也是硬编码。
- 当前 Home 是项目自有的工作区/保存会话界面，不符合目标截图中的 Beyond Compare Home 会话树和大按钮布局。

### 会话目录状态不准确

- `src/app/sessionCatalog.ts` 把所有会话类型都标记为 `implemented: true`，但 Folder Sync、Folder Merge、Text Merge、Reports/Scripts、Remote Profiles 等明显只是部分实现或静态壳。
- 这会导致 UI 对用户宣称功能已完成，但实际很多操作没有真实效果。

### Folder Compare 偏差

- 初始列表包含 180 条硬编码 `generatedRows` 演示数据，未运行真实比较前会显示假文件树。
- Copy、Delete、Rename、属性修改、Touch、Quick Compare、Compare To、Open、Open With、报告、同步预览等很多按钮只更新本地状态文本或打开面板，没有调用真实文件操作。
- 后端 `folder-core` 虽有复制、移动、删除、重命名等函数，但没有通过 Tauri command 和前端 API 暴露给 Folder Compare UI。
- 目标截图中的路径栏、列布局、工具栏按钮、文件/文件夹操作菜单和 Beyond Compare 操作语义没有完整复刻。

### Folder Sync 偏差

- 前端 `previewSync` 调用真实 `preview_folder_sync`，但 `runSync` 只是把 completed 数量设为 preview 行数并生成日志，没有执行复制、删除或覆盖。
- 目标软件有 `Sync Now / Cancel / Accept`，并能将项目设为 Leave Alone、Copy Right to Left、Copy Left to Right、Delete Left、Delete Right；当前只有预览级别，执行层缺失。

### Folder Merge 偏差

- 当前只调用 `build_folder_merge_plan` 生成计划，没有 `Merge` 或 `To Output` 的真实输出执行。
- 点击冲突只路由到 `/merge/text`，没有传递真实冲突文件、base/left/right/output 路径，也不会打开对应三方文本合并。
- 目标工具栏中的 `Merge / To Output / Same OK / Rules / Filters / Peek` 等没有对应真实行为。

### Text Merge 偏差

- 当前冲突、base/left/right/output 内容全部是硬编码示例。
- `acceptConflict` 只是把输出改成固定三行，没有真实 diff3 或三方合并算法。
- 只实现了保存 output 文本，没有读取三路输入、自动识别冲突、跳转冲突、Favor Left/Favor Right、Left/Center/Right 视图同步等目标功能。

### Table Compare 偏差

- 后端命令名和实现都是 `compare_table_csv`，只解析 CSV 文本；目标文档要求 v5 Table Compare 支持多个 Excel sheet 和多个 HTML table。
- 后端固定取第一个 sheet，固定按第 1 列对齐，前端手动列映射/忽略列并未作为请求参数传给后端影响比较。
- UI 以配置面板和虚拟表格为主，不是目标截图中的 Beyond Compare 表格比较工具栏和左右表格体验。

### Hex Compare 偏差

- 默认初始字节是硬编码 A-Z 示例。
- 前端每次只请求 `offset: 0, length: 256`，没有实现完整文件浏览、跳转 offset、差异导航、复制、规则、Reload、Swap 等目标功能。

### Picture Compare 偏差

- 初始元数据和统计是硬编码示例。
- overlay 是前端视觉层，未看到目标软件的 `Tol / Range / Blend / Meta` 规则与容差模型完整实现。
- 没有目标截图中的专属工具栏语义、差异范围控制、容差规则编辑和报告/保存能力。

### Registry Compare 偏差

- 当前只能比较 `.reg` 文本导出，不支持直接连接/浏览 Windows 注册表 hive 并编辑。
- 没有 Copy、Next Diff、Prev Diff、Swap、Reload、Expand、Collapse 的完整命令实现。
- 初始 registry tree 是硬编码示例。

### Media Compare 偏差

- 当前聚焦元数据字段比较，没有媒体播放、双侧播放控制、前滚/后滚、流选择、规则/重要性设置等。
- 目标截图记录 `Play2`、前滚/后滚等工具栏按钮，当前未实现对应行为。
- 初始媒体信息是硬编码示例。

### Version Compare 偏差

- 当前仅 Windows 支持版本资源读取，非 Windows 返回 unsupported。
- 没有目标工具栏的 All/Diffs/Same/Minor/Rules/Next/Prev/Swap/Reload，也没有重要性规则配置。
- 初始版本字段是硬编码示例。

### Text Edit 偏差

- 能打开/保存文本，但 UI 不是目标 Text Edit 截图中的工具栏：`Home, Undo, Redo, Cut, Copy, Paste, Delete, Syntax`。
- 缺少真实撤销/重做、剪切/复制/粘贴按钮、删除、语法菜单、换行/制表符/编码/行尾等 Beyond Compare 编辑器级设置。

### Text Patch 偏差

- 能解析 unified diff，但目标 Text Patch 有 `Next Section / Prev Section`，当前没有真实区段导航。
- 目标文档提到可由 patch 重建比较、查看文件清单和打开 Text Compare；当前主要是解析展示，没有应用 patch 或打开对应比较。

### Clipboard Compare 偏差

- 当前实现的是项目自定义 Clipboard History Compare；目标文档中剪贴板功能更多是菜单命令和文本/图片/文件夹比较入口。
- 缺少对剪贴板条目的 Save As、Delete、Open With Text Edit 等完整操作。

### Settings / File Formats / Remote Profiles 偏差

- File Formats、Remote Profiles 只保存在前端内存中，没有持久化、没有真正参与会话比较规则选择。
- Remote Profile 的 `testProfileConnection` 只是把状态设为 queued，没有真实连接测试，也没有 SFTP/FTP/WebDAV/S3/Dropbox/OneDrive/Subversion 访问能力。
- Settings 不是 Beyond Compare `Tools > Options` 的完整结构，缺少 Appearance、Colors/Fonts、Toolbars、Tweaks、Text Editing、Open With、Shell Integration、Backup 等完整配置页。

### Reports / Scripts 偏差

- `ReportsScriptView` 中 jobs 和 scriptLines 全部是静态示例。
- 没有真实 CLI、脚本执行、报表生成、任务队列、导出文件或运行日志。
- 后端 `folder-core` 有 folder report model/render 的部分能力，但没有形成完整前端工作流。

## 未实现的功能点

### Home 与通用框架

- 未实现 Beyond Compare 5 Home 左侧原生会话树。
- 未实现 Home 中央 12 个目标会话入口的原版布局。
- 未实现 Auto-saved、Today、保存会话分组的真实行为。
- 未实现目标软件的 `Open`、`Edit` 默认设置入口语义。
- 未实现每个会话窗口标题格式，例如 `left <--> right - Text Compare - Beyond Compare`。
- 未实现每个会话类型专属菜单栏和工具栏。
- 未实现 Help 菜单完整入口。
- 未实现 New Tab、New Window、Load Workspace、Save Workspace As、Close Tab、Exit 等 Session 菜单行为。

### 文件与来源支持

- 未实现 FTP、SFTP、FTPS、WebDAV、S3、Dropbox、OneDrive、Subversion 等远程位置的真实读取。
- 未实现压缩包/归档作为文件夹来源。
- 未实现快照 snapshot 的创建、加载、比较。
- 未实现 Windows Explorer shell integration：Compare、Compare To、Select Left/Right、Sync、Open With、Edit。
- 未实现 Open With 外部工具链。

### Text Compare

- 未实现目标工具栏完整命令：All、Diffs、Same、Context、Minor、Rules、Next Section、Prev Section、Swap、Reload 的原版语义。
- 未实现 Session Settings 中 Text Compare 的 Specs、Format、Importance、Alignment、Replacements 完整配置。
- 未实现替换规则把指定替换标记为不重要差异的完整 UI 与持久化。
- 未实现完整报告生成、打印、父文件夹比较、打开 Text Merge 的真实上下文传递。

### Folder Compare

- 未实现真实 Copy / Move / Rename / Delete / Attributes / Touch 等 UI 操作调用。
- 未实现 Quick Compare、Compare To、Open With、文件比较报告的真实工作流。
- 未实现 Filters、Peek、Select、Files 菜单、Stop/cancel 作业等目标命令。
- 未实现高级对齐覆盖持久化和真正影响后续比较。
- 未实现名称过滤、其他过滤、处理规则、比较规则、符号链接/权限/时间戳策略等完整设置。

### Folder Sync

- 未实现真实同步执行。
- 未实现 Accept / Cancel 操作。
- 未实现逐项覆盖操作：Leave Alone、Copy Right to Left、Copy Left to Right、Delete Left、Delete Right。
- 未实现同步后的错误恢复、冲突处理、日志持久化和撤销/预演差异确认。

### Folder Merge

- 未实现真实三方文件夹合并输出。
- 未实现 Merge、To Output、Same OK 等操作。
- 未实现冲突文件打开到真实 Text Merge。
- 未实现文件夹合并规则、过滤、输出目录写入、冲突标记持久化。

### Text Merge

- 未实现读取 2 路/3 路/4 路输入。
- 未实现真实三方 merge 算法和自动冲突检测。
- 未实现 Favor Left、Favor Right、Conflict、Left、Center、Right、Next Conflict、Prev Conflict。
- 未实现手动对齐多行选择。
- 未实现从 Text Compare 或 Folder Merge 传入上下文。

### Table Compare

- 未实现 Excel 多 sheet 比较。
- 未实现 HTML 多 table 比较。
- 未实现 sheet 选择、列/行 key 配置、忽略列/列映射真正传入后端。
- 未实现 Table Compare 的格式、Sheets、Columns、Rows 完整设置。

### Hex Compare

- 未实现完整二进制文件滚动窗口加载和跳转。
- 未实现 Copy、Next Diff、Prev Diff、Swap、Reload、Rules。
- 未实现 Hex Compare 的 Format、Comparison 设置。

### Picture Compare

- 未实现 Tol、Range、Blend、Minor、Rules、Meta 的完整规则与工具栏行为。
- 未实现图片比较替换规则、容差策略持久化、报告/导出。
- 未实现实际图片渲染层与差异 overlay 的完整联动验证。

### Registry Compare

- 未实现直接读取和编辑注册表。
- 未实现注册表项/值复制、合并、删除、Reload、Swap、Expand/Collapse 命令。
- 未实现 Registry Compare Session Settings 的 Specs。

### Media Compare

- 未实现播放、双侧播放同步、前滚/后滚。
- 未实现媒体重要性规则、标签字段规则、流/章节/封面等更完整元数据比较。
- 未实现 Media Compare 报告。

### Version Compare

- 未实现重要性规则配置。
- 未实现更多版本头字段 UI、错误恢复、非 Windows 策略。
- 未实现 Next/Prev/Swap/Reload 等工具栏命令。

### Text Edit / Text Patch / Clipboard

- Text Edit 未实现原版编辑工具栏和编辑器高级能力。
- Text Patch 未实现 section 导航、应用 patch、从 patch 打开 Text Compare。
- Clipboard 未实现 Save As、Delete、Open With Text Edit 和目标菜单入口整合。

### Reports / Automation / CLI

- 未实现 Folder Compare Report、Text Compare Report 的完整生成入口。
- 未实现打印和 HTML 报告工作流。
- 未实现 HTML 文件夹报告链接到单个文件比较报告。
- 未实现命令行参数 `/fv`、`/sync` 等 Beyond Compare 兼容命令行。
- 未实现脚本运行、任务队列、导入/导出配置、Restore Factory Defaults、Save Snapshot。

## 优先级建议

1. 先把 `sessionCatalog.implemented` 改为真实状态，避免未完成入口伪装成已完成。
2. 先补 Folder Sync 执行、Folder Compare 文件操作、Folder Merge 输出执行，这些是最容易误伤用户数据的功能，必须从“假状态”改成明确禁用或真实实现。
3. 再统一 Home、菜单栏、工具栏，让 UI 基线和目标截图一致。
4. 最后补规则系统、远程来源、报表脚本、shell integration、CLI 兼容等大功能。
