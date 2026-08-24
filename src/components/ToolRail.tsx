import {
  ArrowRight, Brush, Circle, Eraser, Hand, Highlighter, MessageCircle, MousePointer2, Octagon, Pen,
  PenLine, RectangleHorizontal, Star, TextCursorInput, Triangle, StickyNote
} from "lucide-react";
import type { ToolDefinition } from "../models/ui";
import { useToolStore } from "../state/toolStore";
import { useUiStore } from "../state/uiStore";
import { useBoardStore } from "../state/boardStore";
import { IconButton } from "./IconButton";

const groups: Array<{ label: string; tools: ToolDefinition[] }> = [
  { label: "Select", tools: [{ id: "select", name: "Select", shortcut: "V", icon: MousePointer2 }] },
  { label: "Annotate", tools: [
    { id: "text", name: "Text", shortcut: "T", icon: TextCursorInput },
    { id: "comment", name: "Comment", icon: MessageCircle },
    { id: "sticky-note", name: "Sticky Note", shortcut: "N", icon: StickyNote }
  ] },
  { label: "Pan", tools: [{ id: "hand", name: "Pan", shortcut: "H", icon: Hand }] },
  { label: "Draw", tools: [
    { id: "pen", name: "Pen", shortcut: "P", icon: Pen },
    { id: "marker", name: "Marker", icon: PenLine },
    { id: "brush", name: "Brush", shortcut: "B", icon: Brush },
    { id: "highlighter", name: "Highlighter", icon: Highlighter },
    { id: "eraser", name: "Eraser", shortcut: "E", icon: Eraser }
  ] },
  { label: "Shapes", tools: [
    { id: "rectangle", name: "Rectangle", shortcut: "R", icon: RectangleHorizontal },
    { id: "ellipse", name: "Ellipse", icon: Circle },
    { id: "triangle", name: "Triangle", icon: Triangle },
    { id: "star", name: "Star", icon: Star },
    { id: "arrow", name: "Arrow", icon: ArrowRight },
    { id: "badge", name: "Badge", icon: Octagon }
  ] }
];

export function ToolRail() {
  const activeTool = useToolStore((state) => state.activeTool);
  const setActiveTool = useToolStore((state) => state.setActiveTool);
  const startTyping = useUiStore((state) => state.startTyping);
  const clearSelection = useBoardStore((state) => state.select);

  return (
    <aside className="tool-rail" aria-label="Whiteboard tools">
      {groups.map((group) => (
        <section className="tool-group" key={group.label}>
          <span className="tool-group-label">{group.label}</span>
          {group.tools.map((tool) => (
            <IconButton
              key={tool.id}
              icon={tool.icon}
              label={tool.name}
              active={activeTool === tool.id}
              onClick={() => {
                if (tool.id !== "select") {
                  clearSelection(null);
                }
                setActiveTool(tool.id);
                if (tool.id === "text" || tool.id === "comment" || tool.id === "sticky-note") {
                  startTyping(tool.id === "text" ? "text" : tool.id === "comment" ? "comment" : "sticky");
                }
              }}
            />
          ))}
        </section>
      ))}
    </aside>
  );
}
