# UI 设计稿全量对齐实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将当前 Vue/Tauri 前端 UI 全量调整为 `ui/` 目录设计稿表达的 OpenDiff 高密度专业对比工作台。

**架构：** 先拆掉全局壳层里和页面设计稿冲突的通用路径栏、Tab 条、标题区和通用右侧详情栏，改为“全局应用框架 + 页面专属工作台”的结构。再按页面类型沉淀通用工作台组件：顶部菜单/侧边导航/状态栏、路径工具条、左右分栏、文件表格、专属 inspector、密集数据卡片。每个业务视图以对应 `ui/<name>/screen.png` 为视觉验收标准。

**技术栈：** Vue 3 + TypeScript + Naive UI + Pinia + Vue Router + Playwright + Vitest。

---

## 范围与目标稿

本计划覆盖以下设计稿：

- `ui/home_workspace/screen.png`
- `ui/text_compare/screen.png`
- `ui/three_way_text_merge/screen.png`
- `ui/folder_compare/screen.png`
- `ui/folder_sync/screen.png`
- `ui/three_way_folder_merge/screen.png`
- `ui/table_compare/screen.png`
- `ui/hex_compare/screen.png`
- `ui/picture_compare/screen.png`
- `ui/registry_compare/screen.png`
- `ui/media_version_info/screen.png`
- `ui/remote_archive_snapshot/screen.png`
- `ui/settings_rules_policy/screen.png`
- `ui/reports_script_cli/screen.png`

`*_implementation` 设计稿可作为交互/状态扩展参考，但首要验收以不带 `_implementation` 的目标稿为准。

## 总体设计原则

- 全局只保留菜单栏、左侧导航、底部状态栏和命令弹层。
- 页面内容从顶栏后尽快进入“专业工作区”：表格、左右 pane、图片画布、hex 编辑器、树表。
- 右侧 inspector 必须由页面注入，不能全局硬编码 `Selection / Change / Jobs`。
- 所有业务面板半径 0-4px，避免 8px 大卡片感。
- 主工作区字体遵循 `ui/opendiff_ui/DESIGN.md`：UI 11-13px，代码/数据 11-12px，行高 20-24px。
- 页面首屏不出现大面积表单向导，路径、筛选、运行等控制压缩到 24-32px 高工具条或 inspector。
- 差异颜色语义统一：添加绿色、删除红色、修改黄色、冲突紫色。

## 文件结构

### 新建

- `src/layouts/workbench.ts`：定义页面工作台元信息、inspector slot 数据类型、路径栏模型。
- `src/components/workbench/WorkbenchShell.vue`：页面级工作台容器，承载页面标题条、工具条、主区域、inspector。
- `src/components/workbench/WorkbenchToolbar.vue`：32px 高工具条按钮组，复用图标按钮/文本按钮。
- `src/components/workbench/WorkbenchInspector.vue`：右侧 inspector 外框，支持页面传入 section。
- `src/components/workbench/PathPairBar.vue`：双路径输入/选择/交换/比较工具条。
- `src/components/workbench/StatusSummaryGrid.vue`：密集统计块，服务文本、文件夹、注册表、媒体、版本等页面。
- `src/components/workbench/SplitPaneHeader.vue`：左右/三方 pane 头部，用于文本、图片、hex、表格。
- `src/components/workbench/DenseDataTable.vue`：通用密集表格壳层，用于首页最近会话、文件夹、注册表、媒体、版本、设置策略。
- `src/components/workbench/DiffMinimap.vue`：中间或右侧差异地图组件。
- `src/views/reports/ReportsScriptView.vue`：对齐 `reports_script_cli` 设计稿的报告/脚本页面。
- `tests/e2e/ui-design-alignment.spec.ts`：核心页面布局冒烟和截图生成测试。
- `scripts/capture-ui-screenshots.mjs`：固定 1600x1280 截取当前实现页面，输出 `.codex/screens/current_*.png`。

### 修改

