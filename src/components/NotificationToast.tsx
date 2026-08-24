import { X } from "lucide-react";
import { useNotificationStore } from "../state/notificationStore";

export function NotificationToast() {
  const { message, kind, clear } = useNotificationStore();
  if (!message) return null;
  return <div className={`notification-toast ${kind}`} role={kind === "error" ? "alert" : "status"}><span>{message}</span><button aria-label="Dismiss notification" onClick={clear}><X size={14}/></button></div>;
}
