import { useEffect } from "react";
import AppDock from "./components/layout/AppDock";
import AppHeader from "./components/layout/AppHeader";
import AppInspector from "./components/layout/AppInspector";
import ViewRouter from "./components/ViewRouter";
import { useWorkbenchStore } from "./stores/workbenchStore";

export default function App() {
  const init = useWorkbenchStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

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
    </div>
  );
}