- `src/layouts/AppLayout.vue`：收敛为全局 chrome；移除全局 command-bar/pathbar/tab-strip/page-head/通用 inspector。
- `src/styles/main.css`：补齐设计系统变量、滚动条、密度、表格、pane、inspector 的基础样式。
- `src/app/router.ts`：新增 reports/script 路由；为页面添加设计稿名、路径 mock、是否需要 inspector 等 meta。
- `src/app/sessionCatalog.ts`：导航项对齐设计稿命名与分组。
- `src/i18n/locales/*.ts`：补齐新增文案。
- `src/views/HomeView.vue`：改成 New Session + Recent Sessions + Workspace Inspector。
- `src/views/TextCompareView.vue`：默认展示双栏 diff 工作台。
- `src/components/diff/TextDiffPanel.vue`：改成设计稿式双 pane + 中间差异地图。
- `src/views/TextMergeView.vue`：改成三方/四方合并工作台，右侧冲突 inspector。
- `src/views/FolderCompareView.vue`：改成路径栏 + 树表 + Selection Details inspector。
- `src/views/FolderSyncView.vue`：改成同步预览工作台。
- `src/views/FolderMergeView.vue`：改成三方文件夹合并表格工作台。
- `src/views/TableCompareView.vue`：改成左右表格 pane + Column Mapping inspector。
- `src/views/HexCompareView.vue`：改成左右 hex pane + Data Format inspector。
- `src/views/PictureCompareView.vue`：改成左右图片画布 + Overlay inspector。
- `src/views/RegistryCompareView.vue`：改成 registry 树/值表 + 差异 inspector。
- `src/views/MediaCompareView.vue`：改成媒体/版本信息对比工作台。
- `src/views/VersionCompareView.vue`：和 Media 共享密集字段报告布局。
- `src/views/SettingsView.vue`：改成规则/策略矩阵页面，匹配 `settings_rules_policy`。
- `src/views/RemoteProfileView.vue`：改成远程归档/快照页面，匹配 `remote_archive_snapshot`。
- `src/views/FileFormatView.vue`：作为设置规则子页面，和 Settings 风格一致。
- `src/layouts/AppLayout.test.ts` 与各 `src/views/*.test.ts`：更新布局断言。

## 任务 1：建立视觉验收基线

**文件：**

- 创建：`scripts/capture-ui-screenshots.mjs`
- 创建：`tests/e2e/ui-design-alignment.spec.ts`
- 修改：`package.json`

- [ ] **步骤 1：创建截图脚本**

创建 `scripts/capture-ui-screenshots.mjs`：

```js
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const routes = [
  ['home_workspace', '/'],
  ['text_compare', '/compare/text'],
  ['three_way_text_merge', '/merge/text'],
  ['folder_compare', '/compare/folder'],
  ['folder_sync', '/sync/folder'],
  ['three_way_folder_merge', '/merge/folder'],
  ['table_compare', '/compare/table'],
  ['hex_compare', '/compare/hex'],
  ['picture_compare', '/compare/picture'],
  ['registry_compare', '/compare/registry'],
  ['media_version_info', '/compare/media'],
  ['remote_archive_snapshot', '/settings/remote-profiles'],
  ['settings_rules_policy', '/settings'],
  ['reports_script_cli', '/reports/scripts'],
]

const baseUrl = process.env.UI_BASE_URL ?? 'http://127.0.0.1:1420'

await mkdir('.codex/screens', { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1600, height: 1280 },
  deviceScaleFactor: 1,
})

for (const [name, route] of routes) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'load', timeout: 15_000 })
  await page.waitForTimeout(300)
  await page.screenshot({
    path: `.codex/screens/current_${name}.png`,
    fullPage: false,
  })
}

await browser.close()
```

- [ ] **步骤 2：添加脚本命令**

在 `package.json` 的 `scripts` 中加入：

```json
"ui:screens": "node scripts/capture-ui-screenshots.mjs"
```

- [ ] **步骤 3：添加 e2e 结构测试**

创建 `tests/e2e/ui-design-alignment.spec.ts`：

```ts
import { expect, test } from '@playwright/test'

const routes = [
  ['home', '/'],
  ['text', '/compare/text'],
  ['folder', '/compare/folder'],
  ['table', '/compare/table'],
  ['hex', '/compare/hex'],
  ['picture', '/compare/picture'],
]

for (const [name, route] of routes) {
  test(`${name} uses dense workbench shell`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1280 })
    await page.goto(route)

    await expect(page.locator('.menu-bar')).toHaveCSS('height', '32px')
    await expect(page.locator('.sidebar')).toHaveCSS('width', '240px')
    await expect(page.locator('.status-bar')).toHaveCSS('height', '24px')
    await expect(page.locator('.workbench-shell')).toBeVisible()
    await expect(page.locator('.workbench-inspector').first()).toBeVisible()
  })
}
```

- [ ] **步骤 4：运行测试确认当前失败**

运行：

```powershell
corepack pnpm test:e2e -- tests/e2e/ui-design-alignment.spec.ts
```

预期：失败，因为 `.workbench-shell` 和 `.workbench-inspector` 尚未实现。

- [ ] **步骤 5：Commit**

```powershell
git add package.json scripts/capture-ui-screenshots.mjs tests/e2e/ui-design-alignment.spec.ts
git commit -m "test: 建立UI设计稿对齐基线"
```

## 任务 2：收敛全局 AppLayout

**文件：**

- 创建：`src/layouts/workbench.ts`
- 创建：`src/components/workbench/WorkbenchShell.vue`
- 创建：`src/components/workbench/WorkbenchToolbar.vue`
- 创建：`src/components/workbench/WorkbenchInspector.vue`
- 创建：`src/components/workbench/PathPairBar.vue`
- 修改：`src/layouts/AppLayout.vue`
- 修改：`src/styles/main.css`
- 测试：`src/layouts/AppLayout.test.ts`

- [ ] **步骤 1：编写布局测试**

在 `src/layouts/AppLayout.test.ts` 增加断言：

