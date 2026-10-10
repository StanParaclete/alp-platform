import React, { useMemo, useState } from "react";
import { Copy, Send } from "lucide-react";
import { session, useSession, useResource, useAction } from "./runtime";
import {
  canInvite,
  invitationMessage,
  invitationRoles,
  invitationStatus,
  needsLearners,
  toggleLearner,
} from "../../../03-app/src/invitations.mjs";
import {
  Badge,
  Button,
  ErrorText,
  Field,
  Heading,
  Pager,
  Status,
  dateText,
} from "./ui";

const defaultRole = "TEACHER";

export function Invitations() {
  const { school } = useSession(),
    allowed = canInvite(school?.role);
  const [email, setEmail] = useState(""),
    [role, setRole] = useState(defaultRole),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [selectedLearners, setSelectedLearners] = useState([]),
    [created, setCreated] = useState(null);
  const action = useAction(),
    copyAction = useAction(),
    invitations = useResource(allowed ? `/v1/invitations?offset=${offset}` : null),
    learnerSearch = useMemo(() => query.trim(), [query]),
    learners = useResource(
      allowed && needsLearners(role)
        ? `/v1/students?q=${encodeURIComponent(learnerSearch)}&offset=0`
        : null,
    );
  const roleLabel =
    invitationRoles.find(([id]) => id === role)?.[1] || role.replaceAll("_", " ");
  const selectedIds = selectedLearners.map((item) => item.id);
  const message = created
    ? invitationMessage(created, school.school.name)
    : "";
  function resetAfterCreate(item) {
    setCreated(item);
    setEmail("");
    setRole(defaultRole);
    setQuery("");
    setSelectedLearners([]);
    invitations.reload();
  }
  async function create(event) {
    event.preventDefault();
    if (!allowed) return;
    await action.run(async () => {
      const item = await session.api.request("/v1/invitations", {
        method: "POST",
        school: school.school.id,
        body: {
          email: email.trim().toLowerCase(),
          role,
          studentIds: needsLearners(role) ? selectedIds : [],
        },
      });
      resetAfterCreate(item);
    });
  }
  async function revoke(item) {
    await action.run(async () => {
      await session.api.request(`/v1/invitations/${item.id}/revoke`, {
        method: "PATCH",
        school: school.school.id,
      });
      invitations.reload();
    });
  }
  if (!allowed) {
    return (
      <>
        <Heading title="Invitations" />
        <p>School administrator access is required to invite staff and families.</p>
      </>
    );
  }
  return (
    <>
      <Heading eyebrow={school.school.name} title="School invitations">
        <span className="muted">Invite staff, specialists, students and families.</span>
      </Heading>
      <ErrorText>{action.error || copyAction.error}</ErrorText>
      {created ? (
        <section className="invite-code" aria-labelledby="invitation-created">
          <div>
            <p className="eyebrow">Invitation created</p>
            <h2 id="invitation-created">{created.email}</h2>
            <p>
              Share this code privately. It expires{" "}
              {new Date(created.expiresAt).toLocaleString()}.
            </p>
          </div>
          <textarea readOnly value={message} aria-label="Invitation message" />
          <div className="actions">
            <Button
              icon={Copy}
              disabled={copyAction.busy}
              onClick={() =>
                copyAction.run(async () => {
                  await navigator.clipboard.writeText(message);
                })
              }
            >
              Copy invitation
            </Button>
            <Button secondary onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        </section>
      ) : null}
      <section>
        <h2>Create invitation</h2>
        <form onSubmit={create}>
          <div className="form-grid">
            <Field
              label="Account email"
              type="email"
              value={email}
              maxLength={254}
              required
              autoComplete="email"
              disabled={action.busy}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Field
              label="Role"
              value={role}
              disabled={action.busy}
              onChange={(event) => {
                setRole(event.target.value);
                setSelectedLearners([]);
              }}
            >
              {invitationRoles.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Field>
          </div>
          {needsLearners(role) ? (
            <div className="learner-picker">
              <div className="section-heading">
                <div>
                  <h3>Linked learners</h3>
                  <p className="muted">
                    {role === "STUDENT"
                      ? "Student accounts must be linked to exactly one learner."
                      : "Family accounts must be linked to at least one learner."}
                  </p>
                </div>
                <Badge>{selectedLearners.length} selected</Badge>
              </div>
              <Field
                label="Search learners"
                type="search"
                value={query}
                maxLength={160}
                disabled={action.busy}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Status resource={learners} />
              <div className="selection-list">
                {selectedLearners.map((item) => (
                  <label key={item.id} className="check-row">
                    <input
                      type="checkbox"
                      checked
                      disabled={action.busy}
                      onChange={() =>
                        setSelectedLearners((values) =>
                          toggleLearner(values, item, role),
                        )
                      }
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>Grade {item.grade || "not set"}</small>
                    </span>
                  </label>
                ))}
                {learners.data?.items
                  .filter((item) => !selectedIds.includes(item.id))
                  .map((item) => (
                    <label key={item.id} className="check-row">
                      <input
                        type="checkbox"
                        disabled={action.busy || selectedLearners.length >= 50}
                        checked={false}
                        onChange={() =>
                          setSelectedLearners((values) =>
                            toggleLearner(values, item, role),
                          )
                        }
                      />
                      <span>
                        <strong>{item.name}</strong>
                        <small>Grade {item.grade || "not set"}</small>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          ) : null}
          <div className="actions">
            <Button
              type="submit"
              icon={Send}
              disabled={
                action.busy ||
                !email.trim() ||
                (needsLearners(role) && !selectedLearners.length)
              }
            >
              {action.busy ? "Creating..." : `Invite ${roleLabel}`}
            </Button>
          </div>
        </form>
      </section>
      <section>
        <div className="section-heading">
          <h2>Invitation history</h2>
          {invitations.data ? (
            <span className="muted">
              {invitations.data.total}{" "}
              {invitations.data.total === 1 ? "invitation" : "invitations"}
            </span>
          ) : null}
        </div>
        <Status resource={invitations} />
        {invitations.data?.items.map((item) => {
          const status = invitationStatus(item);
          return (
            <article className="list-row invitation-row" key={item.id}>
              <span>
                <strong>{item.email}</strong>
                <small>
                  {invitationRoles.find(([id]) => id === item.role)?.[1] ||
                    item.role.replaceAll("_", " ")}
                  {" / "}
                  Created {dateText(item.createdAt)}
                  {" / "}
                  Expires {dateText(item.expiresAt)}
                </small>
              </span>
              <Badge>{status}</Badge>
              {status === "Pending" ? (
                <Button secondary disabled={action.busy} onClick={() => revoke(item)}>
                  Revoke
                </Button>
              ) : null}
            </article>
          );
        })}
        {invitations.data?.total === 0 ? (
          <p className="empty">No invitations have been created yet.</p>
        ) : null}
        {invitations.data ? (
          <Pager
            offset={offset}
            total={invitations.data.total}
            onChange={setOffset}
          />
        ) : null}
      </section>
    </>
  );
}
