# Beyond 首页与 Session 缺口修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复当前首页、Session 管理、拖放启动、Text Patch 和全局菜单工具条与 `docs/需求文档.md` 中 Beyond Compare 首页/通用工作流需求不一致的问题。

**架构：** 以“可恢复 Session 文档”为中心，把首页入口、拖放、命令菜单、标签页、保存/另存、自动恢复和共享 Session 都接到同一套 `SessionDocument` 数据流。视图页面不再只依赖硬编码样例路径，而是通过统一的启动负载读取左/右/中心/输出路径，并在支持的页面上自动加载或运行比较。Text Patch 作为完整视图接入路由、目录、拖放识别和命令系统。

**技术栈：** Vue 3、Pinia、Vue Router、Naive UI、Tauri invoke API、Vitest、Playwright、TypeScript、Rust Tauri command。

---

## 1. 修复范围

本计划优先覆盖已核对出的 11 个缺口，范围限定在首页与通用工作流闭环：

- HOME-001：首页入口、拖放、Text Patch。
- HOME-002：Saved Sessions 保存、另存、重命名、删除、复制、移动、锁定、脏状态提示。
- HOME-003：Auto-Saved Sessions 自动保存、数量配置、恢复、清理。
- HOME-004：Session 搜索、类型过滤、管理面板、默认 Session 设置入口。
- HOME-005：Shared Sessions 配置路径后加载为只读分支，编辑时另存个人副本。
- HOME-006：命名 Workspace 保存与恢复。
- UI-001：单窗口多标签页基础交互补齐，包括关闭、保存脏标签提示；多窗口仅提供命令与数据模型，不在本批实现原生窗口创建。
- UI-003 / UI-004：全局差异导航、显示过滤和工具条命令接入当前视图动作。
- TEXT-008：Text Patch 视图、`.diff/.patch` 自动打开、导航、搜索、复制和报告入口。

不纳入本计划的能力：

- FTP/SFTP/WebDAV/S3/Dropbox/OneDrive 的真实远程文件读写。
- 操作系统级多窗口创建。
- 完整 Beyond Compare 全菜单树。
- 二进制、图片、表格等页面的深层比较算法增强。

## 2. 当前事实与证据

- `Text Patch` 在 `src/app/sessionCatalog.ts` 中 `implemented: false`，页面上显示 `Planned`。
- `src/app/sessionAutoSelect.ts` 把 `.diff/.patch` 放进 `textExtensions`，因此会选择 `text-compare`。
- `src/views/HomeView.vue` 的拖放只设置 `dropResult` 与 `selectedDropSession`，跳转时没有传入拖放路径。
- `src/app/savedSessions.ts` 只有 `sampleSavedSessions`，`src/stores/savedSessions.ts` 初始化自样例数据，没有持久化加载。
- 首页的重命名逻辑固定追加 `Renamed`，移动固定到 `Archive`。
- `src/layouts/AppLayout.vue` 顶部 `File/Edit/Search/View/Session/Actions/Tools` 是无行为按钮。
- `Copy Right`、`Copy Left`、`Save` 工具条按钮无 click handler。
- `Differences only / Show All / Ignore Rules / Export` 是静态 chip，不是可操作控件。

## 3. 目标验收标准

- 首页 `Text Patch` 卡片可点击，`.diff/.patch` 拖放两个文件或单个补丁文件时进入 Text Patch。
- 拖放两个文件/文件夹后，目标页面显示拖入路径，并自动执行对应比较或加载内容。
- 首页每个已实现 Session 类型入口支持直接打开；拖到某个 Session 卡片时按该卡片类型打开。
- 用户能从当前标签保存 Session、另存为新 Session、重命名、复制、移动、删除、锁定/解锁。
- 锁定 Session 不允许覆盖；编辑锁定或共享 Session 时必须另存个人副本。
- Session 列表从持久化存储加载，刷新页面后保留。
- 自动保存最近 Session，数量可配置，用户可清理恢复列表。
- 设置里的共享 Session 文件路径能在首页树中显示为只读分支。
- 用户能保存命名 Workspace，关闭/刷新后恢复标签、活动标签、Session 列表和布局基础状态。
- 全局菜单和工具条中可见的 Save、Copy Left/Right、Next/Previous Difference、Show All、Differences Only、Export 均触发具体命令或明确禁用。
- 单元测试覆盖新增 store、路由、首页交互、Text Patch、命令系统；至少一个 Playwright 冒烟覆盖拖放或入口启动。

## 4. 文件结构与职责

### 新增文件

- `src/types/sessionLaunch.ts`：定义从首页、命令、拖放、Saved Session 启动视图的统一负载类型。
- `src/stores/sessionLaunch.ts`：保存最近一次启动负载，供目标视图读取并消费。
- `src/app/sessionFactory.ts`：从 Session 类型、路径和当前视图状态创建 `SessionDocument`。
- `src/app/sessionPersistence.ts`：封装本地命名 Session、自动保存 Session、Workspace 的 localStorage 读写。
- `src/app/sessionFile.ts`：解析和序列化 `.open-diff-session.json` 与共享 Session 包。
- `src/stores/workspaces.ts`：保存、删除、恢复命名 Workspace。
- `src/views/TextPatchView.vue`：补丁查看页面。
- `src/views/TextPatchView.test.ts`：补丁查看页面单测。
- `src/components/session/SessionSaveDialog.vue`：保存/另存/移动/重命名通用对话框。
- `src/components/session/SessionSaveDialog.test.ts`：对话框单测。
- `src/components/session/WorkspaceManager.vue`：命名 Workspace 列表与保存/恢复 UI。
- `src/components/session/WorkspaceManager.test.ts`：Workspace UI 单测。
- `tests/e2e/home-session-workflow.spec.ts`：首页启动、Session 保存、Text Patch 入口冒烟。

### 修改文件

- `src/types/session.ts`：补充 `SessionDocument` 的来源、共享文件路径、默认设置引用。
- `src/types/diff.ts`：如果 Text Patch 需要报告摘要，补充 `TextPatchSummary` 类型。
- `src/app/sessionCatalog.ts`：启用 `text-patch` 并补路由。
- `src/app/sessionAutoSelect.ts`：`.diff/.patch` 选择 `text-patch`；支持单个 patch 文件。
- `src/app/dropInput.ts`：支持单个补丁文件、目录拖放来源识别与目标类型覆盖。
- `src/app/router.ts`：新增 `/patch/text` 路由。
- `src/app/commandRegistry.ts`：补 Save、Save As、Export、Copy Left/Right、Show All、Differences Only、Open Text Patch、Workspace Save/Restore 命令。
- `src/app/commandSystem.ts`：执行新增命令，并向当前视图分发 view action。
- `src/layouts/AppLayout.vue`：菜单、工具条、tab 关闭、chip 控件改为命令驱动。
- `src/stores/savedSessions.ts`：从持久化加载、保存、另存、共享只读、自动保存清理。
- `src/stores/tabs.ts`：标签关闭提示、标签脏状态更新、Workspace 快照增强。
- `src/stores/settings.ts`：自动保存数量配置、共享 Session 路径触发加载。
- `src/views/HomeView.vue`：接入拖放启动负载、保存对话框、Workspace 管理、共享分支展示。
- `src/components/session/SavedSessionNode.vue`：增加锁定/解锁、另存为副本、打开 Session。
- `src/views/TextCompareView.vue`：消费启动负载，支持从路径读取文本并保存 Session 状态。
- `src/views/FolderCompareView.vue`：消费启动负载，支持拖放路径自动比较。
- `src/views/TableCompareView.vue`：消费启动负载，读取 CSV 文本后运行比较。
- `src/views/HexCompareView.vue`：消费启动负载，设置路径后运行比较。
- `src/views/PictureCompareView.vue`：消费启动负载，设置路径后运行比较。
- `src/views/RegistryCompareView.vue`：消费启动负载，读取 `.reg` 文本后运行比较。
- `src/views/MediaCompareView.vue`：消费启动负载，设置路径后运行比较。
- `src/views/VersionCompareView.vue`：消费启动负载，设置路径后运行比较。
- `src/i18n/locales/zh-CN.ts` 与 `src/i18n/locales/en-US.ts`：新增文案。
- `src/views/HomeView.test.ts`：更新首页行为测试。
- `src/app/sessionAutoSelect.test.ts`：补 patch 自动选择测试。
- `src/app/dropInput.test.ts`：补单文件 patch 与目标覆盖测试。
- `src/stores/savedSessions.test.ts`：补持久化、共享、自动保存清理测试。
- `src/stores/tabs.test.ts`：补关闭脏标签、Workspace 快照测试。
- `src/app/commandSystem.test.ts`：补命令分发测试。
- `src/layouts/AppLayout.test.ts`：补菜单/工具条命令测试。

