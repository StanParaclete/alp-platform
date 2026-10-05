import React, {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Save, History, Check, MessageSquare } from "lucide-react";
import { session, useSession, useResource, useAction } from "./runtime";
import {
  sections,
  staffRoles,
  adminRoles,
} from "../../../03-app/src/sections.mjs";
import { createDraft } from "../../../03-app/src/draft.mjs";
import {
  Heading,
  Field,
  Button,
  Status,
  ErrorText,
  Badge,
  Dialog,
  dateText,
} from "./ui";

export function Plan() {
  const { id } = useParams(),
    { school } = useSession(),
    resource = useResource(`/v1/plans/${id}`),
    action = useAction();
  const controller = useMemo(
    () =>
      createDraft((body) =>
        session.api.request(`/v1/plans/${id}`, {
          method: "PATCH",
          school: school.school.id,
          body,
        }),
      ),
    [id, school.school.id],
  );
  const state = useSyncExternalStore(
      controller.subscribe,
      controller.getSnapshot,
    ),
    plan = state.plan;
  const [selected, setSelected] = useState("studentInformation"),
    [history, setHistory] = useState(false),
    [comments, setComments] = useState(false);
  useEffect(() => {
    if (resource.data) controller.load(resource.data);
  }, [resource.data, controller]);
  useEffect(() => {
    session.store.setState({ dirty: state.dirty, saving: state.saving });
    return () => session.store.setState({ dirty: false, saving: false });
  }, [state.dirty, state.saving]);
  useEffect(() => {
    if (!state.dirty || state.saving || state.error) return;
    const timer = setTimeout(() => controller.save().catch(() => {}), 1500);
    return () => clearTimeout(timer);
  }, [state, controller]);
  const staff = staffRoles.includes(school.role),
    admin = adminRoles.includes(school.role),
    editable = staff && plan && !["APPROVED", "ARCHIVED"].includes(plan.status);
  async function transition(status) {
    if (
      status === "APPROVED" &&
      !window.confirm(
        "Approve this ALP and make it visible to linked families and students?",
      )
    )
      return;
    await controller.save(status);
  }
  return (
    <>
      <Status resource={resource} />
      <ErrorText>{state.error || action.error}</ErrorText>
      {plan && resource.data && !resource.loading ? (
        <>
          <Link className="back-link" to={`/students/${plan.studentId}`}>
            <ArrowLeft size={16} />
            Student profile
          </Link>
          <Heading
            eyebrow={`Learning plan / Revision ${plan.revision}`}
            title={plan.title}
          >
            {staff ? (
              <>
                <Button
                  secondary
                  icon={History}
                  disabled={action.busy || state.saving}
                  onClick={() => setHistory(true)}
                >
                  History
                </Button>
                <Button
                  secondary
                  icon={MessageSquare}
                  onClick={() => setComments(true)}
                >
                  Comments
                </Button>
              </>
            ) : null}
          </Heading>
          <div className="plan-status">
            <Badge>{plan.status}</Badge>
            <span>
              {sections.filter(([key]) => plan.sections[key]?.trim()).length} /
              13 sections complete
            </span>
            {staff ? (
              <span role="status">
                {state.saving
                  ? "Saving..."
                  : state.error
                    ? "Save failed"
                    : state.dirty
                      ? "Unsaved changes"
                      : "All changes saved"}
              </span>
            ) : null}
          </div>
          {editable ? (
            <div className="form-grid plan-meta">
              <Field
                label="Plan title"
                value={plan.title}
                maxLength={180}
                disabled={action.busy}
                onChange={(event) =>
                  controller.change({ title: event.target.value })
                }
              />
              <Field
                label="Review date"
                type="date"
                value={plan.reviewDate?.slice(0, 10) || ""}
                disabled={action.busy}
                onChange={(event) =>
                  controller.change({ reviewDate: event.target.value || null })
                }
              />
            </div>
          ) : null}
          <div className="builder">
            <nav className="section-nav" aria-label="Plan sections">
              {sections.map(([key, label], index) => (
                <button
                  key={key}
                  aria-current={selected === key ? "step" : undefined}
                  onClick={() => setSelected(key)}
                >
                  <span className="section-number">
                    {plan.sections[key]?.trim() ? (
                      <Check size={15} aria-label="Complete" />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  {label}
                </button>
              ))}
            </nav>
            <section className="section-editor">
              <h2>{sections.find(([key]) => key === selected)[1]}</h2>
              {editable ? (
                <Field
                  label="Section content"
                  multiline
                  value={plan.sections[selected] || ""}
                  maxLength={30000}
                  disabled={action.busy}
                  onChange={(event) =>
                    controller.change({
                      sections: {
                        ...controller.getSnapshot().plan.sections,
                        [selected]: event.target.value,
                      },
                    })
                  }
                />
              ) : (
                <p className="pre-wrap">
                  {plan.sections[selected] || "Not recorded"}
                </p>
              )}
              <div className="actions">
                {editable ? (
                  <Button
                    icon={Save}
                    disabled={action.busy || state.saving || !state.dirty}
                    onClick={() => action.run(() => controller.save())}
                  >
                    Save changes
                  </Button>
                ) : null}
                {state.error ? (
                  <Button
                    secondary
                    disabled={state.saving}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Discard unsaved edits and load the latest saved plan?",
                        )
                      )
                        resource.reload();
                    }}
                  >
                    Load latest version
                  </Button>
                ) : null}
              </div>
            </section>
          </div>
          <div className="review-actions">
            {staff && plan.status === "DRAFT" ? (
              <Button
                disabled={action.busy || state.saving}
                onClick={() => action.run(() => transition("IN_REVIEW"))}
              >
                Submit for review
              </Button>
            ) : null}
            {admin && plan.status === "IN_REVIEW" ? (
              <>
                <Button
                  disabled={action.busy || state.saving}
                  onClick={() => action.run(() => transition("APPROVED"))}
                >
                  Approve ALP
                </Button>
                <Button
                  secondary
                  disabled={action.busy || state.saving}
                  onClick={() => action.run(() => transition("DRAFT"))}
                >
                  Return to draft
                </Button>
              </>
            ) : null}
            {admin && ["APPROVED", "ARCHIVED"].includes(plan.status) ? (
              <Button
                secondary
                disabled={action.busy}
                onClick={() => action.run(() => transition("DRAFT"))}
              >
                Reopen as draft
              </Button>
            ) : null}
          </div>
          <Goals
            plan={plan}
            controller={controller}
            reload={resource.reload}
            disabled={
              state.saving || state.dirty || !!state.error || action.busy
            }
            staff={staff}
          />
          {history ? (
            <Dialog title="Version history" onClose={() => setHistory(false)}>
              <HistoryList id={id} />
            </Dialog>
          ) : null}
          {comments ? (
            <Dialog title="Staff comments" onClose={() => setComments(false)}>
              <Comments id={id} section={selected} />
            </Dialog>
          ) : null}
        </>
      ) : null}
    </>
  );
}
const emptyGoal = {
  description: "",
  baseline: "",
  target: "",
  unit: "",
  direction: "increase",
  dueDate: "",
};
function Goals({ plan, controller, reload, disabled, staff }) {
  const { school } = useSession(),
    action = useAction(),
    [adding, setAdding] = useState(false),
    [goal, setGoal] = useState(emptyGoal),
    [recording, setRecording] = useState(null),
    [observation, setObservation] = useState({ value: "", note: "" });
  return (
    <section className="goals">
      <div className="section-heading">
        <h2>Goals and progress</h2>
        {staff && plan.status === "DRAFT" ? (
          <Button secondary disabled={disabled} onClick={() => setAdding(true)}>
            Add goal
          </Button>
        ) : null}
      </div>
      <ErrorText>{action.error}</ErrorText>
      {!plan.goals?.length ? <p className="empty">No goals recorded.</p> : null}
      {plan.goals?.map((item) => (
        <article className="goal" key={item.id}>
          <div className="section-heading">
            <h3>{item.description}</h3>
            {staff ? (
              <Button
                secondary
                disabled={disabled || action.busy}
                onClick={() => {
                  setRecording(item);
                  setObservation({ value: "", note: "" });
                }}
              >
                Record progress
              </Button>
            ) : null}
          </div>
          <p>
            Baseline: {item.baseline} {item.unit}{" "}
            <span className="muted">/</span> Target: {item.target} {item.unit}{" "}
            <span className="muted">/</span> Due {dateText(item.dueDate)}
          </p>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">
                Progress for {item.description}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Observed</th>
                  <th scope="col">Value</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {item.progress?.map((point) => (
                  <tr key={point.id}>
                    <td>{dateText(point.observedAt)}</td>
                    <td>
                      {point.value} {item.unit}
                    </td>
                    <td className="pre-wrap">{point.note || "Not recorded"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!item.progress?.length ? (
            <p className="muted">No observations recorded.</p>
          ) : null}
        </article>
      ))}
      {adding ? (
        <Dialog
          title="Add goal"
          onClose={() => {
            if (!action.busy) setAdding(false);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              action.run(async () => {
                await session.api.request(`/v1/plans/${plan.id}/goals`, {
                  method: "POST",
                  school: school.school.id,
                  body: {
                    ...goal,
                    baseline: Number(goal.baseline),
                    target: Number(goal.target),
                    revision: controller.getSnapshot().plan.revision,
                  },
                });
                setGoal(emptyGoal);
                setAdding(false);
                reload();
              });
            }}
          >
            <ErrorText>{action.error}</ErrorText>
            <fieldset disabled={action.busy}>
              {[
                ["description", "Goal", "text"],
                ["baseline", "Baseline", "number"],
                ["target", "Target", "number"],
                ["unit", "Unit", "text"],
                ["dueDate", "Due date", "date"],
              ].map(([key, label, type]) => (
                <Field
                  key={key}
                  label={label}
                  type={type}
                  step={type === "number" ? "any" : undefined}
                  required
                  minLength={key === "description" ? 10 : undefined}
                  maxLength={key === "description" ? 3000 : 60}
                  value={goal[key]}
                  onChange={(event) =>
                    setGoal({ ...goal, [key]: event.target.value })
                  }
                />
              ))}
              <Field
                label="Target direction"
                value={goal.direction}
                onChange={(event) =>
                  setGoal({ ...goal, direction: event.target.value })
                }
              >
                <option value="increase">Increase</option>
                <option value="decrease">Decrease</option>
              </Field>
              <Button type="submit" disabled={action.busy}>
                {action.busy ? "Saving..." : "Save goal"}
              </Button>
            </fieldset>
          </form>
        </Dialog>
      ) : null}
      {recording ? (
        <Dialog
          title="Record progress"
          onClose={() => {
            if (!action.busy) setRecording(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              action.run(async () => {
                await session.api.request(
                  `/v1/goals/${recording.id}/progress`,
                  {
                    method: "POST",
                    school: school.school.id,
                    body: {
                      value: Number(observation.value),
                      note: observation.note,
                      observedAt: new Date().toISOString(),
                    },
                  },
                );
                setRecording(null);
                reload();
              });
            }}
          >
            <ErrorText>{action.error}</ErrorText>
            <Field
              label={`Observed value (${recording.unit})`}
              type="number"
              step="any"
              required
              value={observation.value}
              disabled={action.busy}
              onChange={(event) =>
                setObservation({ ...observation, value: event.target.value })
              }
            />
            <Field
              label="Observation note"
              multiline
              maxLength={5000}
              value={observation.note}
              disabled={action.busy}
              onChange={(event) =>
                setObservation({ ...observation, note: event.target.value })
              }
            />
            <Button type="submit" disabled={action.busy}>
              {action.busy ? "Recording..." : "Save observation"}
            </Button>
          </form>
        </Dialog>
      ) : null}
    </section>
  );
}
function HistoryList({ id }) {
  const resource = useResource(`/v1/plans/${id}/versions`);
  return (
    <>
      <Status resource={resource} />
      {resource.data?.map((item) => (
        <details key={item.id}>
          <summary>
            Revision {item.revision} / {dateText(item.createdAt)}
          </summary>
          <h3>{item.snapshot.title}</h3>
          {sections.map(([key, label]) => (
            <section key={key}>
              <h4>{label}</h4>
              <p className="pre-wrap">
                {item.snapshot.sections?.[key] || "Not recorded"}
              </p>
            </section>
          ))}
        </details>
      ))}
    </>
  );
}
function Comments({ id, section }) {
  const { school, user } = useSession(),
    resource = useResource(`/v1/plans/${id}/comments`),
    action = useAction(),
    [body, setBody] = useState(""),
    [selected, setSelected] = useState(section);
  return (
    <>
      <Status resource={resource} />
      {resource.data?.map((item) => (
        <article className="comment" key={item.id}>
          <strong>{sections.find(([key]) => key === item.section)?.[1]}</strong>
          <small>
            {item.authorId === user.id ? "You" : "Staff"} /{" "}
            {dateText(item.createdAt)}
          </small>
          <p className="pre-wrap">{item.body}</p>
        </article>
      ))}
      {resource.data?.length === 0 ? <p>No staff comments.</p> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action.run(async () => {
            await session.api.request(`/v1/plans/${id}/comments`, {
              method: "POST",
              school: school.school.id,
              body: { section: selected, body },
            });
            setBody("");
            resource.reload();
          });
        }}
      >
        <ErrorText>{action.error}</ErrorText>
        <Field
          label="Plan section"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={action.busy}
        >
          {sections.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Field>
        <Field
          label="Comment"
          required
          multiline
          maxLength={5000}
          value={body}
          disabled={action.busy}
          onChange={(event) => setBody(event.target.value)}
        />
        <Button type="submit" disabled={action.busy || !body.trim()}>
          Add comment
        </Button>
      </form>
    </>
  );
}
