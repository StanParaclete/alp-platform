import React, { useEffect, useState, useCallback } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useBlocker,
  useBeforeUnload,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Users,
  Bell,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  Sun,
  Moon,
  Check,
} from "lucide-react";
import { session, useSession, useResource, useAction } from "./runtime";
import {
  Brand,
  Credit,
  Button,
  Field,
  Heading,
  IconButton,
  ErrorText,
  Status,
  Dialog,
  dateText,
} from "./ui";

export function Layout() {
  const state = useSession(),
    navigate = useNavigate(),
    location = useLocation();
  const [open, setOpen] = useState(false),
    [dark, setDark] = useState(false),
    [error, setError] = useState("");
  const blocker = useBlocker(state.dirty || state.saving);
  useBeforeUnload(
    useCallback((event) => {
      if (session.store.getState().dirty || session.store.getState().saving) {
        event.preventDefault();
        event.returnValue = "";
      }
    }, []),
  );
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  function canLeave() {
    const current = session.store.getState();
    if (current.saving) {
      setError("Please wait for your plan to finish saving.");
      return false;
    }
    if (
      current.dirty &&
      !window.confirm("Discard unsaved changes and leave this plan?")
    )
      return false;
    session.store.setState({ dirty: false });
    return true;
  }
  if (!state.user) return <Navigate to="/login" replace />;
  return (
    <div className="workspace">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Brand />
        <nav aria-label="Workspace">
          {[
            ["/students", "Students", Users],
            ["/notifications", "Notifications", Bell],
            ["/settings", "Settings", SettingsIcon],
          ].map(([to, label, Icon]) => (
            <NavLink key={to} to={to}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span>{state.user.name}</span>
          <small>
            {state.school?.role.replaceAll("_", " ") || "School access pending"}
          </small>
          <button
            onClick={async () => {
              if (!canLeave()) return;
              try {
                await session.signOut();
              } catch {
                window.alert(
                  "Signed out of this browser. The server could not be reached to revoke the session.",
                );
              }
            }}
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <IconButton
            label={open ? "Close navigation" : "Open navigation"}
            icon={Menu}
            className="icon-button mobile-menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          />
          <div className="school-picker">
            <Field
              label="School"
              value={state.school?.school.id || ""}
              onChange={(event) => {
                if (canLeave()) {
                  session.chooseSchool(event.target.value);
                  navigate("/students");
                }
              }}
            >
              {!state.school ? (
                <option value="">School access pending</option>
              ) : null}
              {state.user.memberships.map((item) => (
                <option key={item.school.id} value={item.school.id}>
                  {item.school.name}
                </option>
              ))}
            </Field>
          </div>
          <IconButton
            label={dark ? "Use light theme" : "Use dark theme"}
            icon={dark ? Sun : Moon}
            onClick={() => setDark(!dark)}
          />
        </header>
        <main id="main" className="workspace-main">
          <ErrorText>{error}</ErrorText>
          {!state.school && location.pathname !== "/settings" ? (
            <>
              <Heading title="School access pending" />
              <p>
                Your account is not linked to a school. Contact your school
                administrator.
              </p>
              <Link className="button" to="/join">
                Accept a school invitation
              </Link>
            </>
          ) : (
            <Outlet key={`${state.user.id}:${state.school?.school.id}`} />
          )}
        </main>
        <Credit />
      </div>
      {blocker.state === "blocked" ? (
        <Dialog
          title={state.saving ? "Saving your plan" : "Unsaved changes"}
          onClose={() => blocker.reset()}
        >
          <p>
            {state.saving
              ? "Wait for the save to finish before leaving."
              : "Leave this plan and discard unsaved changes?"}
          </p>
          <div className="actions">
            <Button onClick={() => blocker.reset()}>Stay on plan</Button>
            <Button
              secondary
              disabled={state.saving}
              onClick={() => blocker.proceed()}
            >
              Discard and leave
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
export function Notifications() {
  const { school } = useSession(),
    resource = useResource("/v1/notifications"),
    action = useAction();
  return (
    <>
      <Heading title="Notifications" />
      <ErrorText>{action.error}</ErrorText>
      <Status resource={resource} />
      {resource.data?.map((item) => (
        <article className="notification" key={item.id}>
          <div>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <small>{dateText(item.createdAt)}</small>
          </div>
          {item.readAt ? (
            <span className="muted">Read</span>
          ) : (
            <Button
              secondary
              icon={Check}
              disabled={action.busy}
              onClick={() =>
                action.run(async () => {
                  await session.api.request(`/v1/notifications/${item.id}`, {
                    method: "PATCH",
                    school: school.school.id,
                  });
                  resource.reload();
                })
              }
            >
              Mark read
            </Button>
          )}
        </article>
      ))}
      {resource.data?.length === 0 ? (
        <p className="empty">You're all caught up. No notifications.</p>
      ) : null}
    </>
  );
}
export function Settings() {
  const { user, school } = useSession();
  return (
    <>
      <Heading title="Settings" />
      <section>
        <h2>Account</h2>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>School role</dt>
            <dd>
              {school?.role.replaceAll("_", " ") || "Pending school access"}
            </dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>Active in this tab</dd>
          </div>
        </dl>
        <Link className="button secondary" to="/join">
          Join another school
        </Link>
      </section>
      <section>
        <h2>Schools</h2>
        {user.memberships.map((item) => (
          <div className="list-row" key={item.school.id}>
            <strong>{item.school.name}</strong>
            <span>{item.school.country}</span>
            <span className="muted">{item.role.replaceAll("_", " ")}</span>
          </div>
        ))}
      </section>
    </>
  );
}
