import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Link,
  useRouteError,
} from "react-router-dom";
import { Layout, Notifications, Settings } from "./workspace";
import { Login, Recovery, Join, Setup, AuthFrame } from "./auth";
import { Students, Student } from "./students";
import { Plan } from "./plans";
import { Invitations } from "./invitations";
import "./styles.css";
function reportWorkspaceError(kind) {
  const endpoint = import.meta.env.VITE_API_URL;
  if (import.meta.env.PROD && endpoint)
    fetch(new URL("/public/workspace-errors", endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
      credentials: "omit",
      keepalive: true,
    }).catch(() => {});
}
if (import.meta.env.PROD) {
  window.addEventListener("error", () => reportWorkspaceError("runtime"));
  window.addEventListener("unhandledrejection", () => reportWorkspaceError("promise"));
}

function RouteError() {
  const error = useRouteError();
  useEffect(() => { reportWorkspaceError("route"); }, [error]);
  return (
    <AuthFrame title="This page could not load">
      <p>Your saved work is unchanged. Try opening your workspace again.</p>
      <a className="button" href="/">
        Open workspace
      </a>
    </AuthFrame>
  );
}
const router = createBrowserRouter([
  { path: "/login", element: <Login />, errorElement: <RouteError /> },
  { path: "/setup", element: <Setup />, errorElement: <RouteError /> },
  { path: "/recover", element: <Recovery />, errorElement: <RouteError /> },
  { path: "/join", element: <Join />, errorElement: <RouteError /> },
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/students" replace /> },
      { path: "students", element: <Students /> },
      { path: "students/:id", element: <Student /> },
      { path: "plans/:id", element: <Plan /> },
      { path: "invitations", element: <Invitations /> },
      { path: "notifications", element: <Notifications /> },
      { path: "settings", element: <Settings /> },
      {
        path: "*",
        element: (
          <>
            <h1>Page not found</h1>
            <Link to="/students">Return to students</Link>
          </>
        ),
      },
    ],
  },
]);
createRoot(document.getElementById("root")).render(
  <RouterProvider router={router} />,
);
