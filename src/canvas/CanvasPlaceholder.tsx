import type { ReactNode } from "react";
import { FileText, Lightbulb, Minus, Plus, Search, X } from "lucide-react";
import { useCameraStore } from "../state/cameraStore";
import { useUiStore } from "../state/uiStore";

export function CanvasPlaceholder() {
  const minimapOpen = useUiStore((state) => state.minimapOpen);
  const zoom = useCameraStore((state) => state.zoom);
  const zoomIn = useCameraStore((state) => state.zoomIn);
  const zoomOut = useCameraStore((state) => state.zoomOut);

  return (
    <section className="canvas-region" aria-label="Infinite whiteboard canvas">
      <div className="canvas-grid" />
      <div className="board-content" aria-hidden="true">
        <section className="project-plan">
          <h2>PROJECT PLAN</h2>
          <ul><li>Research <b>☑</b></li><li>Brainstorm <b>☑</b></li><li>Concept <b>☑</b></li><li className="blue">Design</li><li>Execution</li><li>Review</li></ul>
          <p>Focus on<br />user flow<br />and visual<br />hierarchy.</p><div className="green-arrow">⤷</div>
        </section>
        <section className="ideas-map">
          <span className="idea vision">Vision</span><span className="idea inspiration">Inspiration</span>
          <span className="idea collaboration">Collaboration</span><span className="idea innovation">Innovation</span>
          <span className="idea growth">Growth</span><span className="idea strategy">Strategy</span>
          <div className="idea-cloud">IDEAS</div>
        </section>
        <section className="ui-sketch"><h3>UI/UX SKETCH</h3><div className="wireframe"><span /><span /><span /><b /></div><ul><li>□ Clean layout</li><li>□ Easy navigation</li><li>□ Quick access</li><li>□ Dark mode support</li></ul></section>
        <section className="sticky"><h3>REMEMBER</h3><p>• Save frequently<br />• Export final<br />• Share with team</p></section>
        <section className="mindmap"><h3>MIND MAP</h3><div><b>SUCCESS</b><span>Learn</span><span>Plan</span><span>Adapt</span><span>Work</span><span>Create</span><span>Focus</span><span>Persist</span></div></section>
        <blockquote>“Creativity is<br />intelligence<br />having fun.”<cite>– Albert Einstein</cite></blockquote>
        <section className="pie-chart"><div className="pie" /><ul><li>Planning</li><li>Execution</li><li>Marketing</li><li>Review</li></ul></section>
        <section className="flow"><h3>FLOW DIAGRAM</h3><div><span>Start</span>→<span>Input</span>→<b>Process</b>→<span>Output</span>→<span>End</span></div></section>
      </div>
      <DocumentCard className="design-document" title="Design_Notes.pdf">
        <h2>Design Notes</h2><mark>Key Objectives</mark>
        <ol><li>Simplicity</li><li>Flexibility</li><li>Performance</li><li>Accessibility</li></ol>
        <div className="house-sketch">⌂</div>
      </DocumentCard>
      <DocumentCard className="strategy-document" title="Strategy.docx">
        <h3>STRATEGY OVERVIEW</h3><p>Our strategy is built on three pillars:</p>
        <ol><li>People</li><li>Process</li><li><mark>Technology</mark></li></ol>
        <Lightbulb className="bulb" size={65} />
      </DocumentCard>
      {minimapOpen && (
        <aside className="minimap" aria-label="Minimap">
          <div className="minimap-view"><div className="minimap-dots">· · · · · · · · · · · · · · · · · ·</div><div className="viewport-marker" /></div>
          <div className="minimap-controls"><button onClick={zoomOut} aria-label="Zoom out"><Minus size={14} /></button><output>{Math.round(zoom * 88)}%</output><button onClick={zoomIn} aria-label="Zoom in"><Plus size={14} /></button></div>
        </aside>
      )}
    </section>
  );
}

function DocumentCard({ title, className, children }: { title: string; className: string; children: ReactNode }) {
  return (
    <article className={`document-card ${className}`}>
      <header><span>{title}</span><FileText size={13} /><Search size={13} /><span>150%⌄</span><X size={14} /></header>
      <div className="document-body">{children}</div>
    </article>
  );
}
