import test from "node:test";
import assert from "node:assert/strict";
import { createSession } from "../src/session.mjs";
const profile = {
  id: "user",
  name: "Teacher",
  memberships: [
    { role: "TEACHER", school: { id: "one", name: "School One" } },
    { role: "TEACHER", school: { id: "two", name: "School Two" } },
  ],
};
const response = (value) =>
  new Response(JSON.stringify(value), { status: 200 });
test("missing and insecure production API origins fail closed", () => {
  for (const url of [
    undefined,
    "http://example.test",
    "https://example.test/api",
    "https://user:pass@example.test",
  ])
    assert.ok(createSession({ url }).store.getState().configurationError);
});
test("sign-in loads memberships and stores no bearer or refresh token in the UI store", async () => {
  const session = createSession({
    url: "https://api.example.test",
    send: async (url) =>
      response(
        url.endsWith("/me")
          ? profile
          : { accessToken: "secret-access", refreshToken: "secret-refresh" },
      ),
  });
  await session.signIn(" Teacher@Example.test ", "example-password");
  assert.equal(session.store.getState().school.school.id, "one");
  const state = JSON.stringify(session.store.getState());
  assert.equal(state.includes("secret-"), false);
  assert.equal(session.store.getState().busy, false);
  session.chooseSchool("two");
  assert.equal(session.store.getState().school.school.id, "two");
  assert.throws(() => session.chooseSchool("foreign"));
});
test("first-school setup signs in and keeps session tokens outside the UI store", async () => {
  const seen = [];
  const session = createSession({
    url: "https://api.example.test",
    send: async (url, options = {}) => {
      seen.push([new URL(url).pathname, JSON.parse(options.body || "{}")]);
      return response(
        url.endsWith("/me")
          ? profile
          : { accessToken: "secret-access", refreshToken: "secret-refresh" },
      );
    },
  });
  await session.setupSchool({
    setupCode: "setup-code-with-entropy",
    schoolName: "School One",
    country: "GH",
    timezone: "Africa/Accra",
    name: "Teacher",
    email: "teacher@example.test",
    password: "a-long-test-password",
  });
  assert.equal(seen[0][0], "/auth/bootstrap");
  assert.equal(session.store.getState().school.school.id, "one");
  const state = JSON.stringify(session.store.getState());
  assert.equal(state.includes("secret-"), false);
  assert.equal(session.store.getState().busy, false);
});
test("profile lookup failure removes the partial login and stops the loading state", async () => {
  const session = createSession({
    url: "https://api.example.test",
    send: async (url) =>
      url.endsWith("/me")
        ? new Response(JSON.stringify({ error: "Profile unavailable" }), {
            status: 503,
          })
        : response({ accessToken: "access", refreshToken: "refresh" }),
  });
  await assert.rejects(
    session.signIn("teacher@example.test", "test-password"),
    /Profile unavailable/,
  );
  assert.equal(session.store.getState().user, null);
  assert.equal(session.store.getState().busy, false);
});
test("a delayed profile response cannot restore a signed-out account", async () => {
  let deliver, ready;
  const reached = new Promise((resolve) => (ready = resolve));
  const session = createSession({
    url: "https://api.example.test",
    send: async (url) => {
      if (url.endsWith("/me")) {
        ready();
        return new Promise(
          (resolve) => (deliver = () => resolve(response(profile))),
        );
      }
      return response({ accessToken: "access", refreshToken: "refresh" });
    },
  });
  const pending = session.signIn("teacher@example.test", "test-password");
  await reached;
  await session.signOut();
  deliver();
  await assert.rejects(pending, /Session changed/);
  assert.equal(session.store.getState().user, null);
});
test("logging out clears private UI state even when the server is unreachable", async () => {
  const session = createSession({
    url: "https://api.example.test",
    send: async (url) => {
      if (url.endsWith("/auth/logout")) throw new Error("Offline");
      return response(
        url.endsWith("/me")
          ? profile
          : { accessToken: "access", refreshToken: "refresh" },
      );
    },
  });
  await session.signIn("teacher@example.test", "test-password");
  session.store.setState({ dirty: true, saving: true });
  await assert.rejects(session.signOut());
  assert.equal(session.store.getState().user, null);
  assert.equal(session.store.getState().school, null);
  assert.equal(session.store.getState().dirty, false);
});
