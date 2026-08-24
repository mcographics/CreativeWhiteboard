import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { useUiStore } from "../src/state/uiStore";
import { useNotificationStore } from "../src/state/notificationStore";

describe("settings dialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useUiStore.setState({
      settingsOpen: true,
      gridVisible: true,
      minimapOpen: true,
      interfaceScale: 1,
      windowMode: "fullscreen-windowed",
      applicationResolution: { width: 1920, height: 1080 },
      exportScale: 1,
      stylusPressureEnabled: true,
      palmRejectionEnabled: true
    });
  });

  it("applies every setting in both directions", () => {
    render(<SettingsDialog />);
    const grid = screen.getByLabelText("Show grid");
    const minimap = screen.getByLabelText("Show minimap");
    const scale = screen.getByLabelText("Interface scale");
    const pressure = screen.getByLabelText("Pressure-sensitive strokes");
    const palmRejection = screen.getByLabelText("Palm rejection");

    fireEvent.click(grid);
    fireEvent.click(minimap);
    fireEvent.change(scale, { target: { value: "135" } });
    fireEvent.click(pressure);
    fireEvent.click(palmRejection);
    expect(useUiStore.getState()).toMatchObject({
      gridVisible: false,
      minimapOpen: false,
      interfaceScale: 1.35,
      stylusPressureEnabled: false,
      palmRejectionEnabled: false
    });

    fireEvent.click(grid);
    fireEvent.click(minimap);
    fireEvent.change(scale, { target: { value: "80" } });
    fireEvent.click(pressure);
    fireEvent.click(palmRejection);
    expect(useUiStore.getState()).toMatchObject({
      gridVisible: true,
      minimapOpen: true,
      interfaceScale: .8,
      stylusPressureEnabled: true,
      palmRejectionEnabled: true
    });
  });

  it("clamps interface scaling to the supported range", () => {
    useUiStore.getState().setInterfaceScale(.2);
    expect(useUiStore.getState().interfaceScale).toBe(.8);
    useUiStore.getState().setInterfaceScale(3);
    expect(useUiStore.getState().interfaceScale).toBe(1.5);
  });

  it("applies all three native window modes", async () => {
    const setMode = vi.fn(async (mode: "windowed" | "fullscreen-windowed" | "borderless") => mode);
    window.desktopWindow = {
      minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn(), setResolution: vi.fn(),
      setMode, setDirty: vi.fn(), onSaveBeforeClose: vi.fn(() => vi.fn()), finishSaveBeforeClose: vi.fn(),
      onDiscardRecoveryBeforeClose: vi.fn(() => vi.fn()), finishDiscardRecoveryBeforeClose: vi.fn()
    };
    render(<SettingsDialog />);
    for (const [mode, label] of [["windowed", "Windowed"], ["borderless", "Borderless"], ["fullscreen-windowed", "Full Screen Windowed"]] as const) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      await vi.waitFor(() => expect(setMode).toHaveBeenCalledWith(mode));
    }
    expect(useUiStore.getState().windowMode).toBe("fullscreen-windowed");
  });

  it("confirms and applies an application resolution change", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const setResolution = vi.fn().mockResolvedValue({
      allowed: true, requestedWidth: 3840, requestedHeight: 2160, appliedWidth: 3840, appliedHeight: 2160,
      monitorWidth: 3840, monitorHeight: 2160, fitted: false
    });
    window.desktopWindow = { minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn(), setResolution, setMode: vi.fn().mockResolvedValue("fullscreen-windowed"), setDirty: vi.fn(), onSaveBeforeClose: vi.fn(() => vi.fn()), finishSaveBeforeClose: vi.fn(), onDiscardRecoveryBeforeClose: vi.fn(() => vi.fn()), finishDiscardRecoveryBeforeClose: vi.fn() };
    render(<SettingsDialog />);
    fireEvent.click(screen.getByRole("button", { name: "3840 × 2160 (4K UHD)" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply selected resolution" }));
    await vi.waitFor(() => expect(setResolution).toHaveBeenCalledWith(3840, 2160));
    expect(useUiStore.getState().applicationResolution).toEqual({ width: 3840, height: 2160 });
    expect(useUiStore.getState().exportScale).toBe(1);
  });

  it("does not resize the window when confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const setResolution = vi.fn();
    window.desktopWindow = { minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn(), setResolution, setMode: vi.fn().mockResolvedValue("fullscreen-windowed"), setDirty: vi.fn(), onSaveBeforeClose: vi.fn(() => vi.fn()), finishSaveBeforeClose: vi.fn(), onDiscardRecoveryBeforeClose: vi.fn(() => vi.fn()), finishDiscardRecoveryBeforeClose: vi.fn() };
    render(<SettingsDialog />);
    fireEvent.click(screen.getByRole("button", { name: "7680 × 4320 (8K UHD)" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply selected resolution" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(setResolution).not.toHaveBeenCalled();
    expect(useUiStore.getState().exportScale).toBe(1);
  });

  it("shows a failure only when the preset exceeds the monitor", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    window.desktopWindow = {
      minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn(),
      setDirty: vi.fn(), onSaveBeforeClose: vi.fn(() => vi.fn()), finishSaveBeforeClose: vi.fn(),
      setMode: vi.fn().mockResolvedValue("fullscreen-windowed"),
      onDiscardRecoveryBeforeClose: vi.fn(() => vi.fn()), finishDiscardRecoveryBeforeClose: vi.fn(),
      setResolution: vi.fn().mockResolvedValue({
        allowed: false, requestedWidth: 7680, requestedHeight: 4320,
        monitorWidth: 2560, monitorHeight: 1440,
        reason: "The selected 7680 × 4320 resolution exceeds this monitor's 2560 × 1440 native resolution."
      })
    };
    render(<SettingsDialog />);
    fireEvent.click(screen.getByRole("button", { name: "7680 × 4320 (8K UHD)" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply selected resolution" }));
    await vi.waitFor(() => expect(useNotificationStore.getState().kind).toBe("error"));
    expect(useNotificationStore.getState().message).toContain("2560 × 1440");
    expect(useUiStore.getState().exportScale).toBe(1);
  });

  it("closes with Escape and returns focus", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    render(<SettingsDialog />);
    expect(screen.getByRole("dialog", { name: "Settings" })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useUiStore.getState().settingsOpen).toBe(false);
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
