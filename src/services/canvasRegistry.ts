import type Konva from "konva";

let stage: Konva.Stage | null = null;

export const canvasRegistry = {
  setStage(nextStage: Konva.Stage | null) {
    stage = nextStage;
  },
  getStage() {
    return stage;
  }
};