```ts
it('renders only global chrome outside routed workbench content', () => {
  const wrapper = mount(AppLayout, {
    global: {
      plugins: [createTestingPinia(), router],
      stubs: { RouterView: true },
    },
  })

  expect(wrapper.find('.menu-bar').exists()).toBe(true)
  expect(wrapper.find('.sidebar').exists()).toBe(true)
  expect(wrapper.find('.status-bar').exists()).toBe(true)
  expect(wrapper.find('.command-bar').exists()).toBe(false)
  expect(wrapper.find('.pathbar').exists()).toBe(false)
  expect(wrapper.find('.page-head').exists()).toBe(false)
  expect(wrapper.find('.inspector').exists()).toBe(false)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/layouts/AppLayout.test.ts
```

预期：失败，当前仍有 `.command-bar`、`.pathbar`、`.page-head`、`.inspector`。

- [ ] **步骤 3：新增工作台类型**

创建 `src/layouts/workbench.ts`：

```ts
export interface WorkbenchPathPair {
  left: string
  right: string
}

export interface WorkbenchInspectorSection {
  title: string
  rows?: Array<{
    label: string
    value: string
    tone?: 'default' | 'added' | 'deleted' | 'modified'
  }>
}

export interface WorkbenchSummaryItem {
  label: string
  value: string
  tone?: 'default' | 'added' | 'deleted' | 'modified' | 'conflict'
}
```

- [ ] **步骤 4：新增 WorkbenchShell**

创建 `src/components/workbench/WorkbenchShell.vue`：

```vue
<template>
  <section
    class="workbench-shell"
    :class="{ 'workbench-shell-no-inspector': !inspector }"
  >
    <main class="workbench-main">
      <slot name="toolbar" />
      <slot />
    </main>
    <aside
      v-if="inspector"
      class="workbench-inspector"
    >
      <slot name="inspector" />
    </aside>
  </section>
</template>

<script setup lang="ts">
defineProps<{ inspector?: boolean }>()
</script>
```

- [ ] **步骤 5：新增工具条/Inspector/路径组件**

创建 `WorkbenchToolbar.vue`、`WorkbenchInspector.vue`、`PathPairBar.vue`，使用 32px/28px 高度、4px 圆角、1px 边框。组件必须只负责布局，不内置业务数据。

- [ ] **步骤 6：改造 AppLayout**

删除 `AppLayout.vue` 中：

- `.command-bar`
- `.pathbar`
- `.tab-strip`
- `.page-head`
- 全局 `.inspector`
- `pathPair`、`workspaceTitle`、`routeSummary`、`routeChangeCount` 等仅服务全局详情栏的计算逻辑

保留：

- `.menu-bar`
- `.desktop`
- `.sidebar`
- `.workspace`
- `.content`
- `.status-bar`
- command palette

`.desktop` 网格改为：

```css
.desktop {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 0;
}

.workspace {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--app-canvas);
}

.content {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **步骤 7：运行测试**

```powershell
corepack pnpm test:unit -- src/layouts/AppLayout.test.ts
corepack pnpm test:e2e -- tests/e2e/ui-design-alignment.spec.ts
```

预期：`AppLayout` 单测通过；e2e 因各页面未接入 `WorkbenchShell` 仍可能失败。

- [ ] **步骤 8：Commit**

```powershell
git add src/layouts src/components/workbench src/styles/main.css src/layouts/AppLayout.test.ts
git commit -m "refactor: 收敛全局应用框架"
```

## 任务 3：统一设计系统密度

**文件：**

- 修改：`src/styles/main.css`
- 修改：`src/app/App.vue`
- 测试：`src/app/App.vue` 相关快照或现有样式测试

- [ ] **步骤 1：补齐 CSS 变量**

在 `src/styles/main.css` 增加：

```css
:root {
  --app-outline: #727785;
  --app-outline-variant: #c2c6d6;
  --app-pane-header: #edeef0;
  --app-row-hover: #e7e8ea;
  --app-active-row: #d8e2ff;
  --app-danger: #ba1a1a;
  --app-success: #166534;
  --workbench-toolbar-height: 32px;
  --workbench-tab-height: 28px;
  --workbench-status-height: 24px;
  --workbench-sidebar-width: 240px;
  --workbench-inspector-width: 300px;
  --dense-row-height: 24px;
}
```

- [ ] **步骤 2：统一滚动条**

将滚动条宽高改为 8px，thumb 使用 `#c2c6d6`，半径 4px。

- [ ] **步骤 3：统一 Naive UI 半径**

在 `src/app/App.vue` 的 theme overrides 中保持 Button/Input/Card 半径 4px；禁止新增业务卡片使用 8px。

- [ ] **步骤 4：运行样式检查**

```powershell
corepack pnpm stylelint "src/**/*.{css,vue}" --max-warnings=0
```

- [ ] **步骤 5：Commit**

```powershell
git add src/styles/main.css src/app/App.vue
git commit -m "style: 统一工作台密度与设计变量"
```

## 任务 4：首页对齐 `home_workspace`

**文件：**

