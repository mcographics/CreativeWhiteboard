import type { DrawingTool, StrokeObject, ToolProperties } from "../models/whiteboard";
import { useBoardStore } from "../state/boardStore";
import { useToolStore } from "../state/toolStore";
import { useUiStore } from "../state/uiStore";

const swatches = [
  "#050505", "#f9f9f9", "#bfc0c2", "#8c8d90", "#5f6063", "#333438", "#141518",
  "#ee2737", "#ff8b19", "#ffd600", "#e7ef00", "#24bed0", "#3fa5e5", "#e8df91",
  "#a94365", "#bd6530", "#b99723", "#66a82c", "#238caf", "#2357ce", "#8144bd",
  "#cf3dc5", "#d75887", "#96762c", "#55a06e", "#408e7e", "#4d5db8"
];

const sizePresets: Record<DrawingTool | "shape", number[]> = {
  pen: [1, 2, 3, 5, 8, 12],
  brush: [4, 8, 12, 18, 26, 36],
  highlighter: [8, 12, 18, 24, 32, 44],
  marker: [3, 6, 10, 14, 20, 28],
  shape: [1, 2, 3, 5, 8, 12]
};

const drawingTools: DrawingTool[] = ["pen", "brush", "highlighter", "marker"];
const shapeTools = ["rectangle", "ellipse", "triangle", "star", "arrow", "badge", "shapes"] as const;
const eraserSizes = [8, 16, 24, 36, 52, 72];

export function PropertiesPanel() {
  const activeTool = useToolStore((state) => state.activeTool);
  const propertiesOpen = useUiStore((state) => state.propertiesOpen);
  const toggleProperties = useUiStore((state) => state.toggleProperties);
  const generalProperties = useBoardStore((state) => state.properties);
  const toolProfiles = useBoardStore((state) => state.toolProfiles);
  const setProperties = useBoardStore((state) => state.setProperties);
  const setToolProperties = useBoardStore((state) => state.setToolProperties);
  const eraserSize = useBoardStore((state) => state.eraserSize);
  const setEraserSize = useBoardStore((state) => state.setEraserSize);
  const objects = useBoardStore((state) => state.objects);
  const selectedIds = useBoardStore((state) => state.selectedIds);
  const drawingTool = drawingTools.includes(activeTool as DrawingTool) ? activeTool as DrawingTool : null;
  const erasing = activeTool === "eraser";
  const selectedShape = objects.find((object) => selectedIds.includes(object.id) && "strokeColor" in object);
  const selectedStroke = objects.find((object): object is StrokeObject => selectedIds.includes(object.id) && object.type === "stroke");
  const shapeContext = shapeTools.includes(activeTool as typeof shapeTools[number]) || (!drawingTool && !erasing && Boolean(selectedShape));
  const current: ToolProperties = drawingTool
    ? toolProfiles[drawingTool]
    : selectedStroke
      ? {
          ...generalProperties,
          strokeColor: selectedStroke.color,
          strokeWidth: selectedStroke.strokeWidth,
          opacity: selectedStroke.opacity,
          smoothInk: selectedStroke.smooth
        }
    : selectedShape && "strokeColor" in selectedShape
      ? {
          ...generalProperties,
          strokeColor: selectedShape.strokeColor,
          fillColor: selectedShape.fillColor === "transparent" ? generalProperties.fillColor : selectedShape.fillColor,
          strokeWidth: selectedShape.strokeWidth,
          opacity: selectedShape.opacity,
          fillShapes: selectedShape.fillColor !== "transparent"
        }
      : generalProperties;
  const update = (patch: Partial<ToolProperties>) => drawingTool ? setToolProperties(drawingTool, patch) : setProperties(patch);
  const sizes = sizePresets[drawingTool ?? "shape"];

  return (
    <aside className={`properties-panel ${propertiesOpen ? "" : "is-collapsed"}`} aria-label="Contextual properties">
      <button
        className="properties-edge-toggle"
        type="button"
        aria-label={propertiesOpen ? "Collapse properties" : "Expand properties"}
        onClick={toggleProperties}
      >
        {propertiesOpen ? "<" : ">"}
      </button>
      <div className="palette-tabs">
        {propertiesOpen && <strong>{drawingTool ? `${drawingTool} tip` : erasing ? "eraser tip" : selectedStroke ? `${selectedStroke.mode} stroke properties` : selectedShape ? `${selectedShape.type} properties` : `${activeTool} properties`}</strong>}
      </div>
      {propertiesOpen && <>
        {erasing ? <div className="palette-section">
          <strong>Eraser Size</strong>
          <div className="stroke-sizes">
            {eraserSizes.map((size) => <button type="button" className={eraserSize === size ? "selected" : ""} onClick={() => setEraserSize(size)} key={size} aria-label={`${size} pixel eraser`}><i style={{ width: Math.min(size, 26), height: Math.min(size, 26) }} /></button>)}
          </div>
          <p className="tool-option-hint">Drag across an object to erase it.</p>
        </div> : <>
        {shapeContext && selectedShape && <div className="shape-edit-hint">Selected shape · drag to move · use handles to resize or rotate</div>}
        <div className="palette-section">
          <strong>{shapeContext ? "Stroke Color" : "Color"}</strong>
          <div className="swatch-grid">
            {swatches.map((color) => <button type="button" className={current.strokeColor === color ? "selected" : ""} key={color} style={{ backgroundColor: color }} aria-label={`Set color ${color}`} onClick={() => update({ strokeColor: color })} />)}
            <label className="add-swatch" aria-label="Add custom color">+<input type="color" value={current.strokeColor} onChange={(event) => update({ strokeColor: event.target.value })} /></label>
          </div>
        </div>
        {shapeContext && <div className="palette-section">
          <strong>Fill Color</strong>
          <div className="swatch-grid">
            {swatches.map((color) => <button type="button" className={current.fillColor === color ? "selected" : ""} key={color} style={{ backgroundColor: color }} aria-label={`Set fill color ${color}`} onClick={() => update({ fillColor: color, fillShapes: true })} />)}
            <label className="add-swatch" aria-label="Add custom fill color">+<input type="color" value={current.fillColor} onChange={(event) => update({ fillColor: event.target.value, fillShapes: true })} /></label>
          </div>
        </div>}
        <div className="palette-section">
          <strong>{drawingTool ? "Tip Size" : "Stroke Size"}</strong>
          <div className="stroke-sizes">
            {sizes.map((size) => <button type="button" className={current.strokeWidth === size ? "selected" : ""} onClick={() => update({ strokeWidth: size })} key={size} aria-label={`${size} pixel ${drawingTool ? "tip" : "stroke"}`}><i style={{ width: Math.min(size, 26), height: Math.min(size, 26) }} /></button>)}
          </div>
        </div>
        <div className="palette-section">
          <strong>Opacity</strong>
          <div className="opacity-row"><input type="range" min="5" max="100" value={Math.round(current.opacity * 100)} onChange={(event) => update({ opacity: Number(event.target.value) / 100 })} /><output>{Math.round(current.opacity * 100)}%</output></div>
        </div>
        <div className="palette-section options-section">
          <strong>More Options</strong>
          {shapeContext && <label>Fill Shapes<input type="checkbox" checked={current.fillShapes} onChange={(event) => update({ fillShapes: event.target.checked })} /><i /></label>}
          {drawingTool && <label>Smooth Ink<input type="checkbox" checked={current.smoothInk} onChange={(event) => update({ smoothInk: event.target.checked })} /><i /></label>}
        </div>
        </>}
      </>}
    </aside>
  );
}
