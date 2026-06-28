import type { AppCommand, CommandId, CommandPlacement } from './commandRegistry'

export interface CommandExecutionContext {
  navigate: (route: string) => void
  openTab: (tab: { route: string; title: string; dirty: boolean }) => void
  t: (key: string) => string
  toggleTheme: () => void
}

export function getCommandsForPlacement(
  commands: AppCommand[],
  placement: CommandPlacement,
): AppCommand[] {
  return commands.filter((command) => command.placements.includes(placement))
}

export function createCommandExecutor(
  commands: AppCommand[],
  context: CommandExecutionContext,
): (commandId: CommandId) => boolean {
  return (commandId) => {
    const command = commands.find((item) => item.id === commandId)

    if (!command?.enabled) {
      return false
    }

    if (command.action.type === 'navigate') {
      context.openTab({
        route: command.action.route,
        title: context.t(command.action.titleKey),
        dirty: false,
      })
      context.navigate(command.action.route)

      return true
    }

    if (command.action.type === 'toggle-theme') {
      context.toggleTheme()

      return true
    }

    return false
  }
}