## 5. 数据模型设计

### 5.1 启动负载

创建 `src/types/sessionLaunch.ts`：

```ts
import type { SessionDocument, SessionType } from '@/types/session'

export type SessionLaunchSource = 'home' | 'drop' | 'saved-session' | 'command' | 'workspace'

export interface SessionLaunchLocation {
  uri: string
  displayName?: string
  kind: 'file' | 'directory' | 'virtual'
  readOnly: boolean
}

export interface SessionLaunchPayload {
  id: string
  source: SessionLaunchSource
  sessionType: SessionType
  title: string
  route: string
  locations: {
    left?: SessionLaunchLocation
    right?: SessionLaunchLocation
    center?: SessionLaunchLocation
    output?: SessionLaunchLocation
  }
  autoRun: boolean
  session?: SessionDocument
}
```

创建 `src/stores/sessionLaunch.ts`：

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SessionLaunchPayload } from '@/types/sessionLaunch'

export const useSessionLaunchStore = defineStore('sessionLaunch', () => {
  const pendingLaunch = ref<SessionLaunchPayload>()

  function setPendingLaunch(payload: SessionLaunchPayload): void {
    pendingLaunch.value = payload
  }

  function consumeLaunch(route: string): SessionLaunchPayload | undefined {
    if (pendingLaunch.value?.route !== route) {
      return undefined
    }

    const payload = pendingLaunch.value
    pendingLaunch.value = undefined

    return payload
  }

  return { pendingLaunch, setPendingLaunch, consumeLaunch }
})
```

### 5.2 Session 持久化键

在 `src/app/sessionPersistence.ts` 使用以下 key：

```ts
export const namedSessionsStorageKey = 'open-diff-named-sessions'
export const autoSavedSessionsStorageKey = 'open-diff-auto-saved-sessions'
export const workspacesStorageKey = 'open-diff-workspaces'
```

### 5.3 Workspace 文档

在 `src/stores/workspaces.ts` 定义：

```ts
import type { WorkspaceTabsSnapshot } from '@/stores/tabs'

export interface WorkspaceDocument {
  id: string
  name: string
  tabs: WorkspaceTabsSnapshot
  createdAt: string
  updatedAt: string
}
```

## 6. 实施任务

### 任务 1：建立 Session 启动负载与工厂

**文件：**

- 创建：`src/types/sessionLaunch.ts`
- 创建：`src/stores/sessionLaunch.ts`
- 创建：`src/app/sessionFactory.ts`
- 测试：`src/stores/sessionLaunch.test.ts`
- 测试：`src/app/sessionFactory.test.ts`

- [ ] **步骤 1：编写启动负载 store 测试**

在 `src/stores/sessionLaunch.test.ts` 写入：

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionLaunchStore } from './sessionLaunch'

describe('useSessionLaunchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('stores and consumes a launch payload for the matching route', () => {
    const store = useSessionLaunchStore()

    store.setPendingLaunch({
      id: 'launch-1',
      source: 'drop',
      sessionType: 'text-compare',
      title: 'left.txt vs right.txt',
      route: '/compare/text',
      autoRun: true,
      locations: {
        left: { uri: 'C:/work/left.txt', kind: 'file', readOnly: false },
        right: { uri: 'C:/work/right.txt', kind: 'file', readOnly: false },
      },
    })

    expect(store.consumeLaunch('/compare/folder')).toBeUndefined()
    expect(store.consumeLaunch('/compare/text')?.title).toBe('left.txt vs right.txt')
    expect(store.pendingLaunch).toBeUndefined()
  })
})
```

- [ ] **步骤 2：运行测试确认失败**

运行：`corepack pnpm test:unit -- src/stores/sessionLaunch.test.ts`

预期：失败，提示找不到 `./sessionLaunch`。

- [ ] **步骤 3：新增类型与 store**

按第 5.1 节代码创建 `src/types/sessionLaunch.ts` 和 `src/stores/sessionLaunch.ts`。

- [ ] **步骤 4：编写 Session 工厂测试**

在 `src/app/sessionFactory.test.ts` 写入：

```ts
import { describe, expect, it } from 'vitest'
import { createSessionFromLaunch, createUntitledSession } from './sessionFactory'

describe('sessionFactory', () => {
  it('creates a named session from launch locations', () => {
    const session = createSessionFromLaunch({
      id: 'launch-1',
      source: 'drop',
      sessionType: 'folder-compare',
      title: 'left vs right',
      route: '/compare/folder',
      autoRun: true,
      locations: {
        left: { uri: 'D:/left', kind: 'directory', readOnly: false },
        right: { uri: 'D:/right', kind: 'directory', readOnly: false },
      },
    })

    expect(session.name).toBe('left vs right')
    expect(session.sessionType).toBe('folder-compare')
    expect(session.locations.left?.uri).toBe('D:/left')
    expect(session.metadata.dirty).toBe(false)
  })

  it('creates an untitled session for a direct launcher entry', () => {
    const session = createUntitledSession('text-patch')

    expect(session.name).toBe('Untitled Text Patch')
    expect(session.sessionType).toBe('text-patch')
    expect(session.view.layout).toBe('side-by-side')
  })
})
```

- [ ] **步骤 5：实现 Session 工厂**

在 `src/app/sessionFactory.ts` 实现：

```ts
import {
  createDefaultSessionMetadata,
  createDefaultSessionViewState,
  type SessionDocument,
  type SessionLocation,
  type SessionType,
} from '@/types/session'
import type { SessionLaunchPayload, SessionLaunchLocation } from '@/types/sessionLaunch'

const sessionTitleByType: Record<SessionType, string> = {
  'clipboard-compare': 'Clipboard Compare',
  'folder-compare': 'Folder Compare',
  'folder-merge': 'Folder Merge',
  'folder-sync': 'Folder Sync',
  'hex-compare': 'Hex Compare',
  'media-compare': 'Media Compare',
  'picture-compare': 'Picture Compare',
  'registry-compare': 'Registry Compare',
  'table-compare': 'Table Compare',
  'text-compare': 'Text Compare',
  'text-edit': 'Text Edit',
  'text-merge': 'Text Merge',
  'text-patch': 'Text Patch',
  'version-compare': 'Version Compare',
}

export function createSessionFromLaunch(payload: SessionLaunchPayload): SessionDocument {
  return {
    id: crypto.randomUUID(),
    name: payload.title,
    sessionType: payload.sessionType,
    locations: {
      left: toSessionLocation(payload.locations.left),
      right: toSessionLocation(payload.locations.right),
      center: toSessionLocation(payload.locations.center),
      output: toSessionLocation(payload.locations.output),
    },
    view: createDefaultSessionViewState(),
    rules: { filters: [], comparison: {} },
    metadata: timestampMetadata(),
  }
}

export function createUntitledSession(sessionType: SessionType): SessionDocument {
  return {
    id: crypto.randomUUID(),
    name: `Untitled ${sessionTitleByType[sessionType]}`,
    sessionType,
    locations: {},
    view: createDefaultSessionViewState(),
    rules: { filters: [], comparison: {} },
    metadata: timestampMetadata(),
  }
}

function toSessionLocation(
  location: SessionLaunchLocation | undefined,
): SessionLocation | undefined {
  if (!location) {
    return undefined
  }

  return {
    uri: location.uri,
    displayName: location.displayName,
    readOnly: location.readOnly,
  }
}

function timestampMetadata(): SessionDocument['metadata'] {
  const now = new Date().toISOString()

  return {
    ...createDefaultSessionMetadata(),
    createdAt: now,
    updatedAt: now,
  }
}
```

- [ ] **步骤 6：运行测试验证通过**

运行：`corepack pnpm test:unit -- src/stores/sessionLaunch.test.ts src/app/sessionFactory.test.ts`

预期：全部通过。

