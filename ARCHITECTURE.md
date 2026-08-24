# Architecture

## Application structure

The React entry point delegates to `app/WorkspaceShell`. Presentation is divided into focused components. Domain types live in `models`, state stores in `state`, canvas features in `canvas`, and later feature modules will live in `features`, `tools`, `documents`, and `services`.

Electron is the active desktop runtime. Its isolated main process and preload bridge live in `electron/`. The renderer has no direct Node.js access; approved native operations are exposed through the context-isolated preload API. The earlier Tauri prototype remains in `src-tauri/` but is not required by the active development workflow.

## Canvas architecture

`InfiniteCanvas` uses a React-Konva stage with world-space objects independent of the camera. It supports 5%–3200% zoom, pointer-centered wheel zoom, dynamic visible grid generation, panning, transforms, viewport-independent high-resolution export, and a data-driven minimap.

## State management

Zustand stores are separated by responsibility across project metadata, camera, active tool, board objects and transaction history, shell preferences, and notifications.

## Tool architecture

Tool definitions are typed and selected independently of canvas rendering. Pointer behavior commits completed strokes and shapes as single history transactions rather than storing every movement.

## Saving and document rendering

Filesystem access is isolated in services and exposed through narrowly scoped Electron IPC handlers. `.cwb` saving uses temporary-file replacement. Imported assets are embedded into project data, and floating PDFs are rendered by Chromium's isolated document viewer.
