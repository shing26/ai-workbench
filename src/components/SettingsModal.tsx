import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const setVaultPath = useSettingsStore((s) => s.setVaultPath);
  const [input, setInput] = useState(vaultPath);

  const handleSave = () => {
    const trimmed = input.trim();
    if (trimmed) {
      setVaultPath(trimmed);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
            }}
            className="relative w-[480px] p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-5 rounded-full"
                  style={{ background: 'var(--color-accent)' }}
                />
                <h2
                  className="text-sm font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Settings
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-[var(--radius-sm)] transition-colors hover:rotate-90 duration-200"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-4">
              {/* Obsidian Vault Path — card section */}
              <div
                className="p-4 rounded-[var(--radius-md)]"
                style={{
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Folder size={14} style={{ color: 'var(--color-accent)' }} />
                  <label
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Obsidian Vault Path
                  </label>
                </div>
                <div className="flex gap-2">
                  <div
                    className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[var(--radius-sm)]"
                    style={{
                      background: 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="D:\Obsidian\MyVault"
                      className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
                  Enter the absolute path to your Obsidian vault folder. Notes will be saved here as
                  .md files.
                </p>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={!input.trim()}
                className="w-full py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-all duration-150 active:scale-[0.98]"
                style={{
                  background: input.trim() ? 'var(--color-accent)' : 'var(--color-surface-hover)',
                  color: input.trim() ? '#0a0a0a' : 'var(--color-text-muted)',
                  cursor: input.trim() ? 'pointer' : 'default',
                }}
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
