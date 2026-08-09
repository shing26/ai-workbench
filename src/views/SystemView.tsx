import { useCallback, useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import * as db from '../lib/db';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { useViewState } from '../stores/viewState';
import SystemStage from '../components/system/SystemStage';
import SystemRail from '../components/system/SystemRail';
import SystemDrawer from '../components/system/SystemDrawer';

export default function SystemView() {
  const providers = useWorkbenchStore((s) => s.providers);
  const [health, setHealth] = useState<Record<string, db.ProviderHealth>>({});
  const [heartbeat, setHeartbeat] = useState<db.ProviderHeartbeatSnapshot | null>(null);
  const [drawerOpen, setDrawerOpen] = useViewState<boolean>('system', 'drawerOpen', true);

  const checkAll = useCallback(async () => {
    const entries = await Promise.all(
      providers.map(async (p) => [p.id, await db.checkProviderHealth(p.id)] as const),
    );
    setHealth(Object.fromEntries(entries));
  }, [providers]);

  useEffect(() => {
    void checkAll();
  }, [checkAll]);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db.runProviderHeartbeat().then((snapshot) => {
      if (!disposed) setHeartbeat(snapshot);
    });
    void db
      .listenProviderHeartbeat((snapshot) => {
        if (!disposed) setHeartbeat(snapshot);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten();
    };
  }, []);

  return (
    <div className="view-enter relative flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-slate-200">System &amp; Automation</h1>
            <p className="text-[11px] text-slate-500">Stage · Rail · Fold 三层信息架构</p>
          </div>
          <button
            type="button"
            data-system-drawer-toggle
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="Toggle system config"
            className={`flex h-8 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 text-[10px] transition-[background-color,color] duration-[120ms] ease-out motion-reduce:transition-none ${
              drawerOpen
                ? 'text-emerald-300 hover:border-emerald-500/30'
                : 'text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300'
            }`}
          >
            <SlidersHorizontal size={12} />
            {drawerOpen ? 'Hide config' : 'Config'}
          </button>
        </div>
        <SystemStage />
        <SystemRail health={health} heartbeat={heartbeat} />
      </div>
      <SystemDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        health={health}
        heartbeat={heartbeat}
        setHealth={setHealth}
        setHeartbeat={setHeartbeat}
      />
    </div>
  );
}