- 修改：`src/views/HomeView.vue`
- 修改：`src/views/HomeView.test.ts`

- [ ] **步骤 1：编写首页结构测试**

在 `HomeView.test.ts` 增加：

```ts
it('renders new session cards, recent sessions table and workspace inspector', () => {
  const wrapper = mount(HomeView, { global: testGlobal })

  expect(wrapper.find('[data-testid="home-new-session"]').exists()).toBe(true)
  expect(wrapper.findAll('[data-testid="home-new-session-card"]')).toHaveLength(4)
  expect(wrapper.find('[data-testid="home-recent-sessions"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="home-workspace-inspector"]').exists()).toBe(true)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/views/HomeView.test.ts
```

- [ ] **步骤 3：改造 HomeView**

首屏结构：

```vue
<WorkbenchShell inspector>
  <section class="home-workspace">
    <section data-testid="home-new-session" class="new-session-panel">
      <h2>New Session</h2>
      <div class="new-session-grid">
        <button data-testid="home-new-session-card">Text Compare</button>
        <button data-testid="home-new-session-card">Folder Compare</button>
        <button data-testid="home-new-session-card">3-Way Merge</button>
        <button data-testid="home-new-session-card">Folder Sync</button>
      </div>
    </section>
    <section data-testid="home-recent-sessions" class="recent-session-panel">
      <header>
        <h2>Recent Sessions</h2>
        <input type="search" placeholder="Filter sessions..." />
      </header>
      <DenseDataTable />
    </section>
  </section>
  <template #inspector>
    <WorkbenchInspector data-testid="home-workspace-inspector" title="Inspector">
      <section>Workspace Properties</section>
      <section>Session History</section>
    </WorkbenchInspector>
  </template>
</WorkbenchShell>
```

保留已有拖拽/剪贴板逻辑，但移到最近会话下方的次级区域或后续任务中接入菜单，不放首屏。

- [ ] **步骤 4：运行测试与截图**

```powershell
corepack pnpm test:unit -- src/views/HomeView.test.ts
corepack pnpm dev --host 127.0.0.1
corepack pnpm ui:screens
```

人工对比：

- `.codex/screens/current_home_workspace.png`
- `ui/home_workspace/screen.png`

- [ ] **步骤 5：Commit**

```powershell
git add src/views/HomeView.vue src/views/HomeView.test.ts
git commit -m "feat: 首页对齐工作区设计稿"
```

## 任务 5：文本比较工作台

**文件：**

- 修改：`src/views/TextCompareView.vue`
- 修改：`src/components/diff/TextDiffPanel.vue`
- 修改：`src/views/TextCompareView.test.ts`
- 修改：`src/components/diff/TextDiffPanel.test.ts`

- [ ] **步骤 1：测试默认渲染双栏 diff**

```ts
it('renders dual text panes without requiring a sample run', async () => {
  const wrapper = mount(TextCompareView, { global: testGlobal })

  expect(wrapper.find('[data-testid="text-workbench"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="text-diff-left-pane"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="text-diff-right-pane"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="text-diff-center-map"]').exists()).toBe(true)
  expect(wrapper.text()).not.toContain('Run the sample comparison')
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/views/TextCompareView.test.ts src/components/diff/TextDiffPanel.test.ts
```

- [ ] **步骤 3：TextCompareView 默认构造 diff**

在 `watchEffect` 或 `onMounted` 中使用默认文本立即生成 `result`，让页面打开即显示 diff。

- [ ] **步骤 4：TextDiffPanel 改双 pane**

布局目标：

- 顶部 32px context toolbar：上一处、下一处、复制到右、复制到左。
- 主区域 `grid-template-columns: minmax(0,1fr) 16px minmax(0,1fr)`。
- 每个 pane 有 28px 文件标签。
- 行号 gutter 40px，代码行高 20px。
- 中间 `DiffMinimap` 垂直显示修改/新增/删除 marker。

- [ ] **步骤 5：右侧 inspector**

TextCompareView 注入：

- Changes Summary：8 additions、4 deletions、2 modifications。
- Selection Details：Line、Type、Encoding。

- [ ] **步骤 6：运行测试和截图**

```powershell
corepack pnpm test:unit -- src/views/TextCompareView.test.ts src/components/diff/TextDiffPanel.test.ts
corepack pnpm ui:screens
```

人工对比：

- `.codex/screens/current_text_compare.png`
- `ui/text_compare/screen.png`

- [ ] **步骤 7：Commit**

```powershell
git add src/views/TextCompareView.vue src/components/diff/TextDiffPanel.vue src/views/TextCompareView.test.ts src/components/diff/TextDiffPanel.test.ts
git commit -m "feat: 文本比较页对齐双栏Diff设计"
```

## 任务 6：三方文本合并工作台

**文件：**

- 修改：`src/views/TextMergeView.vue`
- 修改：`src/views/TextMergeView.test.ts`

- [ ] **步骤 1：测试四 pane 合并布局**