- [ ] **步骤 7：Commit**

```bash
git add src/types/sessionLaunch.ts src/stores/sessionLaunch.ts src/stores/sessionLaunch.test.ts src/app/sessionFactory.ts src/app/sessionFactory.test.ts
git commit -m "feat: 建立会话启动负载模型"
```

### 任务 2：修复 Text Patch 入口、路由与自动选择

**文件：**

- 创建：`src/views/TextPatchView.vue`
- 创建：`src/views/TextPatchView.test.ts`
- 修改：`src/app/router.ts`
- 修改：`src/app/sessionCatalog.ts`
- 修改：`src/app/sessionAutoSelect.ts`
- 修改：`src/app/sessionAutoSelect.test.ts`
- 修改：`src/app/dropInput.ts`
- 修改：`src/app/dropInput.test.ts`
- 修改：`src/i18n/locales/zh-CN.ts`
- 修改：`src/i18n/locales/en-US.ts`

- [ ] **步骤 1：补自动选择失败测试**

在 `src/app/sessionAutoSelect.test.ts` 增加：

```ts
it('selects text patch for patch and diff files', () => {
  expect(selectSessionForDrop(pair('change.diff', 'change.diff'))).toMatchObject({
    sessionType: 'text-patch',
    route: '/patch/text',
    enabled: true,
  })

  expect(selectSessionForDrop(pair('feature.patch', 'feature.patch'))).toMatchObject({
    sessionType: 'text-patch',
    route: '/patch/text',
    enabled: true,
  })
})
```

- [ ] **步骤 2：允许单个 patch 文件拖放**

在 `src/app/dropInput.test.ts` 增加：

```ts
it('accepts a single patch file as a patch drop', () => {
  expect(classifyDropInputs([{ path: 'C:/work/change.patch', kind: 'file' }])).toMatchObject({
    kind: 'patch',
    left: { displayName: 'change.patch' },
  })
})
```

修改 `src/app/dropInput.ts`：

```ts
export type DropClassificationKind = 'files' | 'folders' | 'mixed' | 'patch' | 'invalid'
```

并在 `classifyDropInputs` 的数量判断之前加入：

```ts
if (inputs.length === 1) {
  const [only] = inputs.map(toClassifiedDropItem)

  if (only && isPatchPath(only.path)) {
    return { kind: 'patch', left: only, right: only }
  }
}
```

在文件末尾加入：

```ts
function isPatchPath(path: string): boolean {
  const lower = path.toLowerCase()

  return lower.endsWith('.diff') || lower.endsWith('.patch')
}
```

- [ ] **步骤 3：运行测试确认失败**

运行：`corepack pnpm test:unit -- src/app/dropInput.test.ts src/app/sessionAutoSelect.test.ts`

预期：失败，提示 `patch` 类型和 `/patch/text` 逻辑未实现。

- [ ] **步骤 4：启用 sessionCatalog 入口**

修改 `src/app/sessionCatalog.ts` 中 `text-patch`：

```ts
{
  type: 'text-patch',
  title: 'Text Patch',
  summary: 'Unified patch review',
  priority: 'P2',
  implemented: true,
  route: '/patch/text',
}
```

- [ ] **步骤 5：修复自动选择**

修改 `src/app/sessionAutoSelect.ts`：

```ts
const patchExtensions = new Set(['diff', 'patch'])
```

在文件类型判断前加入：

```ts
if (
  drop.kind === 'patch' ||
  extensions.every((extension) => extension && patchExtensions.has(extension))
) {
  return selectionFor('text-patch')
}
```

并从 `textExtensions` 中移除 `diff` 和 `patch`。

- [ ] **步骤 6：新增 Text Patch 页面测试**

在 `src/views/TextPatchView.test.ts` 写入：

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextPatchView from './TextPatchView.vue'
import { parseTextPatch } from '@/api/diff'

vi.mock('@/api/diff', () => ({
  parseTextPatch: vi.fn().mockResolvedValue({
    files: [
      {
        oldPath: 'a/src/main.ts',
        newPath: 'b/src/main.ts',
        hunks: [
          {
            oldStart: 1,
            oldCount: 2,
            newStart: 1,
            newCount: 2,
            heading: 'main',
            lines: [
              { kind: 'context', oldNumber: 1, newNumber: 1, text: 'const a = 1' },
              { kind: 'removed', oldNumber: 2, newNumber: null, text: 'old' },
              { kind: 'added', oldNumber: null, newNumber: 2, text: 'new' },
            ],
          },
        ],
      },
    ],
  }),
}))

describe('TextPatchView', () => {
  beforeEach(() => {
    vi.mocked(parseTextPatch).mockClear()
  })

  it('parses patch text and renders files, hunks, and changed lines', async () => {
    const wrapper = mount(TextPatchView, {
      global: {
        stubs: {
          NButton: {
            emits: ['click'],
            template: '<button @click="$emit(`click`)"><slot /></button>',
          },
        },
      },
    })

    await wrapper
      .find('[data-testid="patch-input"]')
      .setValue('--- a/src/main.ts\n+++ b/src/main.ts')
    await wrapper.find('[data-testid="parse-patch"]').trigger('click')

    expect(parseTextPatch).toHaveBeenCalled()
    expect(wrapper.text()).toContain('a/src/main.ts')
    expect(wrapper.text()).toContain('old')
    expect(wrapper.text()).toContain('new')
  })
})
```

- [ ] **步骤 7：实现 Text Patch 页面**

`src/views/TextPatchView.vue` 结构：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseTextPatch } from '@/api/diff'
import type { TextPatchResponse } from '@/types/diff'

const patchInput = ref('--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1,1 +1,1 @@\n-old\n+new')
const result = ref<TextPatchResponse>({ files: [] })
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const activeChangeIndex = ref(0)

const changedLines = computed(() =>
  result.value.files.flatMap((file) =>
    file.hunks.flatMap((hunk) =>
      hunk.lines
        .filter((line) => line.kind !== 'context')
        .map((line) => ({ file: file.newPath || file.oldPath, line })),
    ),
  ),
)

const filteredFiles = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) {
    return result.value.files
  }

  return result.value.files.filter((file) =>
    [
      file.oldPath,
      file.newPath,
      ...file.hunks.flatMap((hunk) => hunk.lines.map((line) => line.text)),
    ]
      .join('\n')
      .toLowerCase()
      .includes(query),
  )
})

async function runParsePatch(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    result.value = await parseTextPatch(patchInput.value)
    activeChangeIndex.value = 0
  } catch (event) {
    error.value = event instanceof Error ? event.message : String(event)
  } finally {
    loading.value = false
  }
}

function nextChange(): void {
  if (changedLines.value.length === 0) {
    activeChangeIndex.value = 0
    return
  }

  activeChangeIndex.value = (activeChangeIndex.value + 1) % changedLines.value.length
}

function previousChange(): void {
  if (changedLines.value.length === 0) {
    activeChangeIndex.value = 0
    return
  }

  activeChangeIndex.value =
    (activeChangeIndex.value - 1 + changedLines.value.length) % changedLines.value.length
}
</script>

<template>
  <section class="text-patch-view">
    <header class="patch-header">
      <div>
        <p class="eyebrow">{{ $t('ui.textPatch') }}</p>
        <h1>{{ $t('ui.textPatch') }}</h1>
      </div>
      <strong data-testid="patch-change-count">{{ changedLines.length }} changes</strong>
    </header>

    <section class="patch-controls">
      <input
        v-model="searchQuery"
        data-testid="patch-search"
        type="search"
        :placeholder="$t('ui.find')"
      />
      <NButton
        data-testid="previous-patch-change"
        @click="previousChange"
        >{{ $t('ui.previous') }}</NButton
      >
      <NButton
        data-testid="next-patch-change"
        @click="nextChange"
        >{{ $t('ui.next') }}</NButton
      >
      <NButton
        data-testid="parse-patch"
        :disabled="loading"
        @click="runParsePatch"
        >{{ $t('ui.runDiff') }}</NButton
      >
    </section>

    <textarea
      v-model="patchInput"
      data-testid="patch-input"
      class="patch-input"
    ></textarea>

    <p
      v-if="error"
      data-testid="patch-error"
      class="patch-error"
    >
      {{ error }}
    </p>

    <section class="patch-files">
      <article
        v-for="file in filteredFiles"
        :key="`${file.oldPath}:${file.newPath}`"
        class="patch-file"
      >
        <h2>{{ file.oldPath }} -> {{ file.newPath }}</h2>
        <div
          v-for="hunk in file.hunks"
          :key="`${hunk.oldStart}:${hunk.newStart}`"
          class="patch-hunk"
        >
          <strong
            >@@ -{{ hunk.oldStart }},{{ hunk.oldCount }} +{{ hunk.newStart }},{{ hunk.newCount }} @@
            {{ hunk.heading }}</strong
          >
          <pre
            v-for="line in hunk.lines"
            :key="`${line.kind}:${line.oldNumber}:${line.newNumber}:${line.text}`"
            :class="`patch-line patch-line-${line.kind}`"
            >{{ line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '
            }}{{ line.text }}</pre
          >
        </div>
      </article>
    </section>
  </section>
</template>
```

