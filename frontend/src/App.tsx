import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Protocol from "./pages/Protocol";

type View = "landing" | "app" | "protocol";

// Minimal, dependency-free navigation between the three screens: the
// landing page (explains the protocol), the Protocol explorer (inspects
// live chain state), and the dashboard (interacts with it). `#app` and
// `#protocol` are the two reserved hash values.
//
// With only two views, "anything that isn't #app" could safely default to
// landing — that's what this used to do, and it happened to also be
// correct for Landing's own in-page anchors (e.g. #system) purely because
// landing was already the fallback. With three views that coincidence
// breaks: Protocol has its own in-page section anchors too, and an
// unrecognized hash must NOT reset the view out from under whichever page
// is already showing. So this takes the current view and only changes it
// on a recognized reserved value (or an explicit empty hash, used by
// "← Overview" links) — anything else is assumed to be an in-page anchor
// scroll within the page already active.
function resolveView(hash: string, current: View): View {
  if (hash === "#app") return "app";
  if (hash === "#protocol") return "protocol";
  if (hash === "" || hash === "#") return "landing";
  return current;
}

export default function App() {
  const [view, setView] = useState<View>(() =>
    resolveView(window.location.hash, "landing")
  );

  useEffect(() => {
    function onHashChange() {
      setView((current) => resolveView(window.location.hash, current));
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (view === "app") return <Dashboard />;
  if (view === "protocol") return <Protocol />;
  return <Landing />;
}
