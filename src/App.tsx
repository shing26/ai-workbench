import { useEffect } from 'react';
import AppDock from './components/layout/AppDock';
import AppHeader from './components/layout/AppHeader';
import AppInspector from './components/layout/AppInspector';
import ToastHost from './components/ui/Toast';
import ViewRouter from './components/ViewRouter';
import { useActiveThrottle } from './hooks/useActiveThrottle';
import * as db from './lib/db';
import { useThemeStore } from './stores/themeStore';
import { useWorkbenchStore } from './stores/workbenchStore';

export default function App() {
  const initTheme = useThemeStore((s) => s.init);
  const init = useWorkbenchStore((s) => s.init);
  const restoreWorkspace = useWorkbenchStore((s) => s.restoreWorkspace);
  const refreshSystem = useWorkbenchStore((s) => s.refreshSystem);
  const reportError = useWorkbenchStore((s) => s.reportError);

  useEffect(() => {
    void restoreWorkspace().then((ok) => {
      if (!ok) void init();
    });
  }, [restoreWorkspace, init]);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useActiveThrottle(
    () => {
      void refreshSystem();
    },
    3000,
    10000,
  );

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db
      .listenClipboardUpdated(() => {
        if (!disposed) void refreshSystem();
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    const onError = (event: ErrorEvent) => {
      void reportError(
        'frontend',
        event.message || 'Uncaught error',
        event.error?.stack ?? null,
        'error',
      );
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      void reportError('frontend', reason.message, reason.stack ?? null, 'error');
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      disposed = true;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      unlisten();
    };
  }, [refreshSystem, reportError]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#101014] text-slate-200">
      <AppDock />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <div className="relative flex min-h-0 flex-1">
          <ViewRouter />
          <AppInspector />
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