样式按现有 `TextCompareView.vue` 的密集工作台风格补充，使用 `var(--app-*)` 和 `var(--diff-*)`。

- [ ] **步骤 8：接入路由与文案**

在 `src/app/router.ts` 引入并注册：

```ts
import TextPatchView from '@/views/TextPatchView.vue'
```

```ts
{ path: '/patch/text', name: 'text-patch', component: TextPatchView },
```

在 `zh-CN.ts` 增加：

```ts
'ui.textPatch': '文本补丁',
```

在 `en-US.ts` 增加：

```ts
'ui.textPatch': 'Text Patch',
```

- [ ] **步骤 9：运行测试验证通过**

运行：

```bash
corepack pnpm test:unit -- src/app/dropInput.test.ts src/app/sessionAutoSelect.test.ts src/views/TextPatchView.test.ts
corepack pnpm typecheck
```

预期：全部通过。

- [ ] **步骤 10：Commit**

```bash
git add src/app/dropInput.ts src/app/dropInput.test.ts src/app/sessionAutoSelect.ts src/app/sessionAutoSelect.test.ts src/app/sessionCatalog.ts src/app/router.ts src/views/TextPatchView.vue src/views/TextPatchView.test.ts src/i18n/locales/zh-CN.ts src/i18n/locales/en-US.ts
git commit -m "feat: 启用文本补丁视图"
```

### 任务 3：让首页拖放和入口携带真实启动负载

**文件：**

- 修改：`src/views/HomeView.vue`
- 修改：`src/views/HomeView.test.ts`
- 修改：`src/app/sessionAutoSelect.ts`
- 修改：`src/app/sessionAutoSelect.test.ts`
- 修改：`src/app/dropInput.ts`
- 修改：`src/components/session/SavedSessionNode.vue`

- [ ] **步骤 1：为首页启动负载写测试**

在 `src/views/HomeView.test.ts` 增加：

```ts
it('opens a dropped pair with launch locations', async () => {
  const wrapper = mount(HomeView, {
    global: {
      stubs: {
        NButton: {
          props: ['disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(`click`)"><slot /></button>',
        },
      },
    },
  })

  await wrapper.find('[data-testid="simulate-text-drop"]').trigger('click')
  await wrapper.find('[data-testid="open-suggested-view"]').trigger('click')

  expect(push).toHaveBeenCalledWith('/compare/text')
})
```

在测试挂载后读取 `useSessionLaunchStore()` 并断言：

```ts
expect(launchStore.pendingLaunch?.locations.left?.uri).toBe('C:/work/left.txt')
expect(launchStore.pendingLaunch?.locations.right?.uri).toBe('C:/work/right.txt')
```

- [ ] **步骤 2：运行测试确认失败**

运行：`corepack pnpm test:unit -- src/views/HomeView.test.ts`

预期：失败，提示按钮或 launch store 未接入。

- [ ] **步骤 3：改造 HomeView 启动函数**

在 `src/views/HomeView.vue` 引入：

```ts
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import type { SessionLaunchPayload } from '@/types/sessionLaunch'
```

创建 store：

```ts
const sessionLaunch = useSessionLaunchStore()
```

新增构造函数：

```ts
function buildLaunchPayload(entry: SessionCatalogEntry): SessionLaunchPayload {
  return {
    id: crypto.randomUUID(),
    source: 'home',
    sessionType: entry.type,
    title: entry.title,
    route: entry.route ?? '/',
    locations: {},
    autoRun: false,
  }
}
```

在 `openSession` 中设置：

```ts
sessionLaunch.setPendingLaunch(buildLaunchPayload(entry))
```

在 `openSelectedDropSession` 中设置：

```ts
sessionLaunch.setPendingLaunch({
  id: crypto.randomUUID(),
  source: 'drop',
  sessionType: selectedDropSession.value.sessionType,
  title: selectedDropSession.value.title,
  route: selectedDropSession.value.route,
  autoRun: true,
  locations: {
    left: {
      uri: dropResult.value.left.path,
      displayName: dropResult.value.left.displayName,
      kind: dropResult.value.left.sourceKind,
      readOnly: false,
    },
    right: {
      uri: dropResult.value.right.path,
      displayName: dropResult.value.right.displayName,
      kind: dropResult.value.right.sourceKind,
      readOnly: false,
    },
  },
})
```

- [ ] **步骤 4：为测试添加模拟拖放按钮**

仅在测试环境渲染辅助按钮：

```vue
<button
  v-if="import.meta.env.MODE === 'test'"
  type="button"
  data-testid="simulate-text-drop"
  @click="simulateTextDropForTest"
>
  Simulate text drop
</button>
```

脚本中加入：

```ts
function simulateTextDropForTest(): void {
  dropResult.value = classifyDropInputs([
    { path: 'C:/work/left.txt', kind: 'file' },
    { path: 'C:/work/right.txt', kind: 'file' },
  ])
  selectedDropSession.value =
    dropResult.value.kind === 'invalid' ? undefined : selectSessionForDrop(dropResult.value)
}
```

给按钮增加 test id：

```vue
data-testid="open-suggested-view"
```

- [ ] **步骤 5：支持拖到具体 Session 卡片**

在每个 `article.session-entry` 上添加：

```vue
@dragover.prevent @drop="handleSessionEntryDrop($event, entry)"
```

脚本中加入：

```ts
function handleSessionEntryDrop(event: DragEvent, entry: SessionCatalogEntry): void {
  event.preventDefault()

  if (!entry.implemented || !entry.route) {
    return
  }

  const classification = classifyDropInputs(inputsFromDataTransfer(event.dataTransfer))

  if (classification.kind === 'invalid') {
    dropResult.value = classification
    selectedDropSession.value = undefined
    return
  }

  dropResult.value = classification
  selectedDropSession.value = {
    sessionType: entry.type,
    title: entry.title,
    enabled: true,
    route: entry.route,
  }
  openSelectedDropSession()
}
```

- [ ] **步骤 6：运行测试验证通过**

运行：`corepack pnpm test:unit -- src/views/HomeView.test.ts`

预期：通过。

- [ ] **步骤 7：Commit**

```bash
git add src/views/HomeView.vue src/views/HomeView.test.ts
git commit -m "feat: 首页拖放携带会话启动负载"
```

### 任务 4：目标视图消费启动负载并自动运行

**文件：**

- 修改：`src/views/TextCompareView.vue`
- 修改：`src/views/TextCompareView.test.ts`
- 修改：`src/views/FolderCompareView.vue`
- 修改：`src/views/FolderCompareView.test.ts`
- 修改：`src/views/TableCompareView.vue`
- 修改：`src/views/TableCompareView.test.ts`
- 修改：`src/views/HexCompareView.vue`
- 修改：`src/views/HexCompareView.test.ts`
- 修改：`src/views/PictureCompareView.vue`
- 修改：`src/views/PictureCompareView.test.ts`
- 修改：`src/views/TextPatchView.vue`
- 修改：`src/views/TextPatchView.test.ts`

- [ ] **步骤 1：为 TextCompare 启动负载写测试**

在 `TextCompareView.test.ts` 增加：

