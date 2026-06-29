---
name: OpenDiff UI
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#424754'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#585f6c'
  on-secondary: '#ffffff'
  secondary-container: '#dce2f3'
  on-secondary-container: '#5e6572'
  tertiary: '#924700'
  on-tertiary: '#ffffff'
  tertiary-container: '#b75b00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#dce2f3'
  secondary-fixed-dim: '#c0c7d6'
  on-secondary-fixed: '#151c27'
  on-secondary-fixed-variant: '#404754'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  ui-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  ui-base:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  ui-medium:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.05em
  code-base:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 20px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  header-section:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  xs: 0.125rem
  sm: 0.25rem
  md: 0.5rem
  lg: 0.75rem
  xl: 1rem
  toolbar_height: 32px
  tab_height: 28px
  sidebar_width: 240px
---

## Brand & Style

The design system is engineered for maximum utility, precision, and technical clarity. It targets developers, data engineers, and system administrators who require a high-density interface for complex file comparison and merging tasks.

The aesthetic is **Modern Enterprise**, prioritizing information hierarchy over decorative elements. It utilizes a restrained, professional chrome that recedes into the background, allowing the user's data and code to remain the primary focus. The emotional response is one of reliability, stability, and surgical accuracy. There are no gradients, rounded corners are minimal, and whitespace is used strictly for functional grouping rather than aesthetic breathing room.

## Colors

The palette is optimized for long-duration focus and clear state differentiation.

- **Chrome & Surface:** We use a "Gray Chrome" approach. The application shell and inactive panels use `#F3F4F6`, while active editing canvases use pure `#FFFFFF` for maximum text contrast.
- **Selection & Focus:** A vibrant Blue (`#3B82F6`) is reserved strictly for active selection states, primary actions, and focus indicators.
- **Comparison Semantics:** The system uses a specific four-color logic for diffing:
  - **Yellow (Modified):** Indicates a change within a line or block.
  - **Green (Added):** Indicates new content.
  - **Red (Deleted):** Indicates removed content.
  - **Purple (Conflict):** Indicates a merge collision requiring manual resolution.
- **Text Contrast:** For semantic backgrounds, matching dark-tinted text colors are provided to ensure WCAG AA accessibility in high-density environments.

## Typography

This design system employs a dual-font strategy optimized for high-density information display.

- **Inter:** Used for all UI chrome, menus, labels, and dialogs. We favor smaller-than-average font sizes (11px–13px) to maximize the visible data on a standard 1080p or 4K monitor.
- **JetBrains Mono:** Utilized for all comparison views, hex editors, and code blocks. Its balanced x-height and distinct character shapes reduce cognitive load during long sessions of code review.
- **Bilingual Support:** For Simplified Chinese, the system defaults to the system’s high-quality sans-serif (e.g., PingFang SC or Microsoft YaHei) while maintaining the 13px base size to ensure legibility of complex glyphs.
- **Density:** Line heights are kept tight (1.2x to 1.5x) to accommodate more lines of code and table rows.

## Layout & Spacing

The layout model is a **Structured Multi-Pane Grid**. It is designed for complex split-screen interactions where users compare two or three files side-by-side.

- **Split Panes:** The core of the design system. Vertical splitters allow users to resize comparison windows. Gutters between panes are kept to a minimal 1px border with a 16px "scroll-sync" indicator area.
- **Toolbars:** Fixed height at 32px to house 16px icons and small labels.
- **Tab System:** Horizontal tabs have a fixed height of 28px, using a "folder-ear" style for clear separation.
- **Density:** We use a 4px base unit. Most internal padding for buttons and inputs is 4px (vertical) and 8px (horizontal).
- **Responsive Behavior:** This is a desktop-first system. On smaller windows, sidebars collapse into icon-only rails, and panes stack horizontally if vertical space is insufficient.

## Elevation & Depth

To maintain the precision required for a merge tool, the design system avoids ambient shadows which can blur the boundaries between distinct data sets.

- **Tonal Layering:** Depth is communicated through surface color. The background "shell" is darker (`#F3F4F6`), while active workspaces are lighter (`#FFFFFF`).
- **Low-Contrast Outlines:** 1px solid borders in `#E5E7EB` are the primary method for defining containers.
- **Active States:** An active pane is indicated by a 2px primary blue border on its top edge or a subtle shift in the header's background color.
- **Overlays:** Only context menus and tooltips use shadows. These shadows are "Technical Shadows"—small (4px blur), high-opacity (20%), and neutral (no color tint).

## Shapes

The design system uses a **Soft** shape language (`0.25rem` or 4px).

This subtle rounding provides a modern feel without sacrificing the "industrial" character of a professional tool.

- **Buttons and Inputs:** 4px radius.
- **Panels and Main Windows:** 0px (sharp) to ensure they sit flush against the screen edges and each other.
- **Selection Highlights:** 2px radius or sharp edges to ensure no gaps appear when multiple lines are selected in the diff view.

## Components

- **Buttons:** Small (24px height) and Medium (32px). Secondary buttons use a subtle gray outline. Primary buttons use the Blue selection color.
- **Diff Gutter:** A specialized component to the left of the code view containing line numbers and change indicators (+, -, ~).
- **Toolbar Icons:** 16x16px monochrome icons. Active icons use the primary blue; destructive actions (e.g., "Delete Conflict") use red.
- **Tab Bar:** Tabs fill the width of the pane. Inactive tabs have a slight gray fill; the active tab is white and fused to the content area.
- **Inspector Panels:** Right-aligned collapsible panels for file metadata and merge history. Use a condensed Inter 11px font.
- **Status Bar:** A 24px dark-gray bar at the bottom for line/column indicators, encoding types (UTF-8), and language detection.
- **Input Fields:** Flat appearance with a 1px border. On focus, the border changes to Blue with no outer glow.
- **Tree View (Sidebar):** High-density list with 20px row heights. Use Chevron-right/down for folder expansion.
