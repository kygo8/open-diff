/** Tasteful compare-complete beep / notification for desktop webview Tweaks. */

export function playCompareCompleteBeep(): void {
  try {
    const ctx = new window.AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.value = 0.04
    oscillator.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime

    oscillator.start(now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    oscillator.stop(now + 0.2)
    window.setTimeout(() => {
      void ctx.close()
    }, 300)
  } catch {
    // Web Audio may be blocked; fall through to Notification when allowed.
  }
}

export async function notifyCompareComplete(
  enabled: boolean,
  title: string,
  body: string,
): Promise<void> {
  if (!enabled) {
    return
  }

  playCompareCompleteBeep()

  try {
    if (typeof Notification === 'undefined') {
      return
    }

    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }

    if (Notification.permission === 'granted') {
      new Notification(title, { body, silent: true })
    }
  } catch {
    // Notification API optional in webview.
  }
}
