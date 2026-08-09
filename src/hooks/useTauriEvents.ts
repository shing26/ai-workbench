import { useEffect } from 'react';
import { useWorkbenchStore } from '../stores/workbenchStore';

/**
 * 全局 Tauri Event Bus 监听器。
 * - Tauri 模式：订阅 Rust `app.emit` 广播的 FILE_UPDATED / FILE_RESTORED。
 * - 浏览器模式：订阅 events.ts 的 CustomEvent 主题（同构，供 verify 使用）。
 * 组件卸载时自动 unlisten，防止内存泄漏。
 */
export function useTauriEvents(): void {
  const addEventLog = useWorkbenchStore((s) => s.addEventLog);
  const refreshMountedGitStatus = useWorkbenchStore((s) => s.refreshMountedGitStatus);

  useEffect(() => {
    const isTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    let unlistenUpdated: (() => void) | null = null;
    let unlistenRestored: (() => void) | null = null;
    let disposed = false;

    const handleUpdated = (filePath: string) => {
      addEventLog('IPC', `file_ops::file_updated -> ${filePath}`);
      void refreshMountedGitStatus();
    };
    const handleRestored = (backupId: string) => {
      addEventLog('INFO', `file_ops::file_restored -> ${backupId}`);
      void refreshMountedGitStatus();
    };

    if (isTauriRuntime) {
      import('@tauri-apps/api/event')
        .then(({ listen }) => {
          if (disposed) return;
          return Promise.all([
            listen<string>('FILE_UPDATED', (event) => handleUpdated(event.payload)),
            listen<string>('FILE_RESTORED', (event) => handleRestored(event.payload)),
          ]).then(([u1, u2]) => {
            unlistenUpdated = u1;
            unlistenRestored = u2;
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
      window.addEventListener('workbench:file-updated', onUpdated);
      window.addEventListener('workbench:file-restored', onRestored);
      unlistenUpdated = () => window.removeEventListener('workbench:file-updated', onUpdated);
      unlistenRestored = () => window.removeEventListener('workbench:file-restored', onRestored);
    }

    return () => {
      disposed = true;
      unlistenUpdated?.();
      unlistenRestored?.();
    };
  }, [addEventLog, refreshMountedGitStatus]);
}