```ts
it('renders merge panes and conflict inspector', () => {
  const wrapper = mount(TextMergeView, { global: testGlobal })

  expect(wrapper.find('[data-testid="merge-pane-left"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="merge-pane-base"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="merge-pane-right"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="merge-pane-output"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="merge-conflict-inspector"]').exists()).toBe(true)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/views/TextMergeView.test.ts
```

- [ ] **步骤 3：改造布局**

对齐 `ui/three_way_text_merge/screen.png`：

- 顶部为 merge toolbar。
- 主区为 left/base/right/output pane。
- 冲突列表移入右侧 inspector。
- 输出区保留可编辑 textarea，但视觉上与代码 pane 一致。

- [ ] **步骤 4：运行测试和截图**

```powershell
corepack pnpm test:unit -- src/views/TextMergeView.test.ts
corepack pnpm ui:screens
```

- [ ] **步骤 5：Commit**

```powershell
git add src/views/TextMergeView.vue src/views/TextMergeView.test.ts
git commit -m "feat: 三方文本合并页对齐设计稿"
```

## 任务 7：文件夹比较工作台

**文件：**

- 修改：`src/views/FolderCompareView.vue`
- 修改：`src/views/FolderCompareView.test.ts`

- [ ] **步骤 1：测试树表和专属 inspector**

```ts
it('renders folder tree table and selection details inspector', () => {
  const wrapper = mount(FolderCompareView, { global: testGlobal })

  expect(wrapper.find('[data-testid="folder-path-pair"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="folder-tree-table"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="folder-selection-inspector"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="folder-checksums"]').exists()).toBe(true)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/views/FolderCompareView.test.ts
```

- [ ] **步骤 3：改造布局**

对齐 `ui/folder_compare/screen.png`：

- 顶部双路径栏 `/src/v1` 与 `/src/v2` 风格，含更多、交换、刷新、过滤按钮。
- 文件树列为 `Name / Ext / Size(L) / Size(R) / Date Modified(L) / Date Modified(R)`。
- 行高 24px，目录行、修改行、选中行、孤儿行使用设计稿色块。
- 右侧 inspector 显示 `legacy_api.ts`、属性表、Checksums、Copy to Left、Delete from Right。

- [ ] **步骤 4：运行测试和截图**

```powershell
corepack pnpm test:unit -- src/views/FolderCompareView.test.ts
corepack pnpm ui:screens
```

- [ ] **步骤 5：Commit**

```powershell
git add src/views/FolderCompareView.vue src/views/FolderCompareView.test.ts
git commit -m "feat: 文件夹比较页对齐树表工作台"
```

## 任务 8：文件夹同步与三方文件夹合并

**文件：**

- 修改：`src/views/FolderSyncView.vue`
- 修改：`src/views/FolderMergeView.vue`
- 修改：对应测试文件

- [ ] **步骤 1：编写布局测试**

`FolderSyncView.test.ts`：

```ts
it('renders sync preview table as primary workspace', () => {
  const wrapper = mount(FolderSyncView, { global: testGlobal })

  expect(wrapper.find('[data-testid="folder-sync-path-pair"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="folder-sync-preview-panel"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="folder-sync-inspector"]').exists()).toBe(true)
})
```

`FolderMergeView.test.ts`：

```ts
it('renders three way folder merge plan with conflict inspector', () => {
  const wrapper = mount(FolderMergeView, { global: testGlobal })

  expect(wrapper.find('[data-testid="folder-merge-paths"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="folder-merge-plan"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="folder-merge-inspector"]').exists()).toBe(true)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/views/FolderSyncView.test.ts src/views/FolderMergeView.test.ts
```

- [ ] **步骤 3：对齐设计稿**

同步页对齐 `ui/folder_sync/screen.png`：策略、预览和运行状态以表格为主体，操作摘要在 inspector。

合并页对齐 `ui/three_way_folder_merge/screen.png`：路径行压缩为顶部工具区，merge plan 表格为主体，冲突详情在 inspector。

- [ ] **步骤 4：运行测试与截图**

```powershell
corepack pnpm test:unit -- src/views/FolderSyncView.test.ts src/views/FolderMergeView.test.ts
corepack pnpm ui:screens
```

- [ ] **步骤 5：Commit**

```powershell
git add src/views/FolderSyncView.vue src/views/FolderMergeView.vue src/views/FolderSyncView.test.ts src/views/FolderMergeView.test.ts
git commit -m "feat: 文件夹同步与合并页对齐设计稿"
```

## 任务 9：表格比较工作台

**文件：**

- 修改：`src/views/TableCompareView.vue`
- 修改：`src/views/TableCompareView.test.ts`

- [ ] **步骤 1：测试左右 CSV pane 与映射 inspector**

```ts
it('renders dual table panes and column mapping inspector', () => {
  const wrapper = mount(TableCompareView, { global: testGlobal })

  expect(wrapper.find('[data-testid="table-left-pane"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="table-right-pane"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="table-column-mapping-inspector"]').exists()).toBe(true)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/views/TableCompareView.test.ts
```

