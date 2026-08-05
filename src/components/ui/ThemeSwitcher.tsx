import { Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ACCENTS, THEMES, watchSystemTheme } from "../../lib/theme";
import { useThemeStore } from "../../stores/themeStore";

const ACCENT_LABELS: Record<string, string> = {
  emerald: "翡翠",
  ocean: "静海",
  iris: "鸢尾",
  amber: "琥珀",
  sakura: "绯樱",
};

const THEME_LABELS: Record<string, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

export default function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme);
  const accent = useThemeStore((s) => s.accent);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setAccent = useThemeStore((s) => s.setAccent);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return watchSystemTheme(() => {
      if (useThemeStore.getState().theme === "system") {
        useThemeStore.getState().setTheme("system");
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="theme-switcher relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Theme and accent"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 transition-transform duration-100 hover:border-white/20 hover:text-slate-200 active:scale-95"
      >
        <Palette size={14} />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Theme and accent settings"
          className="theme-popover absolute right-0 top-11 z-50 w-64 rounded-2xl border border-white/10 bg-[#18181C] p-3 shadow-2xl shadow-black/40"
        >
          <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">Theme</div>
          <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {THEMES.map((value) => (
              <button
                key={value}
                type="button"
                data-theme-option={value}
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
                className={`theme-segment flex-1 rounded-lg px-2 py-1.5 text-[11px] ${
                  theme === value
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {THEME_LABELS[value]}
              </button>
            ))}
          </div>
          <div className="mb-2 mt-3 text-[10px] uppercase tracking-wide text-slate-500">Accent</div>
          <div className="grid grid-cols-5 gap-1.5">
            {ACCENTS.map((value) => (
              <button
                key={value}
                type="button"
                data-accent-option={value}
                aria-pressed={accent === value}
                aria-label={`Accent ${ACCENT_LABELS[value]}`}
                title={ACCENT_LABELS[value]}
                onClick={() => setAccent(value)}
                className={`accent-swatch flex h-9 items-center justify-center rounded-lg border text-[10px] ${
                  accent === value
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-white/10 bg-white/[0.03] text-slate-500 hover:border-white/20 hover:text-slate-300"
                }`}
              >
                {ACCENT_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
