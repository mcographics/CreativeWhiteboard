import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "../state/uiStore";
import { useNotificationStore } from "../state/notificationStore";

const resolutionPresets = [
  { scale: 1, width: 1920, height: 1080, label: "1920 × 1080 (Full HD)" },
  { scale: 1.333333, width: 2560, height: 1440, label: "2560 × 1440 (QHD)" },
  { scale: 2, width: 3840, height: 2160, label: "3840 × 2160 (4K UHD)" },
  { scale: 2.666667, width: 5120, height: 2880, label: "5120 × 2880 (5K)" },
  { scale: 4, width: 7680, height: 4320, label: "7680 × 4320 (8K UHD)" }
];

export function SettingsDialog() {
  const { settingsOpen, toggleSettings, minimapOpen, setMinimapOpen, gridVisible, setGridVisible, appearance, setAppearance, interfaceScale, setInterfaceScale, windowMode, setWindowMode, applicationResolution, setApplicationResolution, stylusPressureEnabled, setStylusPressureEnabled, palmRejectionEnabled, setPalmRejectionEnabled } = useUiStore();
  const notify = useNotificationStore((state) => state.show);
  const dialogRef = useRef<HTMLElement>(null);
  const [selectedResolution, setSelectedResolution] = useState(`${applicationResolution.width}x${applicationResolution.height}`);
  const applyResolution = async (nextScale: number) => {
    const preset = resolutionPresets.find((item) => item.scale === nextScale);
    if (!preset) return;
    if (!window.confirm(`Force the application window to ${preset.label}? Oversized windows may extend beyond the visible desktop.`)) return;
    try {
      const result = await window.desktopWindow?.setResolution(preset.width, preset.height);
      if (!result) throw new Error("Electron did not return applied window bounds.");
      if (!result.allowed) {
        notify(result.reason ?? `Resolution exceeds the monitor's ${result.monitorWidth} × ${result.monitorHeight} limit.`, "error");
        return;
      }
      setApplicationResolution({ width: preset.width, height: preset.height });
      setWindowMode("windowed");
      const applied = `${result.appliedWidth ?? preset.width} × ${result.appliedHeight ?? preset.height}`;
      notify(`Application window forced to ${applied}.`, "info");
    } catch (error) {
      notify(error instanceof Error ? `Resolution change failed: ${error.message}` : "The application resolution could not be changed.", "error");
    }
  };
  useEffect(() => {
    if (!settingsOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        toggleSettings();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button,input,[tabindex]:not([tabindex='-1'])"))
        .filter((element) => !element.hasAttribute("disabled"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, [settingsOpen, toggleSettings]);
  if (!settingsOpen) return null;
  return <div className="modal-backdrop" onMouseDown={toggleSettings}>
    <section ref={dialogRef} tabIndex={-1} className="settings-dialog" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(event) => event.stopPropagation()}>
      <header><h2>Settings</h2><button aria-label="Close settings" onClick={toggleSettings}><X size={17}/></button></header>
      <fieldset className="settings-choice-field"><legend>Appearance</legend><div className="settings-choice-grid" aria-label="Appearance">
        {([
          ["dark", "Dark"], ["light", "Light"], ["auto", "Auto"], ["system", "System"]
        ] as const).map(([value, label]) => <button type="button" aria-pressed={appearance === value} className={appearance === value ? "active" : ""} key={value} onClick={() => setAppearance(value)}>{label}</button>)}
      </div></fieldset>
      <fieldset className="settings-choice-field"><legend>Viewing mode</legend><div className="settings-choice-grid viewing-modes" aria-label="Viewing mode">
        {([
          ["windowed", "Windowed"], ["fullscreen-windowed", "Full Screen Windowed"], ["borderless", "Borderless"]
        ] as const).map(([mode, label]) => <button type="button" aria-pressed={windowMode === mode} className={windowMode === mode ? "active" : ""} key={mode} onClick={() => {
          void window.desktopWindow?.setMode(mode).then((applied) => {
          if (applied) {
            setWindowMode(mode);
            notify(`Window mode changed to ${label}.`, "info");
          }
        }).catch(() => notify("The window mode could not be changed.", "error"));
        }}>{label}</button>)}
      </div></fieldset>
      <label>Show grid<input aria-label="Show grid" type="checkbox" checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} /></label>
      <label>Show minimap<input aria-label="Show minimap" type="checkbox" checked={minimapOpen} onChange={(event) => setMinimapOpen(event.target.checked)} /></label>
      <fieldset className="settings-choice-field"><legend>Pen tablet and stylus</legend>
        <label>Pressure-sensitive strokes<input aria-label="Pressure-sensitive strokes" type="checkbox" checked={stylusPressureEnabled} onChange={(event) => setStylusPressureEnabled(event.target.checked)} /></label>
        <label>Palm rejection<input aria-label="Palm rejection" type="checkbox" checked={palmRejectionEnabled} onChange={(event) => setPalmRejectionEnabled(event.target.checked)} /></label>
        <p className="tool-option-hint">Supports standard Windows Pointer Events used by Wacom and compatible pen tablets. The stylus eraser end removes objects, and the barrel button pans.</p>
      </fieldset>
      <label>Interface scale<input aria-label="Interface scale" type="range" min="80" max="150" step="5" value={interfaceScale * 100} onChange={(event) => setInterfaceScale(Number(event.target.value) / 100)} /><output>{Math.round(interfaceScale * 100)}%</output></label>
      <fieldset className="settings-choice-field"><legend>Application resolution</legend><div className="settings-resolution-grid" aria-label="Application resolution">
        {resolutionPresets.map((preset) => { const key = `${preset.width}x${preset.height}`; return <button type="button" aria-pressed={selectedResolution === key} className={selectedResolution === key ? "active" : ""} onClick={() => setSelectedResolution(key)} key={preset.label}>{preset.label}</button>; })}
      </div><button className="apply-resolution" type="button" onClick={() => {
        const preset = resolutionPresets.find((item) => `${item.width}x${item.height}` === selectedResolution);
        if (preset) void applyResolution(preset.scale);
      }}>Apply selected resolution</button></fieldset>
    </section>
  </div>;
}
