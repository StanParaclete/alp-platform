import { createStore } from "zustand/vanilla";
import { apiOrigin, createApi } from "../../../03-app/src/api.mjs";

export function createSession({ url, development = false, send = fetch }) {
  const store = createStore(() => ({
    user: null,
    school: null,
    busy: false,
    error: "",
    configurationError: "",
    dirty: false,
    saving: false,
  }));
  let operation = 0,
    api;
  try {
    api = createApi({
      base: apiOrigin(url, development),
      send,
      onSession: async (value) => {
        if (!value) {
          operation++;
          store.setState({
            user: null,
            school: null,
            busy: false,
            dirty: false,
            saving: false,
          });
        }
      },
    });
  } catch {
    store.setState({
      configurationError:
        "This ALP workspace is not connected to its API. Contact your school administrator.",
    });
  }
  return {
    store,
    api,
    async signIn(email, password) {
      if (!api) throw new Error(store.getState().configurationError);
      const current = ++operation;
      store.setState({ busy: true, error: "", user: null, school: null });
      try {
        await api.login(email.trim().toLowerCase(), password);
        const user = await api.request("/me");
        if (current === operation)
          store.setState({ user, school: user.memberships[0] || null });
      } catch (error) {
        if (current === operation) {
          await api.logout().catch(() => {});
          store.setState({ error: error.message });
        }
        throw error;
      } finally {
        if (current === operation) store.setState({ busy: false });
      }
    },
    async reloadProfile() {
      const current = operation,
        user = await api.request("/me");
      if (current === operation)
        store.setState((state) => ({
          user,
          school:
            user.memberships.find(
              (item) => item.school.id === state.school?.school.id,
            ) ||
            user.memberships[0] ||
            null,
        }));
    },
    chooseSchool(id) {
      const school = store
        .getState()
        .user?.memberships.find((item) => item.school.id === id);
      if (!school) throw new Error("School access is not authorised.");
      store.setState({ school, dirty: false, saving: false });
    },
    async signOut() {
      operation++;
      store.setState({
        user: null,
        school: null,
        busy: false,
        dirty: false,
        saving: false,
      });
      await api?.logout();
    },
  };
}
