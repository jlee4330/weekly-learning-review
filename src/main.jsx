import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
// The instructor dashboard lives behind a secret link: /#/dash/<DASHBOARD_KEY>
const Dashboard = lazy(() => import("./components/Dashboard"));
const dashKeyOf = (hash) => hash.match(/^#\/dash\/([^/]+)/)?.[1];
const dashKey = dashKeyOf(location.hash);
// Pasting the link into a tab that already shows the app only changes the fragment: switch views.
window.addEventListener("hashchange", () => { if (dashKeyOf(location.hash) !== dashKey) location.reload(); });
createRoot(document.getElementById("root")).render(
  dashKey ? <Suspense fallback={null}><Dashboard dashKey={dashKey} /></Suspense> : <App />,
);
