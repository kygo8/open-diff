<script setup lang="ts">
import { computed, inject, type ComputedRef } from 'vue'
import { useI18n } from '@/i18n'
import type { SessionToolbarCommand } from '@/app/sessionToolbars'
import { visualForSessionToolbarCommand } from '@/app/sessionToolbarIcons'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  title: string
  eyebrow?: string
  subtitle?: string
  inspectorLabel?: string
  toolbarCommands?: SessionToolbarCommand[]
  toolbarTestIdPrefix?: string
  /** Home-style frame: no titlebar/toolbar chrome; inspector stays offscreen for tests. */
  compact?: boolean
}>()
const emit = defineEmits<{
  'toolbar-command': [id: string]
}>()
const { t } = useI18n()
const settings = useSettingsStore()

interface ShellChromeInjection {
  showTabStrip?: ComputedRef<boolean>
  singleSessionFrame?: ComputedRef<boolean>
}

const injectedShellChrome = inject<ShellChromeInjection | null>('shellChrome', null)
const preferSingleSessionFrame = computed(() => {
  const frame = injectedShellChrome?.singleSessionFrame

  return frame ? frame.value : false
})
const resolvedInspectorLabel = computed(() => props.inspectorLabel ?? t('ui.inspector'))
const toolbarItems = computed(() => {
  const commands =
    props.toolbarCommands ??
    toolbarForTitle(props.title).map((item): SessionToolbarCommand => ({
      id: item.id,
      glyph: item.glyph,
      labelKey: item.labelKey,
      enabled: false,
      active: false,
    }))

  return commands
    .filter((command) => {
      if (command.id === 'next-diff') {
        return settings.showNextDifferenceInToolbar
      }

      if (command.id === 'prev-diff') {
        return settings.showPrevDifferenceInToolbar
      }

      if (command.id === 'sessions') {
        return settings.showSessionsInToolbar
      }

      if (command.id === 'goto') {
        return settings.showGotoInToolbar
      }

      if (command.id === 'wrap') {
        return settings.showWrapInToolbar
      }

      if (command.id === 'sync-now') {
        return settings.showSyncNowInToolbar
      }

      if (command.id === 'cancel' || command.id === 'accept') {
        return settings.showSyncCancelAcceptInToolbar
      }

      return true
    })
    .map((command) => {
      const visual = visualForSessionToolbarCommand(command.id)

      return {
        ...command,
        visual,
        icon: visual?.kind === 'icon' ? visual.icon : undefined,
        plate: visual?.kind === 'plate' ? visual : undefined,
      }
    })
})
const showSessionToolbar = computed(
  () => !props.compact && settings.showSessionToolbars && toolbarItems.value.length > 0,
)
const testIdPrefix = computed(() => props.toolbarTestIdPrefix ?? 'session-toolbar')

interface LegacyToolbarItem {
  id: string
  labelKey: string
  glyph: string
}

function item(id: string, labelKey: string, glyph: string): LegacyToolbarItem {
  return { id, labelKey, glyph }
}

