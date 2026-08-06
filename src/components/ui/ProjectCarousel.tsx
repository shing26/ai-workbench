import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  GripVertical,
  Layers,
  Orbit,
  Palette,
  Pause,
  Play,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWorkbenchStore } from '../../stores/workbenchStore';

const CAROUSEL_MATERIALS = ['cyan', 'original', 'rain', 'chrome'] as const;
const CAROUSEL_SPEED_KEY = 'ai-workbench:carousel-speed:v1';

function relativePosition(index: number, position: number, count: number): number {
  if (count === 0) return 0;
  let delta = (((index - position) % count) + count) % count;
  if (delta > count / 2) delta -= count;
  return delta;
}

function resolveMaterial(material: string | undefined, index: number) {
  if (material && (CAROUSEL_MATERIALS as readonly string[]).includes(material)) {
    return material as (typeof CAROUSEL_MATERIALS)[number];
  }
  return CAROUSEL_MATERIALS[index % CAROUSEL_MATERIALS.length];
}

export default function ProjectCarousel() {
  const projects = useWorkbenchStore((s) => s.projects);
  const reorderProjects = useWorkbenchStore((s) => s.reorderProjects);
  const setProjectMaterial = useWorkbenchStore((s) => s.setProjectMaterial);
  const setProjects = useWorkbenchStore((s) => s.setProjects);
  const [mode, setMode] = useState<'orbit' | 'fan'>('orbit');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(() => {
    try {
      const raw = localStorage.getItem(CAROUSEL_SPEED_KEY);
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 4;
    } catch {
      return 4;
    }
  });
  const [index, setIndex] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const projectsRef = useRef(projects);
  const positionRef = useRef(0);
  const indexRef = useRef(0);
  const modeRef = useRef<'orbit' | 'fan'>('orbit');
  const pausedRef = useRef(false);
  const speedRef = useRef(speed);
  const dragRef = useRef<{
    id: string;
    pointerX: number;
    cardWidth: number;
    committed: boolean;
  } | null>(null);
  const dragSuppressClickRef = useRef(false);
  const reducedRef = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const frameRef = useRef<number | null>(null);

  const applyPositionsRef = useRef<() => void>(() => {});
  applyPositionsRef.current = () => {
    const count = projects.length;
    const position = positionRef.current;
    const currentMode = modeRef.current;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const delta = relativePosition(i, position, count);
      const abs = Math.abs(delta);
      let x: number;
      let y: number;
      let z: number;
      let rotY = 0;
      let rotZ = 0;
      let scale: number;
      let opacity: number;
      let zIndex: number;
      if (currentMode === 'orbit') {
        x = Math.sin(delta * 0.75) * 185;
        z = 30 - Math.min(abs, 3) * 46;
        y = -4 + Math.min(abs, 3) * 4;
        rotY = -Math.sign(delta) * Math.min(30, abs * 17);
        scale = Math.max(0.6, 1 - abs * 0.17);
        opacity = Math.max(0.2, 1 - abs * 0.33);
        zIndex = Math.round(30 - abs * 8);
      } else {
        x = -34 + delta * 62;
        z = 24 - Math.min(abs, 4) * 7;
        y = 2 + Math.min(abs, 4) * 2;
        rotZ = -Math.sign(delta) * Math.min(34, abs * 10);
        scale = abs < 0.05 ? 1.06 : Math.max(0.78, 0.94 - abs * 0.045);
        opacity = Math.max(0.3, 1 - abs * 0.16);
        zIndex = Math.round(60 - abs * 3);
      }
      card.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), ${z}px) rotateX(0deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`;
      card.style.opacity = String(opacity);
      card.style.zIndex = String(zIndex);
      const selected = abs < 0.05;
      card.dataset.carouselSelected = String(selected);
      card.setAttribute('aria-selected', String(selected));
    });
  };

  useEffect(() => {
    if (projects.length === 0) return;
    const clamped = Math.min(indexRef.current, projects.length - 1);
    positionRef.current = clamped;
    indexRef.current = clamped;
    setIndex(clamped);
    applyPositionsRef.current();
  }, [projects.length]);

  useEffect(() => {
    applyPositionsRef.current();
  }, [mode, projects]);

  projectsRef.current = projects;

  useEffect(() => {
    speedRef.current = speed;
    try {
      localStorage.setItem(CAROUSEL_SPEED_KEY, String(speed));
    } catch {
      // storage unavailable
    }
  }, [speed]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reducedRef.current = media.matches;
      if (media.matches) setPlaying(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reducedRef.current || !playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(32, now - last);
      last = now;
      if (!pausedRef.current) {
        positionRef.current += elapsed * 0.00055 * speedRef.current;
        const count = projects.length;
        if (count > 0) {
          const rounded = Math.round(positionRef.current);
          const nextIndex = ((rounded % count) + count) % count;
          if (nextIndex !== indexRef.current) {
            indexRef.current = nextIndex;
            setIndex(nextIndex);
          }
        }
        applyPositionsRef.current();
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [playing, projects.length]);

  const go = (delta: number) => {
    const count = projects.length;
    if (count === 0) return;
    const nextIndex = (((indexRef.current + delta) % count) + count) % count;
    positionRef.current = nextIndex;
    indexRef.current = nextIndex;
    setIndex(nextIndex);
    applyPositionsRef.current();
  };

  const setCarouselMode = (nextMode: 'orbit' | 'fan') => {
    modeRef.current = nextMode;
    setMode(nextMode);
    positionRef.current = indexRef.current;
    applyPositionsRef.current();
  };

  const startDrag = (id: string, pointerX: number) => {
    const card = cardRefs.current.find((element, i) => element && projects[i]?.id === id);
    if (!card) return;
    dragRef.current = {
      id,
      pointerX,
      cardWidth: Math.max(120, card.getBoundingClientRect().width),
      committed: false,
    };
    setDragId(id);
    pausedRef.current = true;
  };

  const moveDrag = (pointerX: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const from = projectsRef.current.findIndex((project) => project.id === drag.id);
    if (from < 0) return;
    const delta = pointerX - drag.pointerX;
    const shift = Math.round(delta / drag.cardWidth);
    if (shift === 0 || drag.committed) return;
    const to = Math.max(0, Math.min(projectsRef.current.length - 1, from + shift));
    if (to === from) return;
    const next = [...projectsRef.current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    drag.committed = true;
    drag.pointerX = pointerX;
    setProjects(next);
    const targetIndex = to;
    positionRef.current = targetIndex;
    indexRef.current = targetIndex;
    setIndex(targetIndex);
    requestAnimationFrame(() => {
      dragRef.current = dragRef.current ? { ...dragRef.current, committed: false } : null;
      applyPositionsRef.current();
    });
  };

  const endDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragId(null);
    pausedRef.current = false;
    if (!drag) return;
    dragSuppressClickRef.current = true;
    void reorderProjects(projectsRef.current.map((project) => project.id));
    requestAnimationFrame(applyPositionsRef.current);
  };

  const selected = projects[index] ?? null;

  return (
    <div data-project-carousel className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            aria-label="Orbit mode"
            aria-pressed={mode === 'orbit'}
            data-carousel-mode="orbit"
            onClick={() => setCarouselMode('orbit')}
            className="flex h-6 items-center gap-1 rounded-md px-2 text-[9px] text-slate-400 transition-colors hover:text-slate-200 aria-pressed:bg-emerald-500/15 aria-pressed:text-emerald-300"
          >
            <Orbit size={10} /> Orbit
          </button>
          <button
            type="button"
            aria-label="Fan mode"
            aria-pressed={mode === 'fan'}
            data-carousel-mode="fan"
            onClick={() => setCarouselMode('fan')}
            className="flex h-6 items-center gap-1 rounded-md px-2 text-[9px] text-slate-400 transition-colors hover:text-slate-200 aria-pressed:bg-emerald-500/15 aria-pressed:text-emerald-300"
          >
            <Layers size={10} /> Fan
          </button>
        </div>
        <button
          type="button"
          aria-label="Toggle carousel autoplay"
          aria-pressed={playing}
          data-carousel-playing={String(playing)}
          data-carousel-play
          onClick={() => setPlaying((value) => !value)}
          className="flex h-6 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[9px] text-slate-400 transition-colors hover:border-emerald-500/30 hover:text-emerald-300 aria-pressed:border-emerald-500/30 aria-pressed:text-emerald-300"
        >
          {playing ? <Pause size={10} /> : <Play size={10} />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <label className="flex h-6 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[9px] text-slate-400">
          <Gauge size={10} className="text-slate-500" />
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            aria-label="Carousel speed"
            data-carousel-speed
            className="h-1 w-20 accent-emerald-500"
          />
          <span data-carousel-speed-value className="min-w-5 text-center font-mono text-slate-500">
            {speed}
          </span>
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous project"
            data-carousel-prev
            onClick={() => go(-1)}
            disabled={projects.length <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={13} />
          </button>
          <span data-carousel-index className="min-w-9 text-center text-[9px] text-slate-500">
            {projects.length === 0 ? '0 / 0' : `${index + 1} / ${projects.length}`}
          </span>
          <button
            type="button"
            aria-label="Next project"
            data-carousel-next
            onClick={() => go(1)}
            disabled={projects.length <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
      <div
        ref={sceneRef}
        data-carousel-scene
        data-carousel-scene-mode={mode}
        data-carousel-dragging={String(dragId !== null)}
        data-carousel-order={projects.map((project) => project.name).join(',')}
        tabIndex={0}
        aria-roledescription="project carousel"
        onWheel={(event) => {
          if (event.deltaY > 0) go(1);
          else if (event.deltaY < 0) go(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') go(1);
          else if (event.key === 'ArrowLeft') go(-1);
        }}
        onPointerEnter={() => {
          pausedRef.current = true;
        }}
        onPointerLeave={() => {
          pausedRef.current = false;
        }}
        onFocusCapture={() => {
          pausedRef.current = true;
        }}
        onBlurCapture={() => {
          pausedRef.current = false;
        }}
        onPointerMove={(event) => {
          if (dragRef.current) moveDrag(event.clientX);
        }}
        onPointerUp={() => {
          if (dragRef.current) endDrag();
        }}
        onPointerCancel={() => {
          if (dragRef.current) endDrag();
        }}
        className="project-carousel-scene h-[190px] w-full rounded-xl border border-white/5 bg-white/[0.015] outline-none"
      >
        {projects.map((project, i) => (
          <button
            key={project.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            type="button"
            aria-label={`View project ${project.name}`}
            data-carousel-card
            data-carousel-project={project.name}
            data-carousel-material={resolveMaterial(project.material, i)}
            data-carousel-material-memory={project.material || 'auto'}
            onClick={() => {
              if (dragSuppressClickRef.current) {
                dragSuppressClickRef.current = false;
                return;
              }
              positionRef.current = i;
              indexRef.current = i;
              setIndex(i);
              applyPositionsRef.current();
            }}
            className="project-carousel-card"
          >
            <span
              data-carousel-drag-handle
              aria-hidden="true"
              className="absolute left-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.06] text-slate-500"
              onPointerDown={(event) => {
                event.stopPropagation();
                startDrag(project.id, event.clientX);
              }}
            >
              <GripVertical size={10} />
            </span>
            <span className="relative z-10 flex h-full flex-col items-start justify-end p-2 text-left">
              <span className="w-full truncate text-[10px] font-semibold text-slate-100">
                {project.name}
              </span>
              <span className="w-full truncate text-[8px] text-slate-400">{project.status}</span>
              <span className="mt-1 text-[9px] text-emerald-300">
                ${project.revenue.toFixed(2)}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div
        data-carousel-details
        className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5 text-[9px] text-slate-400"
      >
        {selected ? (
          <>
            <span className="font-medium text-slate-200">{selected.name}</span>
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5">{selected.status}</span>
            <span className="text-emerald-300">${selected.revenue.toFixed(2)}</span>
            <span className="flex items-center gap-1" data-carousel-material-controls>
              <Palette size={10} className="text-slate-500" />
              <button
                type="button"
                data-carousel-material-auto
                aria-pressed={!selected.material}
                onClick={() => void setProjectMaterial(selected.id, '')}
                className="h-5 rounded-md border border-white/10 bg-white/[0.03] px-1.5 text-[8px] text-slate-400 transition-colors hover:text-slate-200 aria-pressed:border-emerald-500/30 aria-pressed:text-emerald-300"
              >
                Auto
              </button>
              {CAROUSEL_MATERIALS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  data-carousel-material-option={preset}
                  aria-label={`Set ${selected.name} material to ${preset}`}
                  aria-pressed={selected.material === preset}
                  onClick={() => void setProjectMaterial(selected.id, preset)}
                  className="flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] transition-colors hover:border-white/25 aria-pressed:border-white/40 aria-pressed:bg-white/[0.08]"
                >
                  <span className={`carousel-material-swatch carousel-material-swatch-${preset}`} />
                </button>
              ))}
            </span>
            <span className="max-w-48 truncate text-slate-600">
              {selected.path || 'No local path'}
            </span>
          </>
        ) : (
          <span className="text-slate-600">No projects yet</span>
        )}
      </div>
    </div>
  );
}
