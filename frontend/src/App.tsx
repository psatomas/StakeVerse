import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";

type View = "landing" | "app";

// Minimal, dependency-free navigation between the two screens the spec
// requires to stay distinct: the landing page (explains the protocol) and
// the dashboard (interacts with it). `#app` is the one reserved hash value;
// every other hash (including the landing page's own in-page section
// anchors, e.g. #system) resolves to the landing view.
function getView(): View {
  return window.location.hash === "#app" ? "app" : "landing";
}

export default function App() {
  const [view, setView] = useState<View>(getView);

  useEffect(() => {
    function onHashChange() {
      setView(getView());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return view === "app" ? <Dashboard /> : <Landing />;
}
