# Changelog

## Version 0.1.0

- Development started: **2026-07-26**
- Initial application build completed: **2026-07-26**
- Latest improvement cycle started: **2026-07-27**
- Latest recorded work completed: **2026-07-27**
- Changelog last updated: **2026-07-27**

## 2026-07-27 — Interaction, input, and editing improvements

**Started:** 2026-07-27
**Completed:** 2026-07-27

### Added and fixed

- Corrected packaged `file://` asset paths that caused installed builds to open on a grey screen, added production-asset verification to prevent recurrence, and added explicit splash and interface load diagnostics
- Loaded all installed system and per-user font families into the Text, Comment, and Sticky Note font selector through a sanitized, read-only Electron bridge, with refresh feedback and standard-font fallback behavior
- Added a centered Dev Build badge beside the application title, sourced from the centralized application build number
- Repaired Draw properties so Pen, Brush, Marker, and Highlighter keep independent working color, tip-size, opacity, and smoothing settings; added a sized drag eraser with visible canvas feedback
- Moved Pan, middle-button pan, and right-button pan movement to window-level pointer tracking so canvas navigation remains responsive throughout the drag
- Added Windows Pointer Events stylus support for Wacom-compatible tablets, including pressure-sensitive Pen, Brush, and Marker strokes, coalesced high-frequency samples, eraser-end input, barrel-button panning, palm rejection, saved pressure data, and matching exported output
- Made Text, Comment, and Sticky Note return to Select after Done or Cancel, keep the completed object selected for immediate movement, continuously synchronize object position while dragging, and stop refocusing the editor on every keystroke so caret placement and typing remain reliable
- Added sticky-note color presets and a full custom color picker to the floating typing toolbar, with per-note saved colors, live editing preview, restored colors on later edits, and automatic light or dark text contrast
- Added visible corner and edge resize handles with directional cursors to selected canvas objects and floating documents, including eight-way document resizing, minimum-size protection, rotation control, and undoable resize transactions
- Added a dedicated blue corner move lip to Text, Comment, and Sticky Note objects on selection or hover, plus a draggable lip on the active typing editor, so movement has an explicit hit target separate from typing and resizing

## 2026-07-26 — Initial application build and primary feature pass

**Started:** 2026-07-26
**Completed:** 2026-07-26

### Added

- Tauri 2, React, TypeScript, and Vite project foundation
- Responsive dark creative-workstation shell
- Main menu, toolbar, tool rail, contextual properties, sidebar, status bar, and minimap placeholder
- Separate Zustand stores for project, camera, tools, selection, and UI state
- Strict TypeScript, ESLint, Vitest, and Testing Library configuration
- Initial architecture, project-format, and development documentation

### Changed