- [ ] **步骤 3：改造 TableCompareView**

对齐 `ui/table_compare/screen.png`：

- 左右 CSV tab/pane 为主体。
- 行号、列标题、主键标记直接显示在表格头。
- Rows/Mismatches 放顶部右侧。
- Column Mapping 放右侧 inspector。
- 当前的手动映射控件保留，但移动到 inspector。

- [ ] **步骤 4：运行测试与截图**

```powershell
corepack pnpm test:unit -- src/views/TableCompareView.test.ts
corepack pnpm ui:screens
```

- [ ] **步骤 5：Commit**

```powershell
git add src/views/TableCompareView.vue src/views/TableCompareView.test.ts
git commit -m "feat: 表格比较页对齐双表设计"
```

## 任务 10：Hex 比较工作台

**文件：**

- 修改：`src/views/HexCompareView.vue`
- 修改：`src/views/HexCompareView.test.ts`

- [ ] **步骤 1：测试 hex pane 与数据格式 inspector**

```ts
it('renders hex panes and data format inspector', () => {
  const wrapper = mount(HexCompareView, { global: testGlobal })

  expect(wrapper.find('[data-testid="left-hex-viewport"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="right-hex-viewport"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="hex-data-format-inspector"]').exists()).toBe(true)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/views/HexCompareView.test.ts
```

- [ ] **步骤 3：改造 HexCompareView**

对齐 `ui/hex_compare/screen.png`：

- 主区域左右 hex pane 占满高度。
- 顶部显示文件名、大小、mismatched bytes、Prev/Next。
- Data Format inspector 包含 Endianness、Bytes per Row、Byte Grouping、Selection Interpretation。
- 路径输入和 Run Diff 不放首屏主体。

- [ ] **步骤 4：运行测试与截图**

```powershell
corepack pnpm test:unit -- src/views/HexCompareView.test.ts
corepack pnpm ui:screens
```

- [ ] **步骤 5：Commit**

```powershell
git add src/views/HexCompareView.vue src/views/HexCompareView.test.ts
git commit -m "feat: Hex比较页对齐编辑器设计"
```

## 任务 11：图片比较工作台

**文件：**

- 修改：`src/views/PictureCompareView.vue`
- 修改：`src/views/PictureCompareView.test.ts`

- [ ] **步骤 1：测试图片双画布和 overlay inspector**

```ts
it('renders image canvases and overlay inspector', () => {
  const wrapper = mount(PictureCompareView, { global: testGlobal })

  expect(wrapper.find('[data-testid="left-picture-pane"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="right-picture-pane"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="picture-overlay-inspector"]').exists()).toBe(true)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/views/PictureCompareView.test.ts
```

- [ ] **步骤 3：改造 PictureCompareView**

对齐 `ui/picture_compare/screen.png`：

- 顶部标题为 `Picture Compare: v1_prototype.png vs v2_final.png`。
- 主区左右画布，棋盘背景铺满。
- 右侧 inspector 放 Zoom Level、Tolerance、Overlay Mode、Image Metadata。
- 当前路径、统计、旋转、offset 控件压缩为顶部工具条或 inspector，不占主画布上方多行。
- 用更接近设计稿的真实图像占位，替换当前抽象渐变块。

- [ ] **步骤 4：运行测试与截图**

```powershell
corepack pnpm test:unit -- src/views/PictureCompareView.test.ts
corepack pnpm ui:screens
```

- [ ] **步骤 5：Commit**

```powershell
git add src/views/PictureCompareView.vue src/views/PictureCompareView.test.ts
git commit -m "feat: 图片比较页对齐视觉画布设计"
```

## 任务 12：注册表、媒体、版本信息工作台

**文件：**

- 修改：`src/views/RegistryCompareView.vue`
- 修改：`src/views/MediaCompareView.vue`
- 修改：`src/views/VersionCompareView.vue`
- 修改：对应测试文件

- [ ] **步骤 1：编写布局测试**

注册表：

```ts
it('renders registry tree, value table and inspector', () => {
  const wrapper = mount(RegistryCompareView, { global: testGlobal })

  expect(wrapper.find('[data-testid="registry-key-pane"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="registry-value-pane"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="registry-inspector"]').exists()).toBe(true)
})
```

媒体/版本：

```ts
it('renders media metadata report as primary table', () => {
  const wrapper = mount(MediaCompareView, { global: testGlobal })

  expect(wrapper.find('[data-testid="media-report-table"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="media-version-inspector"]').exists()).toBe(true)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/views/RegistryCompareView.test.ts src/views/MediaCompareView.test.ts src/views/VersionCompareView.test.ts
```

- [ ] **步骤 3：对齐页面**

注册表对齐 `ui/registry_compare/screen.png`：左树右值表，右侧 inspector 显示所选 key/value 差异。

媒体与版本对齐 `ui/media_version_info/screen.png`：文件摘要放顶部，字段报告表格为主体，差异摘要放 inspector。

- [ ] **步骤 4：运行测试与截图**

