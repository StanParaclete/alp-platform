export function planFields(plan) {
  return { title: plan.title, sections: { ...plan.sections }, reviewDate: plan.reviewDate?.slice(0,10) || null, status: plan.status };
}
const stamp = plan => JSON.stringify(planFields(plan));
export function createDraft(savePlan) {
  let state = { plan: null, dirty: false, saving: false, error: '' }, acknowledged = '', inFlight = null;
  const listeners = new Set();
  function publish(next) { state = { ...state, ...next }; for (const listener of listeners) listener(); }
  return {
    getSnapshot: () => state,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    load(plan) { if (state.saving) throw new Error('Wait for the current save to finish.'); acknowledged = stamp(plan); publish({ plan, dirty: false, error: '' }); },
    change(fields) { if (!state.plan) return; const plan = { ...state.plan, ...fields }; publish({ plan, dirty: stamp(plan) !== acknowledged }); },
    async save(status) {
      if (inFlight) return inFlight;
      if (!state.plan) return;
      const captured = { ...planFields(state.plan), status: status || state.plan.status, revision: state.plan.revision };
      publish({ saving: true, error: '' });
      inFlight = (async () => {
        try {
          const saved = await savePlan(captured);
          acknowledged = stamp(captured);
          const plan = { ...state.plan, revision: saved.revision, status: saved.status };
          publish({ plan, dirty: stamp(plan) !== acknowledged, saving: false });
          return saved;
        } catch (error) { publish({ saving: false, error: error.message }); throw error; }
        finally { inFlight = null; }
      })();
      return inFlight;
    },
  };
}
