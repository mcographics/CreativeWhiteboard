import { ChevronDown, ChevronRight, Files, Layers3, ListTree, Search, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SidebarPanelId } from "../models/ui";
import { useUiStore } from "../state/uiStore";

const panels: Array<{ id: SidebarPanelId; label: string; icon: LucideIcon }> = [
  { id: "layers", label: "Layers", icon: Layers3 },
  { id: "properties", label: "Properties", icon: SlidersHorizontal },
  { id: "imported-files", label: "Imported files", icon: Files },
  { id: "document-pages", label: "Document pages", icon: ListTree },
  { id: "search", label: "Search", icon: Search }
];

export function RightSidebar() {
  const expanded = useUiStore((state) => state.expandedPanels);
  const togglePanel = useUiStore((state) => state.togglePanel);

  return (
    <aside className="right-sidebar" aria-label="Workspace sidebar">
      {panels.map(({ id, label, icon: Icon }) => {
        const isOpen = expanded.includes(id);
        return (
          <section className="sidebar-section" key={id}>
            <button type="button" onClick={() => togglePanel(id)} aria-expanded={isOpen}>
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <Icon size={16} />
              <span>{label}</span>
            </button>
            {isOpen && (
              <div className="sidebar-content">
                {id === "layers" ? <div className="layer-row"><span className="layer-dot" />Default layer</div> : `No ${label.toLowerCase()} yet`}
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );
}
