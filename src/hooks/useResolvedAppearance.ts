import { useEffect, useState } from "react";
import { useUiStore } from "../state/uiStore";

export type ResolvedAppearance = "dark" | "light";

export function isAfterSundown(date = new Date(), latitude = 43.65) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const declination = 23.44 * Math.sin((Math.PI * 2 / 365) * (dayOfYear - 81)) * Math.PI / 180;
  const latitudeRadians = Math.max(-66, Math.min(66, latitude)) * Math.PI / 180;
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, -Math.tan(latitudeRadians) * Math.tan(declination))));
  const daylightHours = 2 * hourAngle * 12 / Math.PI;
  const sunrise = 12 - daylightHours / 2;
  const sunset = 12 + daylightHours / 2;
  const localHour = date.getHours() + date.getMinutes() / 60;
  return localHour < sunrise || localHour >= sunset;
}

export function useResolvedAppearance(): ResolvedAppearance {
  const appearance = useUiStore((state) => state.appearance);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);
  const [afterSundown, setAfterSundown] = useState(() => isAfterSundown());

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setAfterSundown(isAfterSundown());
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (appearance === "system") return systemDark ? "dark" : "light";
  if (appearance === "auto") return afterSundown ? "dark" : "light";
  return appearance;
}
