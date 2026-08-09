import { useEffect } from 'react';
import { useWorkbenchStore } from '../stores/workbenchStore';

/**
 * 全局 Tauri Event Bus 监听器。
 * - Tauri 模式：订阅 Rust `app.emit` 广播的 FILE_UPDATED / FILE_RESTORED / DOD_STATUS_CHANGED。
 * - 浏览器模式：订阅 workbench:* CustomEvent（同构，供 verify 使用）。
 * 组件卸载时自动 unlisten，防止内存泄漏。
 */
export function useTauriEvents(): void {
  const addEventLog = useWorkbenchStore((s) => s.addEventLog);
  const refreshMountedGitStatus = useWorkbenchStore((s) => s.refreshMountedGitStatus);
  const refreshTasks = useWorkbenchStore((s) => s.refreshTasks);
  const refreshQualityGate = useWorkbenchStore((s) => s.refreshQualityGate);

  useEffect(() => {
    const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    let unlistenUpdated: (() => void) | null = null;
    let unlistenRestored: (() => void) | null = null;
    let unlistenDod: (() => void) | null = null;
    let disposed = false;

    const handleUpdated = (filePath: string) => {
      addEventLog('IPC', `file_ops::file_updated -> ${filePath}`);
      void refreshMountedGitStatus();
      void refreshQualityGate();
    };
    const handleRestored = (backupId: string) => {
      addEventLog('INFO', `file_ops::file_restored -> ${backupId}`);
      void refreshMountedGitStatus();
    };
    const handleDodChanged = () => {
      addEventLog('INFO', 'actions::dod_status_changed -> refreshing counts');
      void refreshTasks();
    };

    if (isTauriRuntime) {
      import('@tauri-apps/api/event')
        .then(({ listen }) => {
          if (disposed) return;
          return Promise.all([
            listen<string>('FILE_UPDATED', (event) => handleUpdated(event.payload)),
            listen<string>('FILE_RESTORED', (event) => handleRestored(event.payload)),
            listen<string>('DOD_STATUS_CHANGED', () => handleDodChanged()),
          ]).then(([u1, u2, u3]) => {
            unlistenUpdated = u1;
            unlistenRestored = u2;
            unlistenDod = u3;
          });
        })
        .catch(() => {
          /* event api unavailable */
        });
    } else {
      const onUpdated = (event: Event) =>
        handleUpdated(String((event as CustomEvent).detail ?? ''));
      const onRestored = (event: Event) =>
        handleRestored(String((event as CustomEvent).detail ?? ''));
      const onDod = () => handleDodChanged();
      window.addEventListener('workbench:file-updated', onUpdated);
      window.addEventListener('workbench:file-restored', onRestored);
      window.addEventListener('workbench:dod-status-changed', onDod);
      unlistenUpdated = () => window.removeEventListener('workbench:file-updated', onUpdated);
      unlistenRestored = () => window.removeEventListener('workbench:file-restored', onRestored);
      unlistenDod = () => window.removeEventListener('workbench:dod-status-changed', onDod);
    }

    return () => {
      disposed = true;
      unlistenUpdated?.();
      unlistenRestored?.();
      unlistenDod?.();
    };
  }, [addEventLog, refreshMountedGitStatus, refreshTasks, refreshQualityGate]);
}