```powershell
corepack pnpm test:unit -- src/views/RegistryCompareView.test.ts src/views/MediaCompareView.test.ts src/views/VersionCompareView.test.ts
corepack pnpm ui:screens
```

- [ ] **步骤 5：Commit**

```powershell
git add src/views/RegistryCompareView.vue src/views/MediaCompareView.vue src/views/VersionCompareView.vue src/views/RegistryCompareView.test.ts src/views/MediaCompareView.test.ts src/views/VersionCompareView.test.ts
git commit -m "feat: 注册表媒体版本页对齐设计稿"
```

## 任务 13：设置、远程归档、报告脚本页面

**文件：**

- 修改：`src/views/SettingsView.vue`
- 修改：`src/views/RemoteProfileView.vue`
- 修改：`src/views/FileFormatView.vue`
- 创建：`src/views/reports/ReportsScriptView.vue`
- 修改：`src/app/router.ts`
- 修改：`src/app/sessionCatalog.ts`
- 修改：对应测试文件

- [ ] **步骤 1：新增路由测试**

在 `src/app/router.test.ts` 增加：

```ts
it('registers reports script route', () => {
  expect(router.getRoutes().some((route) => route.path === '/reports/scripts')).toBe(true)
})
```

- [ ] **步骤 2：运行测试确认失败**

```powershell
corepack pnpm test:unit -- src/app/router.test.ts
```

- [ ] **步骤 3：设置页面对齐**

`SettingsView.vue` 对齐 `ui/settings_rules_policy/screen.png`：

- 主体改成规则/策略矩阵。
- Appearance、Shortcuts 等现有设置压缩进分组列表或 secondary panel。
- FileFormatView 与 Settings 保持同一密集表单风格。

- [ ] **步骤 4：远程归档页面对齐**

`RemoteProfileView.vue` 对齐 `ui/remote_archive_snapshot/screen.png`：

- 左侧 profiles/snapshots 列表。
- 右侧归档快照详情表。
- 凭据/连接配置进入 inspector 或底部详情。

- [ ] **步骤 5：新增报告脚本页面**

创建 `ReportsScriptView.vue`，对齐 `ui/reports_script_cli/screen.png`：

- 左侧报告列表/脚本列表。
- 主体命令预览、输出表格。
- 右侧 inspector 显示参数、最近运行、导出选项。

在 `router.ts` 加：

```ts
{
  path: '/reports/scripts',
  name: 'reports-scripts',
  component: ReportsScriptView,
}
```

- [ ] **步骤 6：运行测试与截图**

```powershell
corepack pnpm test:unit -- src/app/router.test.ts src/views/SettingsView.test.ts src/views/RemoteProfileView.test.ts
corepack pnpm ui:screens
```

- [ ] **步骤 7：Commit**

```powershell
git add src/views/SettingsView.vue src/views/RemoteProfileView.vue src/views/FileFormatView.vue src/views/reports/ReportsScriptView.vue src/app/router.ts src/app/sessionCatalog.ts src/app/router.test.ts src/views/SettingsView.test.ts src/views/RemoteProfileView.test.ts
git commit -m "feat: 设置远程归档和报告脚本页对齐设计稿"
```

## 任务 14：导航与国际化收口

**文件：**

- 修改：`src/layouts/AppLayout.vue`
- 修改：`src/app/sessionCatalog.ts`
- 修改：`src/i18n/locales/en-US.ts`
- 修改：`src/i18n/locales/zh-CN.ts`
- 修改：`src/i18n/locales/zh-TW.ts`
- 修改：其他语言 skeleton 测试需要的 locale 文件
- 测试：`src/i18n/*.test.ts`、`src/layouts/AppLayout.test.ts`

- [ ] **步骤 1：测试导航分组**

```ts
it('uses design navigation groups and labels', () => {
  const wrapper = mount(AppLayout, { global: testGlobal })

  expect(wrapper.text()).toContain('Text Compare')
  expect(wrapper.text()).toContain('Folder Compare')
  expect(wrapper.text()).toContain('Metadata')
  expect(wrapper.text()).toContain('Remotes')
  expect(wrapper.text()).toContain('Scripts')
})
```

- [ ] **步骤 2：运行测试确认失败或待更新**

```powershell
corepack pnpm test:unit -- src/layouts/AppLayout.test.ts src/i18n/core.test.ts src/i18n/languageSkeletons.test.ts
```

- [ ] **步骤 3：更新导航**

左侧导航对齐设计稿：

- Home
- Text Compare
- Three-Way Merge
- Folder Compare
- Folder Sync
- Folder Merge
- Table Compare
- Hex Compare
- Picture Compare
- Registry Compare
- 分隔线
- Metadata
- Remotes
- Scripts
- Settings

可保留 Clipboard Compare、Text Edit、File Formats，但放入次级区域或通过更多菜单进入，不抢占设计稿第一屏导航。

- [ ] **步骤 4：补齐翻译**

所有新增 data/label 文案写入 `en-US`，中文 locale 使用自然中文。其他语言按 skeleton 规则补齐 fallback。

