import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "../stores/appStore";
import ChatView from "../views/ChatView";
import VibeCodingView from "../views/VibeCodingView";
import KnowledgeView from "../views/KnowledgeView";
import AutomationView from "../views/AutomationView";
import MonetizationView from "../views/MonetizationView";
import ConnectionsView from "../views/ConnectionsView";

const views: Record<string, React.ComponentType> = {
  chat: ChatView,
  "vibe-coding": VibeCodingView,
  knowledge: KnowledgeView,
  automation: AutomationView,
  monetization: MonetizationView,
  connections: ConnectionsView,
};

const pageTransition = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
};

export default function ViewRouter() {
  const activeView = useAppStore((s) => s.activeView);
  const View = views[activeView];

  return (
    <main className="flex-1 overflow-hidden bg-[var(--color-bg-primary)]">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={pageTransition.initial}
          animate={pageTransition.animate}
          exit={pageTransition.exit}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="h-full w-full"
        >
          <View />
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