function toolbarForTitle(title: string): LegacyToolbarItem[] {
  const normalizedTitle = title.toLowerCase()

  if (normalizedTitle.includes('folder merge') || normalizedTitle.includes('文件夹合并')) {
    return [
      item('home', 'ui.home', 'H'),
      item('all', 'ui.all', '*'),
      item('diffs', 'ui.diffs', '!='),
      item('same', 'ui.same', '='),
      item('structure', 'ui.structure', 'S'),
      item('minor', 'ui.minor', '~'),
      item('same-ok', 'ui.sameOk', 'OK'),
      item('rules', 'ui.rules', 'R'),
      item('sessions', 'ui.sessions', 'S'),
      item('merge', 'ui.merge', 'M'),
      item('to-output', 'ui.toOutput', 'O'),
      item('expand', 'ui.expand', '+'),
      item('collapse', 'ui.collapse', '-'),
      item('select', 'ui.select', 'V'),
      item('files', 'ui.files', 'F'),
      item('refresh', 'ui.refresh', 'R'),
      item('swap', 'ui.swap', '<>'),
      item('stop', 'ui.stop', 'X'),
      item('filters', 'ui.filters', 'F'),
      item('peek', 'ui.peek', 'P'),
    ]
  }

  if (normalizedTitle.includes('folder sync') || normalizedTitle.includes('文件夹同步')) {
    return [
      item('home', 'ui.home', 'H'),
      item('minor', 'ui.minor', '~'),
      item('expand', 'ui.expand', '+'),
      item('collapse', 'ui.collapse', '-'),
      item('select', 'ui.select', 'V'),
      item('refresh', 'ui.refresh', 'R'),
      item('stop', 'ui.stop', 'X'),
      item('peek', 'ui.peek', 'P'),
      item('sync-now', 'ui.syncNow', '>'),
      item('cancel', 'ui.cancel', 'X'),
      item('accept', 'ui.accept', 'OK'),
    ]
  }

  if (normalizedTitle.includes('folder compare') || normalizedTitle.includes('文件夹比较')) {
    return [
      item('home', 'ui.home', 'H'),
      item('all', 'ui.all', '*'),
      item('diffs', 'ui.diffs', '!='),
      item('same', 'ui.same', '='),
      item('structure', 'ui.structure', 'S'),
      item('minor', 'ui.minor', '~'),
      item('rules', 'ui.rules', 'R'),
      item('sessions', 'ui.sessions', 'S'),
      item('copy', 'ui.copy', 'C'),
      item('expand', 'ui.expand', '+'),
      item('collapse', 'ui.collapse', '-'),
      item('select', 'ui.select', 'V'),
      item('files', 'ui.files', 'F'),
      item('refresh', 'ui.refresh', 'R'),
      item('swap', 'ui.swap', '<>'),
      item('stop', 'ui.stop', 'X'),
      item('filters', 'ui.filters', 'F'),
      item('peek', 'ui.peek', 'P'),
    ]
  }

  if (normalizedTitle.includes('text merge') || normalizedTitle.includes('文本合并')) {
    return [
      item('home', 'ui.home', 'H'),
      item('all', 'ui.all', '*'),
      item('diffs', 'ui.diffs', '!='),
      item('same', 'ui.same', '='),
      item('context', 'ui.context', 'C'),
      item('minor', 'ui.minor', '~'),
      item('same-ok', 'ui.sameOk', 'OK'),
      item('favor-left', 'ui.favorLeft', '<'),
      item('favor-right', 'ui.favorRight', '>'),
      item('rules', 'ui.rules', 'R'),
      item('format', 'ui.format', 'F'),
      item('conflict', 'ui.conflict', '!'),
      item('left', 'ui.left', 'L'),
      item('center', 'ui.center', 'B'),
      item('right', 'ui.right', 'R'),
      item('next-conflict', 'ui.nextConflict', 'N'),
      item('prev-conflict', 'ui.previousConflict', 'P'),
      item('swap', 'ui.swap', '<>'),
      item('reload', 'ui.reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('text compare') || normalizedTitle.includes('文本比较')) {
    return [
      item('home', 'ui.home', 'H'),
      item('all', 'ui.all', '*'),
      item('diffs', 'ui.diffs', '!='),
      item('same', 'ui.same', '='),
      item('context', 'ui.context', 'C'),
      item('minor', 'ui.minor', '~'),
      item('rules', 'ui.rules', 'R'),
      item('format', 'ui.format', 'F'),
      item('sessions', 'ui.sessions', 'S'),
      item('goto', 'ui.goToLine', '#'),
      item('wrap', 'ui.wrap', 'W'),
      item('copy', 'ui.copy', 'C'),
      item('next-section', 'ui.nextSection', 'N'),
      item('prev-section', 'ui.prevSection', 'P'),
      item('swap', 'ui.swap', '<>'),
      item('reload', 'ui.reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('table compare') || normalizedTitle.includes('表格比较')) {
    return [
      item('home', 'ui.home', 'H'),
      item('all', 'ui.all', '*'),
      item('diffs', 'ui.diffs', '!='),
      item('same', 'ui.same', '='),
      item('minor', 'ui.minor', '~'),
      item('rules', 'ui.rules', 'R'),
      item('format', 'ui.format', 'F'),
      item('sessions', 'ui.sessions', 'S'),
      item('copy', 'ui.copy', 'C'),
      item('next-diff', 'ui.nextDiff', 'N'),
      item('prev-diff', 'ui.prevDiff', 'P'),
      item('swap', 'ui.swap', '<>'),
      item('reload', 'ui.reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('hex compare') || normalizedTitle.includes('十六进制比较')) {
    return [
      item('home', 'ui.home', 'H'),
      item('all', 'ui.all', '*'),
      item('diffs', 'ui.diffs', '!='),
      item('same', 'ui.same', '='),
      item('rules', 'ui.rules', 'R'),
      item('format', 'ui.format', 'F'),
      item('sessions', 'ui.sessions', 'S'),
      item('copy', 'ui.copy', 'C'),
      item('next-diff', 'ui.nextDiff', 'N'),
      item('prev-diff', 'ui.prevDiff', 'P'),
      item('swap', 'ui.swap', '<>'),
      item('reload', 'ui.reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('picture compare') || normalizedTitle.includes('图片比较')) {
    return [
      item('home', 'ui.home', 'H'),
      item('tol', 'ui.tol', 'T'),
      item('range', 'ui.range', 'G'),
      item('blend', 'ui.blend', 'B'),
      item('minor', 'ui.minor', '~'),
      item('rules', 'ui.rules', 'R'),
      item('format', 'ui.format', 'F'),
      item('sessions', 'ui.sessions', 'S'),
      item('swap', 'ui.swap', '<>'),
      item('reload', 'ui.reload', 'R'),
      item('meta', 'ui.meta', 'M'),
    ]
  }

  if (normalizedTitle.includes('registry compare') || normalizedTitle.includes('注册表比较')) {
    return [
      item('home', 'ui.home', 'H'),
      item('all', 'ui.all', '*'),
      item('diffs', 'ui.diffs', '!='),
      item('same', 'ui.same', '='),
      item('copy', 'ui.copy', 'C'),
      item('swap', 'ui.swap', '<>'),
      item('reload', 'ui.reload', 'R'),
      item('expand', 'ui.expand', '+'),
      item('collapse', 'ui.collapse', '-'),
    ]
  }

  if (normalizedTitle.includes('media compare') || normalizedTitle.includes('媒体比较')) {
    return [
      item('home', 'ui.home', 'H'),
      item('all', 'ui.all', '*'),
      item('diffs', 'ui.diffs', '!='),
      item('same', 'ui.same', '='),
      item('minor', 'ui.minor', '~'),
      item('rules', 'ui.rules', 'R'),
      item('swap', 'ui.swap', '<>'),
      item('reload', 'ui.reload', 'R'),
      item('play2', 'ui.play2', 'P2'),
    ]
  }

  if (normalizedTitle.includes('version compare') || normalizedTitle.includes('版本比较')) {
    return [
      item('home', 'ui.home', 'H'),
      item('all', 'ui.all', '*'),
      item('diffs', 'ui.diffs', '!='),
      item('same', 'ui.same', '='),
      item('minor', 'ui.minor', '~'),
      item('rules', 'ui.rules', 'R'),
      item('swap', 'ui.swap', '<>'),
      item('reload', 'ui.reload', 'R'),
    ]
  }

  if (normalizedTitle.includes('text edit') || normalizedTitle.includes('文本编辑')) {
    return [
      item('home', 'ui.home', 'H'),
      item('undo', 'ui.undo', 'U'),
      item('redo', 'ui.redo', 'R'),
      item('cut', 'ui.cut', 'X'),
      item('copy', 'ui.copy', 'C'),
      item('paste', 'ui.paste', 'P'),
      item('delete', 'ui.delete', 'D'),
      item('syntax', 'ui.syntax', 'S'),
    ]
  }

  if (normalizedTitle.includes('text patch') || normalizedTitle.includes('文本补丁')) {
    return [
      item('home', 'ui.home', 'H'),
      item('next-section', 'ui.nextSection', 'N'),
      item('prev-section', 'ui.prevSection', 'P'),
    ]
  }

  return []
}

function onToolbarCommand(command: SessionToolbarCommand): void {
  if (!command.enabled) {
    return
  }

  emit('toolbar-command', command.id)
}
</script>

<template>
  <section
    class="workbench-shell"
    :class="{
      'workbench-shell-compact': compact,
      'workbench-shell-single-session': preferSingleSessionFrame && !compact,
    }"
    :data-compact="compact ? 'true' : 'false'"
    :data-single-session-frame="preferSingleSessionFrame && !compact ? 'true' : 'false'"
  >
    <header
      v-if="!compact && !preferSingleSessionFrame"
      class="workbench-titlebar"
    >
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

    <div
      v-if="!compact"
      class="workbench-toolbar-stack"
    >
      <section
        v-if="showSessionToolbar"
        class="bc-session-toolbar"
        :class="{
          'bc-session-toolbar-glyphs-only': !settings.showToolbarLabels,
          'bc-session-toolbar-compact': !settings.largeToolbarButtons,
        }"
        :data-testid="`${testIdPrefix}-bar`"
        :data-large-buttons="settings.largeToolbarButtons ? 'true' : 'false'"
      >
        <button
          v-for="toolbarItem in toolbarItems"
          :key="toolbarItem.id"
          type="button"
          class="bc-toolbar-command"
          :class="{ 'bc-toolbar-command-active': toolbarItem.active }"
          :disabled="!toolbarItem.enabled"
          :aria-label="t(toolbarItem.labelKey)"
          :aria-pressed="toolbarItem.active ? 'true' : 'false'"
          :data-testid="`${testIdPrefix}-${toolbarItem.id}`"
          :data-active="toolbarItem.active ? 'true' : 'false'"
          :data-has-icon="toolbarItem.visual && settings.showToolbarIcons ? 'true' : 'false'"
          :data-has-plate="toolbarItem.plate && settings.showToolbarIcons ? 'true' : 'false'"
          :title="t(toolbarItem.labelKey)"
          @click="onToolbarCommand(toolbarItem)"
        >
          <span
            v-if="toolbarItem.plate && settings.showToolbarIcons"
            class="bc-toolbar-plate"
            :data-plate="toolbarItem.plate.plate"
            aria-hidden="true"
            >{{ toolbarItem.plate.symbol }}</span
          >
          <component
            :is="toolbarItem.icon"
            v-else-if="toolbarItem.icon && settings.showToolbarIcons"
            class="bc-toolbar-icon"
            aria-hidden="true"
            :size="settings.largeToolbarButtons ? 22 : 18"
            :stroke-width="2.25"
            absolute-stroke-width
          />
          <span
            v-else
            class="bc-toolbar-glyph"
            aria-hidden="true"
            >{{ toolbarItem.glyph }}</span
          >
          <span v-if="settings.showToolbarLabels">{{ t(toolbarItem.labelKey) }}</span>
        </button>
      </section>
      <slot name="toolbar" />
    </div>

    <div
      class="workbench-grid"
      :class="{ 'workbench-grid-compact': compact }"
    >
      <main class="workbench-main">
        <slot />
      </main>
      <aside
        class="workbench-inspector"
        :class="{ 'workbench-inspector-compact-host': compact }"
        :aria-label="resolvedInspectorLabel"
      >
        <slot name="inspector" />
      </aside>
    </div>
  </section>
</template>
