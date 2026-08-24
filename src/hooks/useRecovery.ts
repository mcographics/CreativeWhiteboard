import { useEffect } from "react";
import { useBoardStore } from "../state/boardStore";
import { useCameraStore } from "../state/cameraStore";
import { useProjectStore } from "../state/projectStore";

const RECOVERY_KEY = "creative-whiteboard-recovery-v1";

export function useRecovery() {
  useEffect(() => {
    if (window.desktopWindow) {
      const recovery = localStorage.getItem(RECOVERY_KEY);
      if (recovery) {
        try {
          const parsed = JSON.parse(recovery) as { dirty?: boolean; objects?: unknown; camera?: { x: number; y: number; zoom: number } };
          if (parsed.dirty === true) {
            if (window.confirm("Creative Whiteboard did not close cleanly. Recover the unsaved whiteboard?")) {
              if (Array.isArray(parsed.objects)) useBoardStore.getState().replaceObjects(parsed.objects);
              if (parsed.camera) useCameraStore.getState().setCamera(parsed.camera);
            } else {
              localStorage.removeItem(RECOVERY_KEY);
            }
          } else {
            localStorage.removeItem(RECOVERY_KEY);
          }
        } catch {
          localStorage.removeItem(RECOVERY_KEY);
        }
      }
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      const saveState = useProjectStore.getState().saveState;
      if (saveState !== "unsaved" && saveState !== "failed") {
        localStorage.removeItem(RECOVERY_KEY);
        return;
      }
      timer = setTimeout(() => {
        const board = useBoardStore.getState();
        const camera = useCameraStore.getState();
        try {
          localStorage.setItem(RECOVERY_KEY, JSON.stringify({
            dirty: true,
            objects: board.objects,
            camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
            updatedAt: new Date().toISOString()
          }));
        } catch {
          // Large embedded assets can exceed browser storage; project saving remains available.
        }
      }, 1500);
    };
    const unsubscribeBoard = useBoardStore.subscribe((state, previousState) => {
      if (state.objects !== previousState.objects) {
        useProjectStore.getState().markUnsaved();
        save();
      }
    });
    const unsubscribeCamera = useCameraStore.subscribe(() => {
      if (useProjectStore.getState().saveState === "unsaved") save();
    });
    const unsubscribeProject = useProjectStore.subscribe((state, previousState) => {
      if (state.saveState === "saved" && previousState.saveState !== "saved") {
        clearTimeout(timer);
        localStorage.removeItem(RECOVERY_KEY);
      }
    });
    const unsubscribeDiscard = window.desktopWindow?.onDiscardRecoveryBeforeClose(() => {
      clearTimeout(timer);
      localStorage.removeItem(RECOVERY_KEY);
      window.desktopWindow?.finishDiscardRecoveryBeforeClose();
    });
    return () => { clearTimeout(timer); unsubscribeBoard(); unsubscribeCamera(); unsubscribeProject(); unsubscribeDiscard?.(); };
  }, []);
}