```ts
it('loads launch paths from pending session launch', async () => {
  const launchStore = useSessionLaunchStore()

  launchStore.setPendingLaunch({
    id: 'launch-text',
    source: 'drop',
    sessionType: 'text-compare',
    title: 'left.txt vs right.txt',
    route: '/compare/text',
    autoRun: true,
    locations: {
      left: { uri: 'C:/work/left.txt', kind: 'file', readOnly: false },
      right: { uri: 'C:/work/right.txt', kind: 'file', readOnly: false },
    },
  })

  const wrapper = mount(TextCompareView, { global: testGlobal })

  await flushPromises()

  expect(wrapper.text()).toContain('C:/work/left.txt')
  expect(wrapper.text()).toContain('C:/work/right.txt')
})
```

- [ ] **步骤 2：抽取通用消费模式**

每个视图引入：

```ts
import { onMounted } from 'vue'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
```

在脚本中：

```ts
const sessionLaunch = useSessionLaunchStore()

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/compare/text')

  if (!launch) {
    return
  }

  applyLaunch(launch)
})
```

`TextCompareView.vue` 的 `applyLaunch`：

```ts
function applyLaunch(launch: SessionLaunchPayload): void {
  leftPath.value = launch.locations.left?.uri ?? leftPath.value
  rightPath.value = launch.locations.right?.uri ?? rightPath.value

  if (launch.autoRun) {
    void loadAndCompareTextFiles()
  }
}
```

如果当前 `TextCompareView` 还没有路径输入，新增：

```ts
const leftPath = ref('')
const rightPath = ref('')
```

并在模板顶部显示两个路径输入。

- [ ] **步骤 3：接入文本读取**

`TextCompareView.vue` 引入 `readTextFile`：

```ts
import { diffText, readTextFile } from '@/api/diff'
```

新增：

```ts
async function loadAndCompareTextFiles(): Promise<void> {
  if (!leftPath.value || !rightPath.value) {
    return
  }

  const [leftFile, rightFile] = await Promise.all([
    readTextFile(leftPath.value),
    readTextFile(rightPath.value),
  ])

  left.value = leftFile.text
  right.value = rightFile.text
  await runDiff()
}
```

- [ ] **步骤 4：Folder/Hex/Picture/Table/TextPatch 页面按同一模式接入**

每个页面消费自己的路由：

- Folder：`/compare/folder`，设置 `leftRoot/rightRoot`，`autoRun` 时调用 `runFolderCompare()`。
- Hex：`/compare/hex`，设置 `leftPath/rightPath`，`autoRun` 时调用 `runHexCompare()`。
- Picture：`/compare/picture`，设置 `leftPath/rightPath`，`autoRun` 时调用 `runPictureCompare()`。
- Table：`/compare/table`，用 `readTextFile` 读取左右 CSV 到 `leftCsv/rightCsv`，`autoRun` 时调用 `runTableCompare()`。
- TextPatch：`/patch/text`，用 `readTextFile` 读取左侧 patch 到 `patchInput`，`autoRun` 时调用 `runParsePatch()`。

- [ ] **步骤 5：运行视图测试**

运行：

```bash
corepack pnpm test:unit -- src/views/TextCompareView.test.ts src/views/FolderCompareView.test.ts src/views/TableCompareView.test.ts src/views/HexCompareView.test.ts src/views/PictureCompareView.test.ts src/views/TextPatchView.test.ts
```

预期：全部通过。

- [ ] **步骤 6：Commit**

```bash
git add src/views/TextCompareView.vue src/views/TextCompareView.test.ts src/views/FolderCompareView.vue src/views/FolderCompareView.test.ts src/views/TableCompareView.vue src/views/TableCompareView.test.ts src/views/HexCompareView.vue src/views/HexCompareView.test.ts src/views/PictureCompareView.vue src/views/PictureCompareView.test.ts src/views/TextPatchView.vue src/views/TextPatchView.test.ts
git commit -m "feat: 视图消费会话启动负载"
```

### 任务 5：Saved Sessions 持久化与真实管理

**文件：**

- 创建：`src/app/sessionPersistence.ts`
- 创建：`src/app/sessionFile.ts`
- 创建：`src/components/session/SessionSaveDialog.vue`
- 创建：`src/components/session/SessionSaveDialog.test.ts`
- 修改：`src/stores/savedSessions.ts`
- 修改：`src/stores/savedSessions.test.ts`
- 修改：`src/views/HomeView.vue`
- 修改：`src/views/HomeView.test.ts`
- 修改：`src/components/session/SavedSessionNode.vue`
- 修改：`src/components/session/SavedSessionNode.test.ts`

- [ ] **步骤 1：编写持久化测试**

在 `src/app/sessionPersistence.test.ts` 写入：

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  loadNamedSessions,
  saveNamedSessions,
  loadAutoSavedSessions,
  saveAutoSavedSessions,
} from './sessionPersistence'
import { sampleSavedSessions } from './savedSessions'

describe('sessionPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round trips named sessions through localStorage', () => {
    saveNamedSessions(sampleSavedSessions)

    expect(loadNamedSessions()).toEqual(sampleSavedSessions)
  })

  it('returns an empty list for invalid stored sessions', () => {
    localStorage.setItem('open-diff-named-sessions', '{bad json')

    expect(loadNamedSessions()).toEqual([])
  })

  it('round trips auto-saved sessions separately', () => {
    saveAutoSavedSessions([sampleSavedSessions[0]])

    expect(loadAutoSavedSessions()).toHaveLength(1)
  })
})
```

- [ ] **步骤 2：实现持久化模块**

在 `src/app/sessionPersistence.ts` 实现：

```ts
import { isSessionType, type SessionDocument } from '@/types/session'

export const namedSessionsStorageKey = 'open-diff-named-sessions'
export const autoSavedSessionsStorageKey = 'open-diff-auto-saved-sessions'
export const workspacesStorageKey = 'open-diff-workspaces'

export function loadNamedSessions(): SessionDocument[] {
  return loadSessionList(namedSessionsStorageKey)
}

export function saveNamedSessions(sessions: SessionDocument[]): void {
  localStorage.setItem(namedSessionsStorageKey, JSON.stringify(sessions))
}

export function loadAutoSavedSessions(): SessionDocument[] {
  return loadSessionList(autoSavedSessionsStorageKey)
}

export function saveAutoSavedSessions(sessions: SessionDocument[]): void {
  localStorage.setItem(autoSavedSessionsStorageKey, JSON.stringify(sessions))
}

function loadSessionList(key: string): SessionDocument[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown

    return Array.isArray(parsed) ? parsed.filter(isSessionDocument) : []
  } catch {
    return []
  }
}

function isSessionDocument(value: unknown): value is SessionDocument {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<SessionDocument>

  return Boolean(
    candidate.id && candidate.name && candidate.sessionType && isSessionType(candidate.sessionType),
  )
}
```

- [ ] **步骤 3：改造 savedSessions store**

初始化：

```ts
const storedSessions = loadNamedSessions()
const sessions = ref<SessionDocument[]>(
  storedSessions.length > 0 ? cloneSessions(storedSessions) : cloneSessions(sampleSavedSessions),
)
const autoSavedSessions = ref<SessionDocument[]>(loadAutoSavedSessions())
```

新增统一保存：

```ts
function persistNamedSessions(): void {
  saveNamedSessions(sessions.value.filter((session) => !session.metadata.autoSaved))
}
```

在 `renameSession/copySession/moveSession/deleteSession/overwriteSession/setSessionLocked/updateSessionRules/markSessionSaved/loadSharedSession` 成功后调用 `persistNamedSessions()`。

新增：

```ts
function saveSession(session: SessionDocument): SessionDocument {
  const existingIndex = sessions.value.findIndex((item) => item.id === session.id)
  const next = cloneSession({
    ...session,
    metadata: {
      ...session.metadata,
      dirty: false,
      autoSaved: false,
      updatedAt: new Date().toISOString(),
    },
  })

  if (existingIndex >= 0) {
    if (sessions.value[existingIndex]?.metadata.locked) {
      throw new Error('Locked sessions cannot be overwritten.')
    }

    sessions.value[existingIndex] = next
  } else {
    sessions.value.push(next)
  }

  persistNamedSessions()

  return next
}

