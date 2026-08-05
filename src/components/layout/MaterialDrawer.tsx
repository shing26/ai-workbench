import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MATERIAL_KEY = 'ai-workbench:material-settings:v1';
const MATERIAL_PRESETS = ['cyan', 'original', 'rain', 'chrome'] as const;

type MaterialSettings = {
  preset: (typeof MATERIAL_PRESETS)[number];
  opacity: number;
  blur: number;
};

const DEFAULT_SETTINGS: MaterialSettings = {
  preset: 'cyan',
  opacity: 0.3,
  blur: 18,
};

function loadSettings(): MaterialSettings {
  try {
    const raw = localStorage.getItem(MATERIAL_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<MaterialSettings>;
    const preset = MATERIAL_PRESETS.includes(parsed.preset as MaterialSettings['preset'])
      ? (parsed.preset as MaterialSettings['preset'])
      : DEFAULT_SETTINGS.preset;
    return {
      preset,
      opacity:
        typeof parsed.opacity === 'number'
          ? Math.min(0.7, Math.max(0.1, parsed.opacity))
          : DEFAULT_SETTINGS.opacity,
      blur:
        typeof parsed.blur === 'number'
          ? Math.min(40, Math.max(8, parsed.blur))
          : DEFAULT_SETTINGS.blur,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function applySettings(settings: MaterialSettings) {
  document.documentElement.dataset.materialGlobal = settings.preset;
  document.documentElement.style.setProperty('--material-opacity-base', String(settings.opacity));
  document.documentElement.style.setProperty('--material-blur-base', `${settings.blur}px`);
}

export default function MaterialDrawer() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<MaterialSettings>(DEFAULT_SETTINGS);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    applySettings(loaded);
  }, []);

  useEffect(() => {
    applySettings(settings);
    try {
      localStorage.setItem(MATERIAL_KEY, JSON.stringify(settings));
    } catch {
      // Persistence is best-effort; the live styles still apply.
    }
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next) triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-material-settings-open
        aria-expanded={open}
        aria-controls="material-drawer"
        onClick={toggle}
        className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
      >
        <SlidersHorizontal size={14} />
        <span className="hidden md:inline">Material</span>
      </button>
      <div
        data-material-overlay
        className={`material-overlay ${open ? 'open' : ''}`}
        aria-hidden={!open}
        onClick={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
      />
      <aside
        id="material-drawer"
        data-material-drawer
        role="dialog"
        aria-modal="true"
        aria-label="Material settings"
        aria-hidden={!open}
        className={`material-drawer ${open ? 'open' : ''}`}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
          <div>
            <span className="text-[8px] uppercase tracking-normal text-emerald-400/80">
              Surface
            </span>
            <h2 className="text-xs font-semibold text-slate-200">Material settings</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close material settings"
            data-material-drawer-close
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:text-slate-200"
          >
            <X size={13} />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div
            data-material-preview
            className={`material-preview material-card material-${settings.preset}`}
          />
          <label className="block">
            <span className="mb-1.5 block text-[10px] text-slate-500">Preset</span>
            <select
              data-material-preset
              value={settings.preset}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  preset: event.target.value as MaterialSettings['preset'],
                }))
              }
              className="h-8 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
            >
              {MATERIAL_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Glow opacity</span>
              <span data-material-opacity-value className="text-slate-300">
                {settings.opacity.toFixed(2)}
              </span>
            </span>
            <input
              type="range"
              data-material-opacity
              min="0.1"
              max="0.7"
              step="0.05"
              value={settings.opacity}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  opacity: Number(event.target.value),
                }))
              }
              className="h-1.5 w-full accent-emerald-400"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Blur radius</span>
              <span data-material-blur-value className="text-slate-300">
                {settings.blur}px
              </span>
            </span>
            <input
              type="range"
              data-material-blur
              min="8"
              max="40"
              step="2"
              value={settings.blur}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  blur: Number(event.target.value),
                }))
              }
              className="h-1.5 w-full accent-emerald-400"
            />
          </label>
          <span data-material-settings-status className="block text-[9px] text-slate-600">
            Applied live and saved locally
          </span>
        </div>
      </aside>
    </>
  );
}
