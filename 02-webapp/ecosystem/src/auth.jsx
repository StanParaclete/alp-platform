import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LogIn, ArrowRight, KeyRound } from "lucide-react";
import { session, useSession, useAction } from "./runtime";
import { resetInput } from "../../../03-app/src/recovery.mjs";
import { Brand, Button, Field, ErrorText, Credit } from "./ui";
import community from "../../public/assets/community-2026-09/geralt-children-10186220_1920.jpg";
export function AuthFrame({ title, children }) {
  return (
    <div className="auth">
      <header>
        <Brand />
      </header>
      <main id="main" className="auth-main">
        <div className="auth-form">
          <p className="eyebrow">Your school workspace</p>
          <h1>{title}</h1>
          {children}
        </div>
        <figure className="auth-photo">
          <img src={community} alt="A teacher and children learning together" />
          <figcaption>
            Accelerating growth.
            <br />
            Supporting every learner.
          </figcaption>
        </figure>
      </main>
      <Credit />
    </div>
  );
}
export function Login() {
  const state = useSession(),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const action = useAction();
  if (state.user) return <Navigate to="/" replace />;
  return (
    <AuthFrame title="Welcome to ALP">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action.run(() => session.signIn(email, password));
        }}
      >
        <ErrorText>{state.configurationError || action.error}</ErrorText>
        <Field
          label="Email address"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={254}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          maxLength={256}
        />
        <Link className="text-link" to="/recover">
          Forgot password?
        </Link>
        <Button
          type="submit"
          icon={LogIn}
          disabled={action.busy || !!state.configurationError}
        >
          {action.busy ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <div className="auth-links">
        <Link to="/join">
          Join a school <ArrowRight size={16} />
        </Link>
        <Link to="/setup">
          Set up first school <ArrowRight size={16} />
        </Link>
        <a href="https://growwithalp.com/">Back to website</a>
      </div>
    </AuthFrame>
  );
}
export function Setup() {
  const state = useSession(),
    action = useAction(),
    navigate = useNavigate();
  const [values, setValues] = useState({
    setupCode: "",
    schoolName: "",
    country: "GH",
    timezone: "Africa/Accra",
    name: "",
    email: "",
    password: "",
  });
  if (state.user) return <Navigate to="/" replace />;
  const field = (key) => ({
    value: values[key],
    onChange: (event) => setValues({ ...values, [key]: event.target.value }),
    disabled: action.busy,
  });
  return (
    <AuthFrame title="Set up ALP">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action.run(async () => {
            await session.setupSchool({
              ...values,
              setupCode: values.setupCode.trim(),
              schoolName: values.schoolName.trim(),
              country: values.country.trim().toUpperCase(),
              timezone: values.timezone.trim(),
              name: values.name.trim(),
              email: values.email.trim().toLowerCase(),
            });
            navigate("/");
          });
        }}
      >
        <ErrorText>{state.configurationError || action.error}</ErrorText>
        <Field
          label="Setup code"
          type="password"
          autoComplete="off"
          required
          minLength={16}
          maxLength={256}
          {...field("setupCode")}
        />
        <Field
          label="School / institution"
          required
          maxLength={200}
          autoComplete="organization"
          {...field("schoolName")}
        />
        <div className="form-grid">
          <Field
            label="Country code"
            required
            maxLength={2}
            pattern="[A-Za-z]{2}"
            autoCapitalize="characters"
            {...field("country")}
          />
          <Field
            label="Time zone"
            required
            maxLength={100}
            autoComplete="off"
            {...field("timezone")}
          />
        </div>
        <Field
          label="Administrator name"
          required
          maxLength={160}
          autoComplete="name"
          {...field("name")}
        />
        <Field
          label="Administrator email"
          type="email"
          required
          maxLength={254}
          autoComplete="username"
          {...field("email")}
        />
        <Field
          label="Administrator password"
          type="password"
          required
          minLength={12}
          maxLength={256}
          autoComplete="new-password"
          {...field("password")}
        />
        <Button
          type="submit"
          icon={KeyRound}
          disabled={action.busy || !!state.configurationError}
        >
          {action.busy ? "Creating workspace..." : "Create school workspace"}
        </Button>
        <Link to="/login">Back to sign in</Link>
      </form>
    </AuthFrame>
  );
}
export function Recovery() {
  const { user, configurationError } = useSession(),
    action = useAction();
  const [mode, setMode] = useState("request"),
    [values, setValues] = useState({
      email: "",
      code: "",
      password: "",
      confirmPassword: "",
    }),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const field = (key) => ({
    value: values[key],
    onChange: (event) => setValues({ ...values, [key]: event.target.value }),
    disabled: action.busy,
  });
  return (
    <AuthFrame title={done ? "Password changed" : "Password recovery"}>
      {done ? (
        <>
          <p>Previous sign-in sessions have been revoked.</p>
          <Link to="/login" className="button">
            Sign in
          </Link>
        </>
      ) : (
        <>
          <div className="segments">
            {[
              ["request", "Request code"],
              ["reset", "Reset password"],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={mode === key}
                disabled={action.busy}
                onClick={() => {
                  setMode(key);
                  setMessage("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              action.run(async () => {
                if (mode === "request") {
                  const result = await session.api.requestPasswordRecovery(
                    values.email.trim().toLowerCase(),
                  );
                  setMessage(result.message);
                  setMode("reset");
                } else {
                  await session.api.resetPassword(resetInput(values));
                  setValues({
                    email: "",
                    code: "",
                    password: "",
                    confirmPassword: "",
                  });
                  setDone(true);
                }
              });
            }}
          >
            <ErrorText>{configurationError || action.error}</ErrorText>
            {message ? <p role="status">{message}</p> : null}
            <Field
              label="Account email"
              type="email"
              autoComplete="username"
              required
              {...field("email")}
            />
            {mode === "reset" ? (
              <>
                <Field
                  label="Recovery code"
                  type="password"
                  autoComplete="off"
                  required
                  maxLength={96}
                  {...field("code")}
                />
                <Field
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                  {...field("password")}
                />
                <Field
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                  {...field("confirmPassword")}
                />
              </>
            ) : null}
            <Button
              type="submit"
              disabled={action.busy || !!configurationError}
            >
              {action.busy
                ? "Working..."
                : mode === "request"
                  ? "Request recovery code"
                  : "Change password"}
            </Button>
            <Link to="/login">Back to sign in</Link>
          </form>
        </>
      )}
    </AuthFrame>
  );
}
export function Join() {
  const { user, configurationError } = useSession(),
    action = useAction(),
    navigate = useNavigate();
  const [values, setValues] = useState({
      email: "",
      name: "",
      password: "",
      token: "",
    }),
    [done, setDone] = useState(false);
  const field = (key) => ({
    value: values[key],
    onChange: (event) => setValues({ ...values, [key]: event.target.value }),
    disabled: action.busy,
  });
  return (
    <AuthFrame title={done ? "School invitation accepted" : "Join a school"}>
      {done ? (
        <Link className="button" to="/login">
          Sign in
        </Link>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            action.run(async () => {
              if (user) {
                await session.api.request("/auth/invitations/accept", {
                  method: "POST",
                  body: { token: values.token.trim() },
                });
                await session.reloadProfile();
                navigate("/");
              } else {
                await session.api.registerInvitation({
                  ...values,
                  email: values.email.trim().toLowerCase(),
                  token: values.token.trim(),
                });
                setValues({ email: "", name: "", password: "", token: "" });
                setDone(true);
              }
            });
          }}
        >
          <ErrorText>{configurationError || action.error}</ErrorText>
          {user ? (
            <p>Joining as {user.email}</p>
          ) : (
            <>
              <Field
                label="Full name"
                required
                maxLength={120}
                autoComplete="name"
                {...field("name")}
              />
              <Field
                label="Invited email"
                type="email"
                required
                autoComplete="username"
                {...field("email")}
              />
              <Field
                label="Create password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
                {...field("password")}
              />
            </>
          )}
          <Field
            label="Invitation code"
            type="password"
            autoComplete="off"
            required
            {...field("token")}
          />
          <Button type="submit" disabled={action.busy || !!configurationError}>
            {action.busy ? "Joining..." : "Accept invitation"}
          </Button>
          <Link to={user ? "/settings" : "/login"}>
            {user
              ? "Back to settings"
              : "Already have an account? Sign in first"}
          </Link>
        </form>
      )}
    </AuthFrame>
  );
}
