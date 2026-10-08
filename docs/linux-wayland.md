# Linux Wayland notes

OpenDiff on Linux uses WebKitGTK (Tauri). On some **Wayland** sessions (notably KDE Plasma), first-run chrome has looked wrong: crushed sidebar rows, tiny icons, clipped menus ([#624](https://github.com/kygo8/open-diff/issues/624)).

## What the app does

On startup, if the session looks like Wayland and you have **not** already set `GDK_BACKEND`, OpenDiff sets:

```bash
GDK_BACKEND=x11
```

so the window runs under **XWayland**. That avoids several WebKitGTK Wayland layout/compositing failures without requiring users to export env vars by hand.

On NVIDIA + Wayland, if unset, it may also set `__NV_DISABLE_EXPLICIT_SYNC=1` (keeps acceleration; see Tauri Linux graphics notes).

## Opt out (native Wayland)

```bash
OPEN_DIFF_ALLOW_WAYLAND=1 open-diff-app
# or
GDK_BACKEND=wayland open-diff-app
```

Manual `WEBKIT_DISABLE_DMABUF_RENDERER=1` / `WEBKIT_DISABLE_COMPOSITING_MODE=1` alone did **not** fix #624 for the reporter; prefer the XWayland path above unless you are debugging NVIDIA blank windows.

## Residual

We cannot fully certify every Plasma/GPU combination in CI. If chrome is still wrong on a current build with the default XWayland path, please reopen or comment on #624 with GPU, Plasma version, and whether `OPEN_DIFF_ALLOW_WAYLAND=1` changes anything.
