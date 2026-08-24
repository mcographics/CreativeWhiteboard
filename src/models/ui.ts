import type { LucideIcon } from "lucide-react";

export type ToolId =
  | "select" | "hand" | "pen" | "brush" | "highlighter" | "marker" | "eraser"
  | "badge" | "comment" | "triangle" | "star"
  | "text" | "underline" | "line" | "arrow" | "rectangle" | "ellipse"
  | "shapes" | "sticky-note" | "import-image" | "import-document";

export interface ToolDefinition {
  id: ToolId;
  name: string;
  shortcut?: string;
  icon: LucideIcon;
}

export type SidebarPanelId =
  | "layers" | "properties" | "imported-files" | "document-pages" | "search";
