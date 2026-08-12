import { useEffect, useRef, useState } from 'react';
import { useWorkbenchStore } from '../stores/workbenchStore';
import AIStudioView from '../views/AIStudioView';
import DashboardView from '../views/DashboardView';
import ProjectsView from '../views/ProjectsView';
import KnowledgeView from '../views/KnowledgeView';
import ActionsView from '../views/ActionsView';

const views = {
  dashboard: DashboardView,
  'ai-studio': AIStudioView,
  projects: ProjectsView,
  knowledge: KnowledgeView,
  actions: ActionsView,
} as const;

type ViewId = keyof typeof views;

export default function ViewRouter() {
  const activeView = useWorkbenchStore((s) => s.activeView) as ViewId;
  const [mountedViews, setMountedViews] = useState<Set<ViewId>>(() => new Set([activeView]));
  const activeRef = useRef(activeView);
  activeRef.current = activeView;

  useEffect(() => {
    setMountedViews((prev) => {
      if (prev.has(activeView)) return prev;
      const next = new Set(prev);
      next.add(activeView);
      return next;
    });
  }, [activeView]);

  return (
    <main
      data-view={activeView}
      className="canvas-ambient bg-frost-mesh min-w-0 flex-1 overflow-hidden"
    >
      {(Object.keys(views) as ViewId[]).map((view) => {
        if (!mountedViews.has(view)) return null;
        const View = views[view];
        const hidden = view !== activeView;
        return (
          <div
            key={view}
            data-view-pane={view}
            className="view-enter h-full w-full"
            style={hidden ? { display: 'none' } : undefined}
            aria-hidden={hidden}
          >
            <View />
          </div>
        );
      })}
    </main>
  );
}
