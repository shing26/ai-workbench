import Sidebar from "./components/Sidebar";
import ViewRouter from "./components/ViewRouter";
import CommandPalette from "./components/CommandPalette";
import SettingsModal from "./components/SettingsModal";
import { useState, useEffect } from "react";
import { useChatStore } from "./stores/chatStore";
import { useConnectionStore } from "./stores/connectionStore";
import { useVibeStore } from "./stores/vibeStore";
import { useAppStore } from "./stores/appStore";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    (window as any).__openSettings = () => setSettingsOpen(true);

    // Session breadcrumb: restore context on mount
    const saved = localStorage.getItem("ai-workbench:session");
    if (saved) {
      try {
        const state = JSON.parse(saved);
        useConnectionStore.getState().addEvent({
          source: "system",
          title: "Welcome back",
          body: "Continue where you left off",
          targetView: state.activeView || "chat",
        });
        if (state.activeView) useAppStore.getState().setActiveView(state.activeView);
        if (state.chatDraft) {
          const chatState = useChatStore.getState();
          if (!chatState.activeThreadId) chatState.createThread();
        }
      } catch {}
      localStorage.removeItem("ai-workbench:session");
    }

    // Cooling recall: scan for inactive threads
    setTimeout(() => {
      const chatState = useChatStore.getState();
      const threeDays = 72 * 60 * 60 * 1000;
      const now = Date.now();
      for (const thread of chatState.threads) {
        if (thread.messages.length === 0) continue;
        const lastMsg = thread.messages[thread.messages.length - 1];
        if (now - lastMsg.timestamp > threeDays) {
          useConnectionStore.getState().addEvent({
            source: "system",
            title: "Still working on \"" + thread.title + "\"?",
            body: "This thread has been inactive for 3+ days",
            targetView: "chat",
            targetId: thread.id,
          });
        }
      }
    }, 1000);

    // Session breadcrumb: save context on beforeunload
    const saveSession = () => {
      const appState = useAppStore.getState();
      const chatState = useChatStore.getState();
      const vibeState = useVibeStore.getState();
      localStorage.setItem("ai-workbench:session", JSON.stringify({
        activeView: appState.activeView,
        activeThreadId: chatState.activeThreadId,
        vibeIdea: vibeState.idea || null,
        vibePhase: vibeState.phase || null,
        savedAt: Date.now(),
      }));
    };
    window.addEventListener("beforeunload", saveSession);
    return () => {
      delete (window as any).__openSettings;
      window.removeEventListener("beforeunload", saveSession);
    };
  }, []);
  return (
    <div className="flex flex-col h-full w-full bg-[var(--color-bg-primary)]">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ViewRouter />
      </div>
      <CommandPalette />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