- [ ] **步骤 5：运行测试**

```powershell
corepack pnpm test:unit -- src/i18n/core.test.ts src/i18n/languageSkeletons.test.ts src/layouts/AppLayout.test.ts
```

- [ ] **步骤 6：Commit**

```powershell
git add src/layouts/AppLayout.vue src/app/sessionCatalog.ts src/i18n
git commit -m "feat: 导航与多语言对齐设计稿"
```

## 任务 15：全量验证与视觉审查

**文件：**

- 修改：必要的样式/测试收尾文件

- [ ] **步骤 1：运行单元测试**

```powershell
corepack pnpm test:unit
```

预期：全部通过。

- [ ] **步骤 2：运行 e2e**

```powershell
corepack pnpm test:e2e
```

预期：全部通过。

- [ ] **步骤 3：运行 lint/style/typecheck**

```powershell
corepack pnpm lint
corepack pnpm stylelint "src/**/*.{css,vue}" --max-warnings=0
corepack pnpm typecheck
```

预期：全部通过。

- [ ] **步骤 4：生成 1600x1280 截图**

```powershell
corepack pnpm dev --host 127.0.0.1
corepack pnpm ui:screens
```

逐张人工对比：

- `.codex/screens/current_home_workspace.png` vs `ui/home_workspace/screen.png`
- `.codex/screens/current_text_compare.png` vs `ui/text_compare/screen.png`
- `.codex/screens/current_three_way_text_merge.png` vs `ui/three_way_text_merge/screen.png`
- `.codex/screens/current_folder_compare.png` vs `ui/folder_compare/screen.png`
- `.codex/screens/current_folder_sync.png` vs `ui/folder_sync/screen.png`
- `.codex/screens/current_three_way_folder_merge.png` vs `ui/three_way_folder_merge/screen.png`
- `.codex/screens/current_table_compare.png` vs `ui/table_compare/screen.png`
- `.codex/screens/current_hex_compare.png` vs `ui/hex_compare/screen.png`
- `.codex/screens/current_picture_compare.png` vs `ui/picture_compare/screen.png`
- `.codex/screens/current_registry_compare.png` vs `ui/registry_compare/screen.png`
- `.codex/screens/current_media_version_info.png` vs `ui/media_version_info/screen.png`
- `.codex/screens/current_remote_archive_snapshot.png` vs `ui/remote_archive_snapshot/screen.png`
- `.codex/screens/current_settings_rules_policy.png` vs `ui/settings_rules_policy/screen.png`
- `.codex/screens/current_reports_script_cli.png` vs `ui/reports_script_cli/screen.png`

- [ ] **步骤 5：最终修正清单**

逐页确认：

- 顶栏高度 32px。
- 左侧栏宽度 240px。
- 状态栏高度 24px。
- 主体第一屏无大面积表单向导。
- 业务 inspector 内容匹配页面语境。
- 表格/树/代码行高 20-24px。
- 大卡片圆角不超过 4px，重复 item 卡片除外。
- 文本无溢出、按钮不挤压、右侧 inspector 不截断关键值。

- [ ] **步骤 6：最终质量命令**

```powershell
corepack pnpm quality
```

预期：全部通过。

- [ ] **步骤 7：Commit**

```powershell
git add .
git commit -m "chore: 完成UI设计稿全量对齐验证"
```

## 交付验收标准

- `corepack pnpm quality` 通过。
- `corepack pnpm test:e2e` 通过。
- `corepack pnpm ui:screens` 能生成所有目标页面截图。
- 每个目标页面与对应 `ui/<name>/screen.png` 在信息架构上一致：全局 chrome、主工作区、右侧 inspector、工具条位置、主数据表/画布/pane 优先级一致。
- 现有功能测试不因 UI 改造丢失核心交互：打开会话、比较、筛选、导航、保存、语言/主题切换仍可用。

## 风险与控制

- 风险：一次性大改 AppLayout 会导致大量视图测试失败。
  控制：先引入 `WorkbenchShell`，逐页迁移，旧视图短期可继续运行。
- 风险：页面专属 inspector 数据重复。
  控制：抽象 `WorkbenchInspector` 只处理外框，业务 section 在页面内定义。
- 风险：视觉对齐压缩后交互入口丢失。
  控制：只移动控件，不删除功能；低频设置进入 inspector 或二级区域。
- 风险：多语言新增 key 大量缺失。
  控制：任务 14 专门做 i18n 收口，并运行 skeleton 测试。

## 自检结果

- 规格覆盖：已覆盖 `ui/` 下所有主要目标稿，包括首页、文本、三方文本、文件夹、同步、三方文件夹、表格、Hex、图片、注册表、媒体/版本、远程归档、设置策略、报告脚本。
- 占位符扫描：计划中无“待定/TODO/类似任务”等不可执行占位；每个任务给出文件、测试、命令和提交点。
- 类型一致性：新增共享类型集中在 `src/layouts/workbench.ts`，组件只依赖简单 props/slot，避免跨任务签名漂移。
