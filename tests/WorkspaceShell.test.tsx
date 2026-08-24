import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "../src/App";
import { useCameraStore } from "../src/state/cameraStore";
import { useUiStore } from "../src/state/uiStore";
import { useBoardStore } from "../src/state/boardStore";
import { useToolStore } from "../src/state/toolStore";

describe("workspace shell", () => {
  it("renders the primary application regions", () => {
    render(<App />);
    expect(screen.getByLabelText(/Untitled — Creative Whiteboard/)).toBeInTheDocument();
    expect(screen.getByText("Dev Build 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Main toolbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
    expect(screen.getByLabelText("Whiteboard tools")).toBeInTheDocument();
    expect(screen.getByLabelText("Infinite whiteboard canvas")).toBeInTheDocument();
    expect(screen.getByLabelText("Contextual properties")).toBeInTheDocument();
    expect(screen.getByLabelText("Minimap")).toBeInTheDocument();
  });

  it("uses a single working zoom dropdown", () => {
    render(<App />);
    expect(screen.getAllByLabelText("Zoom out")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Zoom level"), { target: { value: "150" } });
    expect(useCameraStore.getState().zoom).toBe(1.5);
    expect(screen.queryByLabelText("Application resolution")).not.toBeInTheDocument();
  });

  it("visibly follows the grid preference on and off", () => {
    useUiStore.setState({ gridVisible: true });
    render(<App />);
    const canvas = screen.getByLabelText("Infinite whiteboard canvas");
    expect(canvas).toHaveClass("grid-visible");
    act(() => useUiStore.getState().setGridVisible(false));
    expect(canvas).not.toHaveClass("grid-visible");
    act(() => useUiStore.getState().setGridVisible(true));
    expect(canvas).toHaveClass("grid-visible");
  });

  it("uses a compact directional properties edge toggle", () => {
    useUiStore.setState({ propertiesOpen: true });
    render(<App />);
    const panel = screen.getByLabelText("Contextual properties");
    const collapse = screen.getByRole("button", { name: "Collapse properties" });
    expect(collapse).toHaveTextContent("<");
    fireEvent.click(collapse);
    expect(panel).toHaveClass("is-collapsed");
    expect(screen.getByRole("button", { name: "Expand properties" })).toHaveTextContent(">");
  });

  it("opens typing editors directly from Text, Comment, and Sticky Note tools", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Text"));
    expect(screen.getByLabelText("Canvas text editor")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Font family"), { target: { value: "Georgia" } });
    fireEvent.change(screen.getByLabelText("Font size"), { target: { value: "32" } });
    await user.click(screen.getByRole("button", { name: "Bold" }));
    await user.click(screen.getByRole("button", { name: "Italic" }));
    await user.click(screen.getByRole("button", { name: "Underline" }));
    expect(screen.getByRole("button", { name: "Done" })).not.toHaveStyle({ fontWeight: "700", fontStyle: "italic", textDecoration: "underline" });
    await user.type(screen.getByLabelText("Canvas text editor"), "Canvas heading");
    fireEvent.keyDown(screen.getByLabelText("Canvas text editor"), { key: "Enter", ctrlKey: true });

    await user.click(screen.getByLabelText("Comment"));
    expect(screen.getByLabelText("Comment note editor")).toHaveFocus();
    await user.type(screen.getByLabelText("Comment note editor"), "Review this section");
    fireEvent.keyDown(screen.getByLabelText("Comment note editor"), { key: "Enter", ctrlKey: true });

    await user.click(screen.getByLabelText("Sticky Note"));
    expect(screen.getByLabelText("Sticky note editor")).toHaveFocus();
    await user.type(screen.getByLabelText("Sticky note editor"), "Remember the deadline");
    fireEvent.keyDown(screen.getByLabelText("Sticky note editor"), { key: "Enter", ctrlKey: true });

    const objects = useBoardStore.getState().objects;
    expect(objects.some((object) => object.type === "text" && object.text === "Canvas heading")).toBe(true);
    expect(objects.some((object) => object.type === "text" && object.fontFamily === "Georgia" && object.fontSize === 32 && object.bold && object.italic && object.underline)).toBe(true);
    expect(objects.some((object) => object.type === "note" && object.note === "Review this section")).toBe(true);
    expect(objects.some((object) => object.type === "note" && object.variant === "sticky" && object.note === "Remember the deadline")).toBe(true);
    expect(useToolStore.getState().activeTool).toBe("select");
    expect(useBoardStore.getState().selectedIds).toEqual([objects.at(-1)?.id]);
  }, 15_000);

  it("keeps the text caret where the user places it while typing", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Text"));
    const editor = screen.getByLabelText("Canvas text editor") as HTMLTextAreaElement;
    await user.type(editor, "abcd");
    editor.setSelectionRange(1, 1);
    await user.type(editor, "X", { skipClick: true });
    expect(editor).toHaveValue("aXbcd");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useToolStore.getState().activeTool).toBe("select");
  });

  it("loads installed system fonts and applies the selected family to text", async () => {
    const user = userEvent.setup();
    window.desktopFonts = {
      listSystemFonts: vi.fn().mockResolvedValue(["Arial", "\"Comic Sans MS\"", "Custom Studio Font"])
    };
    useBoardStore.setState({ objects: [], selectedIds: [], past: [], future: [], clipboard: [] });
    render(<App />);
    await user.click(screen.getByLabelText("Text"));

    await vi.waitFor(() => expect(screen.getByRole("option", { name: "Custom Studio Font" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Font family"), { target: { value: "Custom Studio Font" } });
    await user.type(screen.getByLabelText("Canvas text editor"), "System font text");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(window.desktopFonts.listSystemFonts).toHaveBeenCalled();
    expect(useBoardStore.getState().objects[0]).toMatchObject({
      type: "text",
      text: "System font text",
      fontFamily: "Custom Studio Font"
    });
    delete window.desktopFonts;
  });

  it("moves an active sticky-note editor with its corner lip", async () => {
    const user = userEvent.setup();
    useBoardStore.setState({ objects: [], selectedIds: [], past: [], future: [], clipboard: [] });
    useCameraStore.getState().reset();
    render(<App />);
    await user.click(screen.getByLabelText("Sticky Note"));

    const shell = screen.getByLabelText("Sticky note editor").closest(".canvas-editor-shell") as HTMLElement;
    const startingLeft = Number.parseFloat(shell.style.left);
    const startingTop = Number.parseFloat(shell.style.top);
    const lip = screen.getByRole("button", { name: "Move sticky note editor" });
    fireEvent.pointerDown(lip, { button: 0, pointerId: 71, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 71, clientX: 165, clientY: 145 });
    fireEvent.pointerUp(window, { pointerId: 71, clientX: 165, clientY: 145 });

    expect(Number.parseFloat(shell.style.left)).toBe(startingLeft + 65);
    expect(Number.parseFloat(shell.style.top)).toBe(startingTop + 45);
    await user.type(screen.getByLabelText("Sticky note editor"), "Movable reminder");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(document.querySelector("[name^='move-lip-']")).not.toBeNull();
  });

  it("creates independently colored sticky notes with presets and a custom picker", async () => {
    const user = userEvent.setup();
    useBoardStore.setState({ objects: [], selectedIds: [], past: [], future: [], clipboard: [] });
    render(<App />);

    await user.click(screen.getByLabelText("Sticky Note"));
    await user.click(screen.getByRole("button", { name: "Set sticky note color #ffd6e7" }));
    await user.type(screen.getByLabelText("Sticky note editor"), "Pink reminder");
    await user.click(screen.getByRole("button", { name: "Done" }));

    await user.click(screen.getByLabelText("Sticky Note"));
    fireEvent.change(screen.getByLabelText("Sticky note color picker"), { target: { value: "#24506f" } });
    await user.type(screen.getByLabelText("Sticky note editor"), "Dark custom reminder");
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(useBoardStore.getState().objects[0]).toMatchObject({
      type: "note",
      backgroundColor: "#ffd6e7",
      note: "Pink reminder"
    });
    expect(useBoardStore.getState().objects[1]).toMatchObject({
      type: "note",
      backgroundColor: "#24506f",
      color: "#ffffff",
      note: "Dark custom reminder"
    });
  });

  it("shows supplied creator and publisher information in About", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText("Help"));
    await user.click(screen.getByRole("menuitem", { name: "About Creative Whiteboard" }));
    expect(screen.getByRole("dialog", { name: "About Creative Whiteboard" })).toHaveTextContent("Kenneth Salmon");
    expect(screen.getByRole("dialog", { name: "About Creative Whiteboard" })).toHaveTextContent("Majestic Creations");
    expect(screen.getByRole("dialog", { name: "About Creative Whiteboard" })).toHaveTextContent("Discord: cmdrstriker");
  });

  it("provides independent shape tools and shape-specific options", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ propertiesOpen: true });
    render(<App />);
    for (const name of ["Rectangle", "Ellipse", "Triangle", "Star", "Arrow", "Badge"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Star" }));
    expect(screen.getByRole("button", { name: "Star" })).toHaveClass("is-active");
    expect(screen.getByText("Stroke Color")).toBeInTheDocument();
    expect(screen.getByText("Fill Color")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Fill Shapes" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Smooth Ink" })).not.toBeInTheDocument();
  });

  it("applies every Draw option to the stroke that is created", async () => {
    const user = userEvent.setup();
    useBoardStore.setState({ objects: [], selectedIds: [], past: [], future: [], clipboard: [] });
    useCameraStore.getState().reset();
    useUiStore.setState({ propertiesOpen: true });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Pen" }));
    expect(screen.queryByRole("checkbox", { name: "Fill Shapes" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set color #ee2737" }));
    await user.click(screen.getByRole("button", { name: "8 pixel tip" }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "55" } });
    const smoothInk = screen.getByRole("checkbox", { name: "Smooth Ink" });
    if ((smoothInk as HTMLInputElement).checked) await user.click(smoothInk);

    const stage = document.querySelector<HTMLElement>("[data-konva='Stage']");
    expect(stage).not.toBeNull();
    fireEvent.pointerDown(stage!, { button: 0, pointerId: 11, clientX: 30, clientY: 40 });
    fireEvent.pointerMove(window, { pointerId: 11, clientX: 130, clientY: 140 });
    fireEvent.pointerUp(window, { pointerId: 11, clientX: 130, clientY: 140 });

    expect(useBoardStore.getState().objects[0]).toMatchObject({
      type: "stroke",
      mode: "pen",
      color: "#ee2737",
      strokeWidth: 8,
      opacity: 0.55,
      smooth: false
    });

    await user.click(screen.getByRole("button", { name: "Highlighter" }));
    await user.click(screen.getByRole("button", { name: "32 pixel tip" }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } });
    fireEvent.pointerDown(stage!, { button: 0, pointerId: 12, clientX: 160, clientY: 40 });
    fireEvent.pointerMove(window, { pointerId: 12, clientX: 260, clientY: 140 });
    fireEvent.pointerUp(window, { pointerId: 12, clientX: 260, clientY: 140 });

    expect(useBoardStore.getState().objects[1]).toMatchObject({
      type: "stroke",
      mode: "highlighter",
      strokeWidth: 32,
      opacity: 0.8
    });
  });

  it("uses the selected eraser size while dragging across objects", async () => {
    const user = userEvent.setup();
    useBoardStore.setState({
      objects: [{
        id: "erase-me", type: "rectangle", x: 100, y: 100, width: 80, height: 60,
        rotation: 0, opacity: 1, locked: false, strokeColor: "#000000",
        fillColor: "#ffffff", strokeWidth: 3
      }],
      selectedIds: ["erase-me"],
      past: [],
      future: [],
      clipboard: [],
      eraserSize: 24
    });
    useCameraStore.getState().reset();
    useUiStore.setState({ propertiesOpen: true });
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Eraser" }));
    expect(screen.getByText("Eraser Size")).toBeInTheDocument();
    expect(screen.queryByText("Color")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "52 pixel eraser" }));
    expect(useBoardStore.getState().eraserSize).toBe(52);

    const stage = document.querySelector<HTMLElement>("[data-konva='Stage']");
    fireEvent.pointerDown(stage!, { button: 0, pointerId: 14, clientX: 80, clientY: 120 });
    fireEvent.pointerMove(window, { pointerId: 14, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(window, { pointerId: 14, clientX: 100, clientY: 120 });
    expect(useBoardStore.getState().objects).toHaveLength(0);
  });

  it("pans with the Pan tool and keeps tracking the mouse outside the canvas", async () => {
    const user = userEvent.setup();
    useCameraStore.getState().reset();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Pan" }));

    const stage = document.querySelector<HTMLElement>("[data-konva='Stage']");
    expect(stage).not.toBeNull();
    fireEvent.pointerDown(stage!, { button: 0, pointerId: 21, clientX: 100, clientY: 120 });
    fireEvent.pointerMove(window, { pointerId: 21, clientX: 190, clientY: 175 });
    expect(useCameraStore.getState()).toMatchObject({ x: 90, y: 55 });
    fireEvent.pointerUp(window, { pointerId: 21, clientX: 190, clientY: 175 });

    fireEvent.pointerMove(window, { pointerId: 21, clientX: 250, clientY: 250 });
    expect(useCameraStore.getState()).toMatchObject({ x: 90, y: 55 });
  });

  it.each([
    ["middle", 1],
    ["right", 2]
  ])("pans with the %s mouse button without selecting Pan", (_label, button) => {
    useToolStore.getState().setActiveTool("select");
    useCameraStore.getState().reset();
    render(<App />);
    const stage = document.querySelector<HTMLElement>("[data-konva='Stage']");
    fireEvent.pointerDown(stage!, { button, pointerId: button + 30, clientX: 40, clientY: 50 });
    fireEvent.pointerMove(window, { pointerId: button + 30, clientX: 75, clientY: 90 });
    fireEvent.pointerUp(window, { pointerId: button + 30, clientX: 75, clientY: 90 });
    expect(useCameraStore.getState()).toMatchObject({ x: 35, y: 40 });
  });

  it("records Wacom-compatible pen pressure and rejects palm touches", async () => {
    const user = userEvent.setup();
    useBoardStore.setState({ objects: [], selectedIds: [], past: [], future: [], clipboard: [] });
    useCameraStore.getState().reset();
    useUiStore.setState({ stylusPressureEnabled: true, palmRejectionEnabled: true });
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Pen" }));

    const stage = document.querySelector<HTMLElement>("[data-konva='Stage']");
    fireEvent.pointerDown(stage!, { button: 0, buttons: 1, pointerId: 41, pointerType: "pen", pressure: .2, clientX: 20, clientY: 30 });
    fireEvent.pointerDown(stage!, { button: 0, buttons: 1, pointerId: 42, pointerType: "touch", pressure: .5, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { buttons: 1, pointerId: 41, pointerType: "pen", pressure: .9, clientX: 120, clientY: 130 });
    fireEvent.pointerUp(window, { button: 0, pointerId: 41, pointerType: "pen", pressure: 0, clientX: 120, clientY: 130 });

    expect(useBoardStore.getState().objects).toHaveLength(1);
    expect(useBoardStore.getState().objects[0]).toMatchObject({
      type: "stroke",
      inputType: "pen",
      pressures: [.2, .9]
    });
  });

  it("uses the stylus eraser end without changing the selected drawing tool", async () => {
    const user = userEvent.setup();
    useBoardStore.setState({
      objects: [{
        id: "stylus-erase-me", type: "rectangle", x: 90, y: 90, width: 80, height: 60,
        rotation: 0, opacity: 1, locked: false, strokeColor: "#000000",
        fillColor: "#ffffff", strokeWidth: 3
      }],
      selectedIds: [],
      past: [],
      future: [],
      clipboard: []
    });
    useCameraStore.getState().reset();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Brush" }));

    const stage = document.querySelector<HTMLElement>("[data-konva='Stage']");
    fireEvent.pointerDown(stage!, { button: 5, buttons: 32, pointerId: 44, pointerType: "pen", pressure: .5, clientX: 110, clientY: 110 });
    fireEvent.pointerUp(window, { button: 5, pointerId: 44, pointerType: "pen", clientX: 110, clientY: 110 });

    expect(useBoardStore.getState().objects).toHaveLength(0);
    expect(useToolStore.getState().activeTool).toBe("brush");
  });

  it("creates one shape from a drag and then returns to Select", async () => {
    const user = userEvent.setup();
    useBoardStore.setState({ objects: [], selectedIds: [], past: [], future: [], clipboard: [] });
    useCameraStore.getState().reset();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Rectangle" }));
    const stage = document.querySelector<HTMLElement>("[data-konva='Stage']");
    expect(stage).not.toBeNull();
    fireEvent.pointerDown(stage!, { button: 0, pointerId: 7, clientX: 100, clientY: 120 });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 260, clientY: 230 });
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 260, clientY: 230 });
    expect(useBoardStore.getState().objects).toHaveLength(1);
    const shape = useBoardStore.getState().objects[0];
    if (!shape) {
      throw new Error("Expected the completed rectangle to exist");
    }
    expect(shape).toMatchObject({ type: "rectangle", x: 100, y: 120, width: 160, height: 110 });
    expect(useToolStore.getState().activeTool).toBe("select");
    expect(useBoardStore.getState().selectedIds).toEqual([shape.id]);
    expect(screen.getByText("rectangle properties")).toBeInTheDocument();
    expect(
      screen.getByText("Selected shape · drag to move · use handles to resize or rotate"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Set fill color #ee2737" }));

    expect(useBoardStore.getState().objects[0]).toMatchObject({ fillColor: "#ee2737" });
    expect(document.querySelector("[data-konva='Transformer']")).toHaveAttribute(
      "data-enabled-anchors",
      "top-left,top-center,top-right,middle-left,middle-right,bottom-left,bottom-center,bottom-right"
    );
  });

  it("shows eight edge and corner resize handles on selected documents", () => {
    useBoardStore.setState({
      objects: [{
        id: "resize-document",
        type: "pdf",
        x: 100,
        y: 100,
        width: 400,
        height: 300,
        rotation: 0,
        opacity: 1,
        locked: false,
        fileName: "reference.pdf",
        dataUrl: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=",
        collapsed: false,
        documentZoom: 1,
        currentPage: 1,
        pageCount: 1
      }],
      selectedIds: ["resize-document"],
      past: [],
      future: [],
      clipboard: []
    });
    useCameraStore.getState().reset();
    render(<App />);

    const handles = screen.getAllByRole("button", { name: /Resize document from/ });
    expect(handles).toHaveLength(8);
    const east = screen.getByRole("button", { name: "Resize document from e" });
    fireEvent.pointerDown(east, { button: 0, pointerId: 61, clientX: 500, clientY: 250 });
    fireEvent.pointerMove(window, { pointerId: 61, clientX: 600, clientY: 250 });
    fireEvent.pointerUp(window, { pointerId: 61, clientX: 600, clientY: 250 });
    expect(useBoardStore.getState().objects[0]).toMatchObject({ x: 100, y: 100, width: 500, height: 300 });
  });
});
