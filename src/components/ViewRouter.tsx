import { useWorkbenchStore } from "../stores/workbenchStore";
import AIStudioView from "../views/AIStudioView";
import ProjectsView from "../views/ProjectsView";
import KnowledgeView from "../views/KnowledgeView";
import ActionsView from "../views/ActionsView";
import SystemView from "../views/SystemView";

const views = {
  "ai-studio": AIStudioView,
  projects: ProjectsView,
  knowledge: KnowledgeView,
  actions: ActionsView,
  system: SystemView,
} as const;

export default function ViewRouter() {
  const activeView = useWorkbenchStore((s) => s.activeView);
  const View = views[activeView];

  return (
    <main data-view={activeView} className="canvas-ambient min-w-0 flex-1 overflow-hidden">
      <div key={activeView} className="view-enter h-full w-full">
        <View />
      </div>
    </main>
  );
}