function saveSessionAs(session: SessionDocument, name: string, folder?: string): SessionDocument {
  const copy = cloneSession(session)

  copy.id = crypto.randomUUID()
  copy.name = name
  copy.metadata = {
    ...copy.metadata,
    folder,
    dirty: false,
    locked: false,
    shared: false,
    autoSaved: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  sessions.value.push(copy)
  persistNamedSessions()

  return copy
}
```

- [ ] **步骤 4：补保存对话框**

`SessionSaveDialog.vue` 暴露 props：

```ts
interface Props {
  visible: boolean
  mode: 'save' | 'save-as' | 'rename' | 'move'
  initialName: string
  initialFolder?: string
  locked?: boolean
  shared?: boolean
}
```

事件：

```ts
const emit = defineEmits<{
  cancel: []
  submit: [payload: { name: string; folder?: string }]
}>()
```

模板包含 `data-testid="session-name-input"`、`data-testid="session-folder-input"`、`data-testid="confirm-session-save"`。

- [ ] **步骤 5：HomeView 接入真实保存/另存**

新增状态：

```ts
const saveDialogVisible = ref(false)
const saveDialogMode = ref<'save' | 'save-as' | 'rename' | 'move'>('save-as')
const editingSessionId = ref<string>()
```

新增入口按钮：

```vue
<NButton
  data-testid="save-current-session"
  @click="openSaveCurrentSessionDialog"
>{{ $t('ui.save') }}</NButton>
<NButton
  data-testid="save-current-session-as"
  @click="openSaveAsDialog"
>{{ $t('ui.saveAs') }}</NButton>
```

保存当前首页上下文时使用 `createUntitledSession('text-compare')` 或活动标签映射创建 `SessionDocument`。实现活动标签映射函数：

```ts
function sessionTypeFromRoute(route: string): SessionType {
  return sessionCatalog.find((entry) => entry.route === route)?.type ?? 'text-compare'
}
```

- [ ] **步骤 6：SavedSessionNode 增加锁定/解锁与打开**

为 session 节点新增按钮：

- `data-testid="open-session-${id}"`
- `data-testid="lock-session-${id}"`
- `data-testid="save-shared-session-copy-${id}"`

锁定按钮调用 `setSessionLocked(id, !locked)`。

- [ ] **步骤 7：运行测试**

运行：

```bash
corepack pnpm test:unit -- src/app/sessionPersistence.test.ts src/stores/savedSessions.test.ts src/components/session/SessionSaveDialog.test.ts src/components/session/SavedSessionNode.test.ts src/views/HomeView.test.ts
```

预期：全部通过。

- [ ] **步骤 8：Commit**

```bash
git add src/app/sessionPersistence.ts src/app/sessionPersistence.test.ts src/app/sessionFile.ts src/components/session/SessionSaveDialog.vue src/components/session/SessionSaveDialog.test.ts src/stores/savedSessions.ts src/stores/savedSessions.test.ts src/views/HomeView.vue src/views/HomeView.test.ts src/components/session/SavedSessionNode.vue src/components/session/SavedSessionNode.test.ts
git commit -m "feat: 完善已保存会话管理"
```

### 任务 6：自动保存、恢复列表与清理

**文件：**

- 修改：`src/stores/savedSessions.ts`
- 修改：`src/stores/savedSessions.test.ts`
- 修改：`src/stores/settings.ts`
- 修改：`src/stores/settings.test.ts`
- 修改：`src/views/HomeView.vue`
- 修改：`src/views/HomeView.test.ts`
- 修改：`src/i18n/locales/zh-CN.ts`
- 修改：`src/i18n/locales/en-US.ts`

- [ ] **步骤 1：设置自动保存数量**

在 `settings.ts` 增加：

```ts
const autoSaveLimit = ref(loadAutoSaveLimit())

watch(autoSaveLimit, (value) => {
  localStorage.setItem('open-diff-auto-save-limit', String(value))
})

function setAutoSaveLimit(value: number): void {
  autoSaveLimit.value = Math.max(0, Math.min(50, Math.floor(value)))
}
```

`loadAutoSaveLimit` 默认返回 `10`。

- [ ] **步骤 2：补自动保存 store API**

在 `savedSessions.ts` 增加：

```ts
function autoSaveSession(session: SessionDocument, limit: number): void {
  const snapshot = cloneSession(session)
  snapshot.id = session.id || crypto.randomUUID()
  snapshot.metadata = {
    ...snapshot.metadata,
    autoSaved: true,
    dirty: false,
    updatedAt: new Date().toISOString(),
  }

  autoSavedSessions.value = [
    snapshot,
    ...autoSavedSessions.value.filter((item) => item.id !== snapshot.id),
  ].slice(0, limit)

  saveAutoSavedSessions(autoSavedSessions.value)
  detectRecoverySessions(autoSavedSessions.value)
}

function clearAutoSavedSessions(): void {
  autoSavedSessions.value = []
  recoveryCandidates.value = []
  saveAutoSavedSessions([])
}
```

- [ ] **步骤 3：HomeView 显示恢复列表与清理**

将单个 `recovery-entry` 改为列表：

```vue
<section
  v-if="savedSessions.recoveryCandidates.length > 0"
  class="recovery-list"
  data-testid="recovery-list"
>
  <article v-for="session in savedSessions.recoveryCandidates" :key="session.id" data-testid="recovery-entry">
    <span>{{ session.name }}</span>
    <button type="button" :data-testid="`restore-recovery-${session.id}`" @click="restoreRecoverySession(session.id)">
      {{ $t('ui.restoreRecent') }}
    </button>
  </article>
  <button type="button" data-testid="clear-auto-saved-sessions" @click="savedSessions.clearAutoSavedSessions()">
    {{ $t('ui.clear') }}
  </button>
</section>
```

- [ ] **步骤 4：运行测试**

运行：

```bash
corepack pnpm test:unit -- src/stores/settings.test.ts src/stores/savedSessions.test.ts src/views/HomeView.test.ts
```

预期：全部通过。

- [ ] **步骤 5：Commit**

```bash
git add src/stores/settings.ts src/stores/settings.test.ts src/stores/savedSessions.ts src/stores/savedSessions.test.ts src/views/HomeView.vue src/views/HomeView.test.ts src/i18n/locales/zh-CN.ts src/i18n/locales/en-US.ts
git commit -m "feat: 增加会话自动保存恢复"
```

### 任务 7：共享 Session 路径加载为只读分支

**文件：**

- 修改：`src/app/sessionFile.ts`
- 创建：`src/app/sessionFile.test.ts`
- 修改：`src/stores/settings.ts`
- 修改：`src/views/HomeView.vue`
- 修改：`src/views/HomeView.test.ts`
- 修改：`src/stores/savedSessions.ts`
- 修改：`src/stores/savedSessions.test.ts`

- [ ] **步骤 1：定义共享 Session 文件格式**

`src/app/sessionFile.ts`：

```ts
import type { SessionDocument } from '@/types/session'

export interface SessionPackage {
  version: 1
  sessions: SessionDocument[]
}

export function serializeSessionPackage(sessions: SessionDocument[]): string {
  return JSON.stringify({ version: 1, sessions }, null, 2)
}

export function parseSessionPackage(input: string): SessionPackage {
  const parsed = JSON.parse(input) as Partial<SessionPackage>

  if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
    throw new Error('Unsupported session package.')
  }

  return { version: 1, sessions: parsed.sessions }
}
```

- [ ] **步骤 2：测试共享包解析**

`src/app/sessionFile.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { parseSessionPackage, serializeSessionPackage } from './sessionFile'
import { sampleSavedSessions } from './savedSessions'

describe('sessionFile', () => {
  it('serializes and parses a versioned session package', () => {
    const serialized = serializeSessionPackage(sampleSavedSessions)

    expect(parseSessionPackage(serialized).sessions).toHaveLength(sampleSavedSessions.length)
  })

  it('rejects unsupported packages', () => {
    expect(() => parseSessionPackage('{"version":2,"sessions":[]}')).toThrow(
      'Unsupported session package.',
    )
  })
})
```

- [ ] **步骤 3：加载共享路径中的 JSON 文本**

浏览器开发环境无法读取任意本地路径，先在 UI 提供“粘贴共享包 JSON 并加载”的实际流程。Tauri 环境后续通过文件选择器替换输入来源，数据结构保持一致。

在 `SettingsView.vue` 的 Shared Sessions 卡片增加 textarea：

```vue
<NInput
  v-model:value="sharedSessionJsonDraft"
  type="textarea"
  data-testid="shared-session-json-input"
