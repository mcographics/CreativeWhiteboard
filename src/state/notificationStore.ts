import { create } from "zustand";

interface NotificationState {
  message: string | null;
  kind: "info" | "error";
  show: (message: string, kind?: "info" | "error") => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  message: null,
  kind: "info",
  show: (message, kind = "info") => set({ message, kind }),
  clear: () => set({ message: null })
}));
