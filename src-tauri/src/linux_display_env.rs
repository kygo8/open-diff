//! Linux display / WebKitGTK environment workarounds applied before GTK init.
//!
//! Plasma Wayland + WebKitGTK has produced garbled first-run chrome (crushed
//! sidebar rows, tiny icons, clipped menus) for OpenDiff (#624). Prefer
//! XWayland (`GDK_BACKEND=x11`) when the session is Wayland and the user has
//! not already chosen a GDK backend. Opt out with `GDK_BACKEND=wayland` or
//! `OPEN_DIFF_ALLOW_WAYLAND=1`.

#![cfg(target_os = "linux")]

use std::path::Path;

/// Returns true when the process is running under a Wayland session.
pub fn is_wayland_session(xdg_session_type: Option<&str>, wayland_display: Option<&str>) -> bool {
    if xdg_session_type.is_some_and(|value| value.eq_ignore_ascii_case("wayland")) {
        return true;
    }

    wayland_display.is_some_and(|value| !value.is_empty())
}

/// Whether we should force GDK onto X11 (XWayland) for WebKitGTK reliability.
pub fn should_force_gdk_x11(
    allow_wayland: bool,
    gdk_backend_already_set: bool,
    wayland: bool,
) -> bool {
    !allow_wayland && !gdk_backend_already_set && wayland
}

/// Detect proprietary NVIDIA as primary renderer via sysfs (best-effort).
pub fn is_nvidia_drm_present(drm_cards_dir: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(drm_cards_dir) else {
        return false;
    };

    for entry in entries.flatten() {
        let vendor = entry.path().join("device").join("vendor");
        if let Ok(raw) = std::fs::read_to_string(vendor) {
            // NVIDIA PCI vendor id
            if raw.trim().eq_ignore_ascii_case("0x10de") {
                return true;
            }
        }
    }

    false
}

/// Apply Linux WebKitGTK / Wayland workarounds. Safe to call once at process start.
pub fn apply_linux_display_env() {
    let allow_wayland = std::env::var_os("OPEN_DIFF_ALLOW_WAYLAND")
        .is_some_and(|value| value != "0" && !value.is_empty());
    let gdk_set = std::env::var_os("GDK_BACKEND").is_some();
    let wayland = is_wayland_session(
        std::env::var("XDG_SESSION_TYPE").ok().as_deref(),
        std::env::var("WAYLAND_DISPLAY").ok().as_deref(),
    );

    if should_force_gdk_x11(allow_wayland, gdk_set, wayland) {
        // Prefer XWayland for WebKitGTK chrome stability on Plasma Wayland (#624).
        // Users who need native Wayland can set OPEN_DIFF_ALLOW_WAYLAND=1 or GDK_BACKEND=wayland.
        std::env::set_var("GDK_BACKEND", "x11");
        eprintln!(
            "[OpenDiff] Wayland session detected; using GDK_BACKEND=x11 (XWayland) for WebKitGTK stability. Set OPEN_DIFF_ALLOW_WAYLAND=1 to keep native Wayland."
        );
    }

    // NVIDIA + Wayland: avoid Error 71 without disabling DMABUF for everyone.
    if wayland
        && std::env::var_os("__NV_DISABLE_EXPLICIT_SYNC").is_none()
        && is_nvidia_drm_present(Path::new("/sys/class/drm"))
    {
        std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
    }
}

#[cfg(test)]
mod tests {
    use super::{is_wayland_session, should_force_gdk_x11};

    #[test]
    fn detects_wayland_from_session_type() {
        assert!(is_wayland_session(Some("wayland"), None));
        assert!(is_wayland_session(Some("Wayland"), Some("wayland-0")));
        assert!(!is_wayland_session(Some("x11"), None));
        assert!(!is_wayland_session(None, None));
        assert!(is_wayland_session(None, Some("wayland-1")));
    }

    #[test]
    fn forces_x11_only_when_wayland_and_unset() {
        assert!(should_force_gdk_x11(false, false, true));
        assert!(!should_force_gdk_x11(true, false, true));
        assert!(!should_force_gdk_x11(false, true, true));
        assert!(!should_force_gdk_x11(false, false, false));
    }
}
