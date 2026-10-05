import { useEffect, useState, useRef } from "react";
import { useStore } from "zustand";
import { createSession } from "./session.mjs";
export const session = createSession({
  url: import.meta.env.VITE_API_URL,
  development: import.meta.env.DEV,
});
export const useSession = () => useStore(session.store);
export function useResource(path) {
  const { user, school } = useSession();
  const key = `${user?.id}:${school?.school.id}:${path}`;
  const [state, setState] = useState({
      key: null,
      data: null,
      error: "",
      loading: true,
    }),
    [generation, setGeneration] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ key, data: null, error: "", loading: true });
    if (!path || !user || !school) {
      setState({ key, data: null, error: "", loading: false });
      return;
    }
    session.api
      .request(path, { school: school.school.id })
      .then((data) => {
        if (active) setState({ key, data, error: "", loading: false });
      })
      .catch((error) => {
        if (active)
          setState({ key, data: null, error: error.message, loading: false });
      });
    return () => {
      active = false;
    };
  }, [key, generation]);
  return {
    ...(state.key === key ? state : { data: null, error: "", loading: true }),
    reload: () => setGeneration((value) => value + 1),
  };
}
export function useAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(work) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      return await work();
    } catch (error) {
      setError(error.message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
