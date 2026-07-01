<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'

const props = defineProps<{
  title: string
  eyebrow?: string
  subtitle?: string
  inspectorLabel?: string
}>()
const { t } = useI18n()
const resolvedInspectorLabel = computed(() => props.inspectorLabel ?? t('ui.inspector'))
const toolbarItems = computed(() => toolbarForTitle(props.title))

interface BcToolbarItem {
  label: string
  glyph: string
}

function item(label: string, glyph = ''): BcToolbarItem {
  return { label, glyph: glyph || label.slice(0, 1) }
}

function toolbarForTitle(title: string): BcToolbarItem[] {
  const normalizedTitle = title.toLowerCase()

  if (normalizedTitle.includes('folder merge') || normalizedTitle.includes('文件夹合并')) {
    return [
      item('Home', 'H'),
      item('Sessions', 'S'),
      item('All', '*'),
      item('Diffs', '!='),
      item('Same', '='),
      item('Minor', '~'),
      item('Same OK', 'OK'),
      item('Rules', 'R'),
      item('Merge', 'M'),
      item('To Output', 'O'),
      item('Expand', '+'),
      item('Collapse', '-'),
      item('Select', 'V'),
      item('Files', 'F'),
      item('Refresh', 'R'),
      item('Swap', '<>'),
      item('Stop', 'X'),
      item('Filters', 'F'),
      item('Peek', 'P'),
    ]
  }

  if (normalizedTitle.includes('folder sync') || normalizedTitle.includes('文件夹同步')) {
    return [
      item('Home', 'H'),
      item('Sessions', 'S'),
      item('Minor', '~'),
      item('Expand', '+'),
      item('Collapse', '-'),
      item('Select', 'V'),
      item('Refresh', 'R'),
      item('Stop', 'X'),
      item('Peek', 'P'),
      item('Accept', 'A'),
      item('Cancel', 'X'),
      item('Sync Now', 'S'),
    ]
  }

  if (normalizedTitle.includes('folder compare') || normalizedTitle.includes('文件夹比较')) {
    return [
      item('Home', 'H'),
      item('Sessions', 'S'),
      item('All', '*'),
      item('Diffs', '!='),
      item('Same', '='),
      item('Structure', 'St'),
      item('Minor', '~'),
      item('Rules', 'R'),
      item('Copy', 'C'),
      item('Expand', '+'),
      item('Collapse', '-'),
      item('Select', 'V'),
      item('Files', 'F'),
      item('Refresh', 'R'),
      item('Swap', '<>'),
      item('Stop', 'X'),
      item('Filters', 'F'),
      item('Peek', 'P'),
    ]
  }

  if (normalizedTitle.includes('text merge') || normalizedTitle.includes('文本合并')) {
    return [
      item('Home', 'H'),
      item('Sessions', 'S'),
      item('All', '*'),
      item('Diffs', '!='),
      item('Same', '='),
      item('Context', 'C'),
      item('Minor', '~'),
      item('Same OK', 'OK'),
      item('Favor Left', 'L'),
      item('Favor Right', 'R'),
      item('Rules', 'R'),
      item('Format', 'F'),
      item('Conflict', '!'),
      item('Left', 'L'),
      item('Center', 'C'),
      item('Right', 'R'),
      item('Next Conflict', 'N'),
      item('Prev Conflict', 'P'),
      item('Swap', '<>'),
      item('Reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('text compare') || normalizedTitle.includes('文本比较')) {
    return [
      item('Home', 'H'),
      item('Sessions', 'S'),
      item('All', '*'),
      item('Diffs', '!='),
      item('Same', '='),
      item('Context', 'C'),
      item('Minor', '~'),
      item('Rules', 'R'),
      item('Format', 'F'),
      item('Copy', 'C'),
      item('Next Section', 'N'),
      item('Prev Section', 'P'),
      item('Swap', '<>'),
      item('Reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('table compare') || normalizedTitle.includes('表格比较')) {
    return [
      item('Home', 'H'),
      item('All', '*'),
      item('Diffs', '!='),
      item('Same', '='),
      item('Minor', '~'),
      item('Rules', 'R'),
      item('Copy', 'C'),
      item('Next Diff', 'N'),
      item('Prev Diff', 'P'),
      item('Swap', '<>'),
      item('Reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('hex compare') || normalizedTitle.includes('十六进制比较')) {
    return [
      item('Home', 'H'),
      item('All', '*'),
      item('Diffs', '!='),
      item('Same', '='),
      item('Rules', 'R'),
      item('Copy', 'C'),
      item('Next Diff', 'N'),
      item('Prev Diff', 'P'),
      item('Swap', '<>'),
      item('Reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('picture compare') || normalizedTitle.includes('图片比较')) {
    return [
      item('Home', 'H'),
      item('Tol', 'T'),
      item('Range', 'R'),
      item('Blend', 'B'),
      item('Minor', '~'),
      item('Rules', 'R'),
      item('Swap', '<>'),
      item('Reload', 'R'),
      item('Meta', 'M'),
    ]
  }

  if (normalizedTitle.includes('registry compare') || normalizedTitle.includes('注册表比较')) {
    return [
      item('Home', 'H'),
      item('All', '*'),
      item('Diffs', '!='),
      item('Same', '='),
      item('Copy', 'C'),
      item('Next Diff', 'N'),
      item('Prev Diff', 'P'),
      item('Swap', '<>'),
      item('Reload', 'R'),
      item('Expand', '+'),
      item('Collapse', '-'),
    ]
  }

  if (normalizedTitle.includes('media compare') || normalizedTitle.includes('媒体比较')) {
    return [
      item('Home', 'H'),
      item('All', '*'),
      item('Diffs', '!='),
      item('Same', '='),
      item('Minor', '~'),
      item('Rules', 'R'),
      item('Next Diff', 'N'),
      item('Prev Diff', 'P'),
      item('Swap', '<>'),
      item('Reload', 'R'),
      item('Play', 'P'),
      item('Back', 'B'),
      item('Forward', 'F'),
    ]
  }

  if (normalizedTitle.includes('version compare') || normalizedTitle.includes('版本比较')) {
    return [
      item('Home', 'H'),
      item('All', '*'),
      item('Diffs', '!='),
      item('Same', '='),
      item('Minor', '~'),
      item('Rules', 'R'),
      item('Next Diff', 'N'),
      item('Prev Diff', 'P'),
      item('Swap', '<>'),
      item('Reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('text edit') || normalizedTitle.includes('文本编辑')) {
    return [
      item('Home', 'H'),
      item('Undo', 'U'),
      item('Redo', 'R'),
      item('Cut', 'X'),
      item('Copy', 'C'),
      item('Paste', 'P'),
      item('Delete', 'D'),
      item('Syntax', 'S'),
    ]
  }

  if (normalizedTitle.includes('text patch') || normalizedTitle.includes('文本补丁')) {
    return [item('Home', 'H'), item('Next Section', 'N'), item('Prev Section', 'P')]
  }

  return []
}
</script>

<template>
  <section class="workbench-shell">
    <header class="workbench-titlebar">
      <div class="workbench-titlecopy">
        <span
          v-if="eyebrow"
          class="workbench-eyebrow"
          >{{ eyebrow }}</span
        >
        <h1>{{ title }}</h1>
        <span
          v-if="subtitle"
          class="workbench-subtitle"
          >{{ subtitle }}</span
        >
      </div>
      <div class="workbench-title-actions">
        <slot name="title-actions" />
      </div>
    </header>

    <div class="workbench-toolbar-stack">
      <section
        v-if="toolbarItems.length > 0"
        class="bc-session-toolbar"
      >
        <button
          v-for="toolbarItem in toolbarItems"
          :key="`${toolbarItem.label}-${toolbarItem.glyph}`"
          type="button"
          class="bc-toolbar-command"
        >
          <span class="bc-toolbar-glyph">{{ toolbarItem.glyph }}</span>
          <span>{{ toolbarItem.label }}</span>
        </button>
      </section>
      <slot name="toolbar" />
    </div>

    <div class="workbench-grid">
      <main class="workbench-main">
        <slot />
      </main>
      <aside
        class="workbench-inspector"
        :aria-label="resolvedInspectorLabel"
      >
        <slot name="inspector" />
      </aside>
    </div>
  </section>
</template>
