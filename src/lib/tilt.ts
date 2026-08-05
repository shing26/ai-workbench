import type { PointerEvent as ReactPointerEvent } from "react";

export function tiltCard(event: ReactPointerEvent<HTMLElement>, maxDegrees = 7): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  event.currentTarget.style.setProperty("--rx", `${(-y * maxDegrees).toFixed(2)}deg`);
  event.currentTarget.style.setProperty("--ry", `${(x * maxDegrees).toFixed(2)}deg`);
}

export function resetTilt(event: ReactPointerEvent<HTMLElement>): void {
  event.currentTarget.style.setProperty("--rx", "0deg");
  event.currentTarget.style.setProperty("--ry", "0deg");
}