/>
<NButton data-testid="load-shared-session-json" @click="loadSharedSessionJson">
  {{ $t('ui.import') }}
</NButton>
```

脚本：

```ts
function loadSharedSessionJson(): void {
  const parsed = parseSessionPackage(sharedSessionJsonDraft.value)

  for (const session of parsed.sessions) {
    savedSessions.loadSharedSession(session)
  }
}
```

- [ ] **步骤 4：首页树显示共享只读分支**

`buildSavedSessionTree` 已经把 `shared` 放到 `Shared Sessions` 分支。确保 `SavedSessionNode.vue` 对 `session.metadata.shared` 显示只读徽标，并显示 `Save As Copy` 按钮。

- [ ] **步骤 5：运行测试**

运行：

```bash
corepack pnpm test:unit -- src/app/sessionFile.test.ts src/stores/savedSessions.test.ts src/views/SettingsView.test.ts src/views/HomeView.test.ts
```

预期：全部通过。

- [ ] **步骤 6：Commit**

```bash
git add src/app/sessionFile.ts src/app/sessionFile.test.ts src/stores/settings.ts src/views/SettingsView.vue src/views/SettingsView.test.ts src/views/HomeView.vue src/views/HomeView.test.ts src/stores/savedSessions.ts src/stores/savedSessions.test.ts
git commit -m "feat: 加载共享会话包"
```

### 任务 8：命名 Workspace 保存与恢复

**文件：**

- 创建：`src/stores/workspaces.ts`
- 创建：`src/stores/workspaces.test.ts`
- 创建：`src/components/session/WorkspaceManager.vue`
- 创建：`src/components/session/WorkspaceManager.test.ts`
- 修改：`src/views/HomeView.vue`
- 修改：`src/views/HomeView.test.ts`
- 修改：`src/stores/tabs.ts`
- 修改：`src/stores/tabs.test.ts`

- [ ] **步骤 1：编写 Workspace store 测试**

`src/stores/workspaces.test.ts`：

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkspacesStore } from './workspaces'

describe('useWorkspacesStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('saves, restores, renames, and deletes workspace documents', () => {
    const store = useWorkspacesStore()

    const workspace = store.saveWorkspace('Release review', {
      activeTabId: 'home',
      tabs: [{ id: 'home', title: 'Home', route: '/', dirty: false }],
    })

    expect(store.workspaces).toHaveLength(1)
    expect(store.renameWorkspace(workspace.id, 'Release audit')).toBe(true)
    expect(store.workspaces[0].name).toBe('Release audit')
    expect(store.deleteWorkspace(workspace.id)).toBe(true)
    expect(store.workspaces).toHaveLength(0)
  })
})
```

- [ ] **步骤 2：实现 store**

`src/stores/workspaces.ts`：

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { workspacesStorageKey } from '@/app/sessionPersistence'
import type { WorkspaceTabsSnapshot } from '@/stores/tabs'

export interface WorkspaceDocument {
  id: string
  name: string
  tabs: WorkspaceTabsSnapshot
  createdAt: string
  updatedAt: string
}

export const useWorkspacesStore = defineStore('workspaces', () => {
  const workspaces = ref<WorkspaceDocument[]>(loadWorkspaces())

  function saveWorkspace(name: string, tabs: WorkspaceTabsSnapshot): WorkspaceDocument {
    const now = new Date().toISOString()
    const workspace: WorkspaceDocument = {
      id: crypto.randomUUID(),
      name,
      tabs,
      createdAt: now,
      updatedAt: now,
    }

    workspaces.value = [workspace, ...workspaces.value]
    persist()

    return workspace
  }

  function renameWorkspace(id: string, name: string): boolean {
    const workspace = workspaces.value.find((item) => item.id === id)

    if (!workspace) {
      return false
    }

    workspace.name = name
    workspace.updatedAt = new Date().toISOString()
    persist()

    return true
  }

  function deleteWorkspace(id: string): boolean {
    const before = workspaces.value.length

    workspaces.value = workspaces.value.filter((workspace) => workspace.id !== id)
    persist()

    return workspaces.value.length !== before
  }

  function persist(): void {
    localStorage.setItem(workspacesStorageKey, JSON.stringify(workspaces.value))
  }

  return { workspaces, saveWorkspace, renameWorkspace, deleteWorkspace }
})

function loadWorkspaces(): WorkspaceDocument[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(workspacesStorageKey) ?? '[]') as unknown

    return Array.isArray(parsed) ? (parsed as WorkspaceDocument[]) : []
  } catch {
    return []
  }
}
```

- [ ] **步骤 3：WorkspaceManager UI**

提供保存当前、恢复、删除：

```vue
<section data-testid="workspace-manager">
  <input v-model="workspaceName" data-testid="workspace-name-input" />
  <button type="button" data-testid="save-workspace" @click="saveWorkspace">{{ $t('ui.save') }}</button>
  <article v-for="workspace in workspaces.workspaces" :key="workspace.id">
    <span>{{ workspace.name }}</span>
    <button type="button" :data-testid="`restore-workspace-${workspace.id}`" @click="$emit('restore', workspace.id)">
      {{ $t('ui.restoreRecent') }}
    </button>
    <button type="button" :data-testid="`delete-workspace-${workspace.id}`" @click="workspaces.deleteWorkspace(workspace.id)">
      {{ $t('ui.delete') }}
    </button>
  </article>
</section>
```

- [ ] **步骤 4：HomeView 接入恢复**

在 HomeView 中：

```ts
function restoreWorkspace(id: string): void {
  const workspace = workspaces.workspaces.find((item) => item.id === id)

  if (!workspace) {
    return
  }

  tabs.restoreWorkspaceTabs(workspace.tabs)
  const active = tabs.activeTab

  if (active) {
    void router.push(active.route)
  }
}
```

- [ ] **步骤 5：运行测试**

运行：

```bash
corepack pnpm test:unit -- src/stores/workspaces.test.ts src/components/session/WorkspaceManager.test.ts src/views/HomeView.test.ts src/stores/tabs.test.ts
```

预期：全部通过。

- [ ] **步骤 6：Commit**

```bash
git add src/stores/workspaces.ts src/stores/workspaces.test.ts src/components/session/WorkspaceManager.vue src/components/session/WorkspaceManager.test.ts src/views/HomeView.vue src/views/HomeView.test.ts src/stores/tabs.ts src/stores/tabs.test.ts
git commit -m "feat: 增加命名工作区管理"
```

### 任务 9：全局命令、菜单和工具条接入真实动作

**文件：**

- 修改：`src/app/commandRegistry.ts`
- 修改：`src/app/commandSystem.ts`
- 修改：`src/app/commandSystem.test.ts`
- 修改：`src/layouts/AppLayout.vue`
- 修改：`src/layouts/AppLayout.test.ts`
- 修改：`src/stores/tabs.ts`
- 修改：`src/stores/tabs.test.ts`
- 修改：`src/i18n/locales/zh-CN.ts`
- 修改：`src/i18n/locales/en-US.ts`

- [ ] **步骤 1：扩展命令类型**

`CommandId` 增加：

```ts
| 'open.textPatch'
| 'session.save'
| 'session.saveAs'
| 'session.export'
| 'session.closeTab'
| 'edit.copyLeft'
| 'edit.copyRight'
| 'view.showAll'
| 'view.showDifferences'
| 'workspace.save'
```

`CommandAction` 增加：

```ts
| { type: 'view-action'; name:
    | 'previous-difference'
    | 'next-difference'
    | 'copy-left'
    | 'copy-right'
    | 'save'
    | 'save-as'
    | 'export'
    | 'show-all'
    | 'show-differences'
  }