- Completed a full confirmed-bug repair pass across project validation, recovery, resolution handling, canvas tools, locking, undo history, minimap navigation, PDF paging, menus, accessibility, and native configuration
- Replaced viewport-only export with a bounded complete-board renderer that includes images, text, strokes, notes, shapes, and floating PDF previews while enforcing safe 8K and 64-megapixel limits
- Separated application-window resolution from export scaling so high-resolution window presets no longer multiply export dimensions
- Added seasonal local sunrise/sunset behavior for Auto appearance and expanded regression coverage from 25 to 34 tests
- Restored a functional Shapes group with Rectangle, Ellipse, Triangle, Star, Arrow, and Badge tools plus separate stroke, fill, opacity, and size controls
- Made shape tools return to Select after completing one shape so later canvas clicks do not continue creating shapes
- Moved shape completion to a window-level pointer release handler so drafts cannot remain attached to the cursor when release occurs outside the canvas
- Added pointer-identity tracking and window-capture movement for shape drags so drawing continues and completes reliably across canvas boundaries
- Made placed shapes remain selected and exposed their actual stroke, fill, opacity, and size values for immediate move, resize, rotate, and property editing
- Reworked the application shell to follow the supplied Creative Whiteboard UI reference
- Added the compact title strip, unified command bar, categorized tool rail, floating pen palette, document preview cards, sample board composition, and floating minimap layout
- Switched the active desktop development runtime to Electron
- Added secure frameless-window controls and Windows installer configuration
- Made the Electron development launcher select an available Vite port and clean up its child processes automatically
- Applied `app_icon.png` to the Electron window, packaged executable, installer, uninstaller, and Windows shortcuts
- Replaced the static reference-board mockup with a real infinite React-Konva canvas
- Added drawing, shapes, arrows, text editing, selection transforms, marquee selection, erasing, history, and clipboard actions
- Added project open/save, drag-and-drop importing, floating PDF windows, recovery state, minimap navigation, settings, notifications, and high-resolution PNG/JPEG/PDF export
- Added retractable command and export menus, working 1080p/4K/8K resolution selection, and dismiss-on-click behavior
- Added independent Pen, Brush, Highlighter, and Marker tip profiles with working color, size, opacity, fill, and smooth-ink controls
- Corrected Badge and Comment tool mappings and removed the unused bottom tool-rail expander
- Made every Settings option bidirectional and persistent: grid visibility, minimap visibility, and full-interface scaling
- Reordered the tool rail into Pan, Draw, Shapes, Annotate, and Select workflow groups with clear visual separators
- Regenerated the multi-resolution Windows icon from the latest `app_icon.png` artwork
- Rebuilt the zoom and resolution toolbar controls to remove duplicate buttons and chevrons and provide functional preset dropdowns
- Expanded export presets from Full HD through 8K, moved Select and Annotate to the top, added inline canvas text editing and editable comment notes, and replaced the unreliable grid layer with a visible pan-and-zoom-aware background grid
- Made Text and Comment buttons immediately open and focus their respective canvas typing editors
- Removed the Shapes tool group and made text and comment editors persistent with explicit Done and Cancel controls so Electron cannot dismiss typing on focus changes
- Moved resolution presets into Settings and added confirmed, centered Electron window resizing with safe display fitting and success feedback
- Added an explicit resolution Apply action and target-display detection so persisted presets can be reapplied after launch on the monitor containing the app
- Changed resolution application to force exact Electron window bounds without fitting to the monitor work area
- Limited forced resolution changes to the active monitor's native size, retained failure feedback for oversized presets, and accounted for Windows DPI scaling
- Replaced transient Text and Comment browser events with shared application typing state and layout-time focus enforcement for reliable Electron keyboard input
- Replaced the oversized properties collapse control with a slim attached edge tab using `>` to open and `<` to retract
- Added hold-and-drag middle-mouse panning regardless of the currently selected tool
- Moved the functional Import file-browser action beside Export and replaced the disconnected icon-only placement
- Increased grid contrast and added hold-and-drag right-click panning alongside middle-mouse panning
- Routed Pan-tool left-click dragging through the same reliable manual panning engine as middle- and right-button dragging
- Stabilized imported document dragging with pointer capture, live camera-coordinate anchoring, preview shielding, and isolated document controls
- Removed the decorative macOS traffic-light circles and recentered the title for the Windows-only title bar
- Added a native unsaved-changes close guard with Save, Don’t Save, and Cancel behavior for the title-bar close button and operating-system close requests
- Corrected recovery lifecycle so successful saves and intentional Don’t Save exits clear recovery data, reserving the recovery prompt for interrupted unsaved sessions
- Added a real white canvas background layer so saved PNG, JPEG, and PDF output no longer renders transparent areas as black
- Added a persistent Dark, Light, and System appearance setting with a complete light-theme counterpart
- Dark mode now themes the board itself with a charcoal surface and muted-white grid; Auto appearance follows local daylight and sundown
- Removed the obsolete Fill Shapes option and corrected Smooth Ink so its switch state and selected-stroke smoothing both update properly
- Added movable, resizable, editable Sticky Notes for reminders, with a dedicated annotation tool and keyboard shortcut
- Ensured the title-bar Close button always displays a red hover state in every appearance mode
- Replaced About and packaged creator/publisher placeholders with the supplied Kenneth Salmon and Majestic Creations legal-package information
- Added a live floating typography palette for Text, Comment, and Sticky Note editing with font, size, bold, italic, and underline controls
- Scoped typography formatting exclusively to typed content so editor controls never inherit bold, italic, underline, font, or size changes
- Added a sandboxed animated startup splash using the supplied splash artwork, live progress, status transitions, ambient motion, and a fade into the workspace
- Added Windowed, Full Screen Windowed, and Borderless modes; the app now starts full-screen windowed and waits for the splash loader to reach 100% before showing
- Expanded the animated splash to the full active display and clarified the persistent Viewing mode setting
- Replaced Settings native dropdowns with reliable click-selectable controls and forced the splash to the active monitor bounds before fullscreen display
- Rebuilt the splash as an original animated interface using app_icon.png; the supplied splash image is now reference-only and is no longer displayed or packaged
