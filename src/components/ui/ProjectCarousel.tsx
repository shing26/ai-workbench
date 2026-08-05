import { ChevronLeft, ChevronRight, Layers, Orbit, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWorkbenchStore } from '../../stores/workbenchStore';

const CAROUSEL_MATERIALS = ['cyan', 'original', 'rain', 'chrome'] as const;

function relativePosition(index: number, position: number, count: number): number {
  if (count === 0) return 0;
  let delta = (((index - position) % count) + count) % count;
  if (delta > count / 2) delta -= count;
  return delta;
}

export default function ProjectCarousel() {
  const projects = useWorkbenchStore((s) => s.projects);
  const [mode, setMode] = useState<'orbit' | 'fan'>('orbit');
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const positionRef = useRef(0);
  const indexRef = useRef(0);
  const modeRef = useRef<'orbit' | 'fan'>('orbit');
  const pausedRef = useRef(false);
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
        positionRef.current += elapsed * 0.0022;
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
            data-carousel-material={CAROUSEL_MATERIALS[i % CAROUSEL_MATERIALS.length]}
            onClick={() => {
              positionRef.current = i;
              indexRef.current = i;
              setIndex(i);
              applyPositionsRef.current();
            }}
            className="project-carousel-card"
          >
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