```

- [ ] **步骤 2：补命令注册**

在 `commandRegistry` 中新增：

```ts
{
  id: 'open.textPatch',
  titleKey: 'ui.textPatch',
  keywords: ['patch', 'diff', 'open'],
  enabled: true,
  visibility: 'global',
  defaultShortcut: { keys: ['Ctrl', 'Alt', 'P'], scope: 'global' },
  placements: ['command-palette', 'toolbar', 'menu'],
  action: { type: 'navigate', route: '/patch/text', titleKey: 'ui.textPatch' },
}
```

视图命令默认 `enabled: true`，具体页面不支持时由布局禁用或显示消息。

- [ ] **步骤 3：commandSystem 分发 view action**

`createCommandExecutor` 的依赖增加：

```ts
dispatchViewAction: (name: ViewActionName) => void
```

`view-action` 分支改为：

```ts
dependencies.dispatchViewAction(command.action.name)
```

- [ ] **步骤 4：AppLayout 接入菜单与工具条**

把静态菜单按钮替换为可打开面板：

```vue
<button type="button" data-testid="menu-file" @click="openMenu('file')">{{ t('ui.file') }}</button>
```

菜单面板中渲染对应命令：

```vue
<section v-if="activeMenu" class="menu-panel" data-testid="menu-panel">
  <button
    v-for="command in menuCommands"
    :key="command.id"
    type="button"
    :data-testid="`menu-command-${command.id}`"
    @click="executeCommand(command.id)"
  >
    {{ t(command.titleKey) }}
  </button>
</section>
```

工具条的 Save、Copy Left/Right 加 click：

```vue
@click="executeCommand('session.save')" @click="executeCommand('edit.copyRight')"
@click="executeCommand('edit.copyLeft')"
```

chips 改按钮：

```vue
<button
  type="button"
  data-testid="view-show-differences"
  @click="executeCommand('view.showDifferences')"
>
  {{ t('ui.differencesOnly') }}
</button>
```

- [ ] **步骤 5：标签关闭按钮**

在 tab 内增加：

```vue
<button type="button" :data-testid="`close-tab-${tab.id}`" @click.stop="closeTab(tab)">
  ×
</button>
```

脚本：

```ts
function closeTab(tab: AppTab): void {
  if (tab.dirty) {
    pendingCloseTab.value = tab
    return
  }

  tabs.closeTab(tab.id)
}
```

显示确认：

```vue
<section v-if="pendingCloseTab" data-testid="close-dirty-tab-prompt">
  <span>{{ pendingCloseTab.title }}</span>
  <button type="button" data-testid="confirm-close-dirty-tab" @click="confirmCloseDirtyTab">{{ t('ui.close') }}</button>
</section>
```

- [ ] **步骤 6：运行测试**

运行：

```bash
corepack pnpm test:unit -- src/app/commandSystem.test.ts src/layouts/AppLayout.test.ts src/stores/tabs.test.ts
```

预期：全部通过。

- [ ] **步骤 7：Commit**

```bash
git add src/app/commandRegistry.ts src/app/commandSystem.ts src/app/commandSystem.test.ts src/layouts/AppLayout.vue src/layouts/AppLayout.test.ts src/stores/tabs.ts src/stores/tabs.test.ts src/i18n/locales/zh-CN.ts src/i18n/locales/en-US.ts
git commit -m "feat: 接通全局菜单和工具条命令"
```

### 任务 10：端到端冒烟与质量验证

**文件：**

- 创建：`tests/e2e/home-session-workflow.spec.ts`
- 修改：`playwright.config.ts` 如需增加测试隔离配置

- [ ] **步骤 1：新增首页工作流 e2e**

`tests/e2e/home-session-workflow.spec.ts`：

```ts
import { expect, test } from '@playwright/test'

test('home opens Text Patch and saved sessions survive reload', async ({ page }) => {
  await page.goto('/')

  await page
    .getByTestId('session-entry')
    .filter({ hasText: 'Text Patch' })
    .getByRole('button', { name: 'Open' })
    .click()
  await expect(page).toHaveURL(/\/patch\/text/u)
  await expect(page.getByRole('heading', { name: 'Text Patch' })).toBeVisible()

  await page.goto('/')
  await page.getByTestId('save-current-session-as').click()
  await page.getByTestId('session-name-input').fill('E2E saved session')
  await page.getByTestId('confirm-session-save').click()
  await expect(page.getByTestId('saved-sessions')).toContainText('E2E saved session')

  await page.reload()
  await expect(page.getByTestId('saved-sessions')).toContainText('E2E saved session')
})
```

- [ ] **步骤 2：运行单元测试全集**

运行：`corepack pnpm test:unit`

预期：全部通过。

- [ ] **步骤 3：运行类型检查**

运行：`corepack pnpm typecheck`

预期：无类型错误。

- [ ] **步骤 4：运行 e2e**

运行：`corepack pnpm test:e2e`

预期：全部通过。

- [ ] **步骤 5：运行构建**

运行：`corepack pnpm build`

预期：构建成功，`dist/` 正常生成。

- [ ] **步骤 6：手工核对页面**

启动：`corepack pnpm dev --host 127.0.0.1 --port 5173`

在浏览器核对：

- 首页 Text Patch 按钮为 Open。
- 点击 Text Patch 后进入 `/patch/text`。
- 首页保存 Session 后刷新仍存在。
- 锁定 Session 后 rename/delete 禁用，另存副本可用。
- 恢复列表可显示并清理。
- File 菜单能打开命令面板，Save/Save As/Export 有命令项。
- 工具条 Copy Left/Right、Save、Show All、Differences Only 不再是无行为静态元素。

- [ ] **步骤 7：Commit**

```bash
git add tests/e2e/home-session-workflow.spec.ts playwright.config.ts
git commit -m "test: 增加首页会话工作流冒烟"
```

## 7. 需求覆盖矩阵

| 需求                         | 修复任务               | 验收方式                                           |
| ---------------------------- | ---------------------- | -------------------------------------------------- |
| HOME-001 首页入口            | 任务 2、任务 3         | HomeView 单测、e2e 打开 Text Patch                 |
| HOME-001 拖放自动选择        | 任务 2、任务 3、任务 4 | dropInput/sessionAutoSelect 单测、视图启动负载单测 |
| HOME-002 Saved Sessions      | 任务 5                 | savedSessions 单测、HomeView 单测、e2e 刷新保留    |
| HOME-003 Auto-Saved Sessions | 任务 6                 | savedSessions/settings/HomeView 单测               |
| HOME-004 搜索与管理面板      | 任务 5、任务 6         | HomeView 单测                                      |
| HOME-005 Shared Sessions     | 任务 7                 | sessionFile/settings/savedSessions 单测            |
| HOME-006 Workspaces          | 任务 8                 | workspaces/tabs/HomeView 单测                      |
| UI-001 标签页                | 任务 8、任务 9         | tabs/AppLayout 单测                                |
| UI-003 差异导航              | 任务 9                 | commandSystem/AppLayout 单测                       |
| UI-004 显示过滤              | 任务 9                 | commandSystem/AppLayout 单测                       |
| TEXT-008 Text Patch          | 任务 2、任务 4         | TextPatchView 单测、e2e                            |

## 8. 风险与约束

- 浏览器开发环境无法直接读取任意本地路径，拖放文件路径在 Web 环境只可靠获得文件名；Tauri 桌面环境可通过文件选择器或 Tauri drop event 获得完整路径。计划先建立统一启动负载，桌面路径接入可以复用同一接口。
- Shared Session 文件真实路径读取需要 Tauri 文件 API；本计划先实现 JSON 导入与只读分支，避免把设置路径误认为已加载内容。
- 全局 view-action 需要页面响应命令。第一批可以在 AppLayout 内发出自定义事件，页面逐步监听；不支持的页面要禁用命令或提示不可用。
- localStorage 持久化适合当前前端闭环；后续 Tauri 可迁移到 AppData 文件存储，`sessionPersistence.ts` 是迁移边界。
- 现有测试中部分 UI 文案为英文，新增中文文案时不能破坏现有英文测试；测试优先使用 `data-testid`。

## 9. 验证命令总表

每个任务完成后至少运行对应局部测试。整批完成后运行：

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm stylelint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm test:e2e
corepack pnpm build
```

Rust 侧未新增命令时不要求每个任务运行 Cargo；整批合并前运行：

```bash
corepack pnpm rust:fmt:check
corepack pnpm rust:clippy
```

## 10. 自检结果

- 已覆盖上一轮核对出的 11 个不满足项。
- 每个新增模块都有对应测试入口。
- 没有要求实现者自行猜测文件位置。
- 没有把共享 Session 路径保存误写成共享 Session 已加载。
- 没有把操作系统级多窗口放进本批交付，避免扩大范围。
- Text Patch、拖放启动、Saved Sessions、Auto-Save、Shared Sessions、Workspace、菜单工具条都能独立提交和回滚。
