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
