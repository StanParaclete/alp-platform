import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  ArrowLeft,
  MessageSquare,
  Pencil,
  ArrowUpRight,
} from "lucide-react";
import { session, useSession, useResource, useAction } from "./runtime";
import { staffRoles } from "../../../03-app/src/sections.mjs";
import {
  Heading,
  Field,
  Button,
  Status,
  ErrorText,
  Pager,
  Badge,
  Dialog,
  dateText,
} from "./ui";

const emptyStudent = {
  name: "",
  grade: "",
  dateOfBirth: "",
  supportLevel: "universal",
  categories: [],
  strengths: "",
  needs: "",
};
export function StudentForm({ initial = emptyStudent, onSave, onClose }) {
  const [values, setValues] = useState({
      ...initial,
      dateOfBirth: initial.dateOfBirth?.slice(0, 10) || "",
    }),
    [categories, setCategories] = useState(initial.categories.join(", "));
  const action = useAction();
  const field = (key) => ({
    value: values[key],
    onChange: (event) => setValues({ ...values, [key]: event.target.value }),
    disabled: action.busy,
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        action.run(async () => {
          await onSave({
            name: values.name.trim(),
            grade: values.grade.trim(),
            dateOfBirth: values.dateOfBirth || null,
            supportLevel: values.supportLevel,
            categories: categories
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            strengths: values.strengths,
            needs: values.needs,
          });
        });
      }}
    >
      <ErrorText>{action.error}</ErrorText>
      <Field
        label="Student name"
        required
        maxLength={160}
        autoComplete="off"
        {...field("name")}
      />
      <div className="form-grid">
        <Field
          label="Grade / year"
          required
          maxLength={40}
          {...field("grade")}
        />
        <Field label="Date of birth" type="date" {...field("dateOfBirth")} />
      </div>
      <Field label="Support level" {...field("supportLevel")}>
        {["universal", "targeted", "intensive"].map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </Field>
      <Field
        label="Learner categories (comma separated)"
        value={categories}
        maxLength={2400}
        disabled={action.busy}
        onChange={(event) => setCategories(event.target.value)}
      />
      <Field
        label="Strengths"
        multiline
        maxLength={10000}
        {...field("strengths")}
      />
      <Field label="Needs" multiline maxLength={10000} {...field("needs")} />
      <div className="actions">
        <Button type="submit" disabled={action.busy}>
          {action.busy ? "Saving..." : "Save student"}
        </Button>
        <Button secondary disabled={action.busy} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
export function Students() {
  const { school } = useSession(),
    navigate = useNavigate();
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [adding, setAdding] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  const resource = useResource(
      `/v1/students?q=${encodeURIComponent(search)}&offset=${offset}`,
    ),
    staff = staffRoles.includes(school.role);
  return (
    <>
      <Heading eyebrow={school.school.name} title="Students">
        {staff ? (
          <Button icon={Plus} onClick={() => setAdding(true)}>
            Add student
          </Button>
        ) : null}
      </Heading>
      <div className="toolbar">
        <Field
          label="Search students"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={160}
        />
        {resource.data ? (
          <span className="muted">
            {resource.data.total}{" "}
            {resource.data.total === 1 ? "student" : "students"}
          </span>
        ) : null}
      </div>
      <Status resource={resource} />
      {resource.data ? (
        <>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Student roster</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Grade / year</th>
                  <th scope="col">Support</th>
                  <th scope="col">Last updated</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <Link className="row-link" to={`/students/${item.id}`}>
                        <span className="initial" aria-hidden="true">
                          {item.name[0]}
                        </span>
                        {item.name}
                        <ArrowUpRight size={16} />
                      </Link>
                    </th>
                    <td>{item.grade || "Not set"}</td>
                    <td>
                      <Badge>{item.supportLevel}</Badge>
                    </td>
                    <td>{dateText(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!resource.data.total ? (
            <div className="empty">
              <h2>No students found</h2>
              <p>
                {search
                  ? "Try a different name."
                  : staff
                    ? "Add a student to begin their learning plan."
                    : "No learner records are linked to your account."}
              </p>
            </div>
          ) : null}
          <Pager
            offset={offset}
            total={resource.data.total}
            onChange={setOffset}
          />
        </>
      ) : null}
      {adding ? (
        <Dialog title="Add student" onClose={() => setAdding(false)}>
          <StudentForm
            onClose={() => setAdding(false)}
            onSave={async (body) => {
              const item = await session.api.request("/v1/students", {
                method: "POST",
                school: school.school.id,
                body,
              });
              setAdding(false);
              navigate(`/students/${item.id}`);
            }}
          />
        </Dialog>
      ) : null}
    </>
  );
}
export function Student() {
  const { id } = useParams(),
    { school } = useSession(),
    navigate = useNavigate(),
    action = useAction();
  const profile = useResource(`/v1/students/${id}`),
    plans = useResource(`/v1/students/${id}/plans`),
    [editing, setEditing] = useState(false),
    [messages, setMessages] = useState(false);
  const staff = staffRoles.includes(school.role);
  return (
    <>
      <Link className="back-link" to="/students">
        <ArrowLeft size={16} />
        Students
      </Link>
      <Status resource={profile} />
      <ErrorText>{action.error}</ErrorText>
      {profile.data ? (
        <>
          <Heading
            eyebrow={`Grade ${profile.data.grade || "not set"}`}
            title={profile.data.name}
          >
            <Button
              secondary
              icon={MessageSquare}
              onClick={() => setMessages(true)}
            >
              Messages
            </Button>
            {staff ? (
              <Button secondary icon={Pencil} onClick={() => setEditing(true)}>
                Edit student
              </Button>
            ) : null}
          </Heading>
          <div className="student-facts">
            <Badge>{profile.data.supportLevel}</Badge>
            <span>
              {profile.data.categories.join(" / ") || "No categories recorded"}
            </span>
            {staff ? (
              <span>Born {dateText(profile.data.dateOfBirth)}</span>
            ) : null}
          </div>
          <div className="profile-columns">
            <section>
              <h2>Strengths</h2>
              <p className="pre-wrap">
                {profile.data.strengths || "Not recorded"}
              </p>
            </section>
            <section>
              <h2>Needs</h2>
              <p className="pre-wrap">{profile.data.needs || "Not recorded"}</p>
            </section>
          </div>
          <section>
            <div className="section-heading">
              <h2>Learning plans</h2>
              {staff ? (
                <Button
                  icon={Plus}
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async () => {
                      const item = await session.api.request(
                        `/v1/students/${id}/plans`,
                        {
                          method: "POST",
                          school: school.school.id,
                          body: {
                            title: `ALP - ${profile.data.name}`.slice(0, 180),
                            sections: {
                              studentInformation: `${profile.data.name}\nGrade ${profile.data.grade}`,
                              strengths: profile.data.strengths,
                              needs: profile.data.needs,
                            },
                          },
                        },
                      );
                      navigate(`/plans/${item.id}`);
                    })
                  }
                >
                  {action.busy ? "Creating..." : "Create ALP"}
                </Button>
              ) : null}
            </div>
            <Status resource={plans} />
            {plans.data?.map((item) => (
              <Link key={item.id} className="list-row" to={`/plans/${item.id}`}>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    Revision {item.revision} / Updated{" "}
                    {dateText(item.updatedAt)}
                  </small>
                </span>
                <Badge>{item.status}</Badge>
                <ArrowUpRight size={18} />
              </Link>
            ))}
            {plans.data?.length === 0 ? (
              <p className="empty">No learning plans available.</p>
            ) : null}
          </section>
          {editing ? (
            <Dialog title="Edit student" onClose={() => setEditing(false)}>
              <StudentForm
                initial={profile.data}
                onClose={() => setEditing(false)}
                onSave={async (body) => {
                  await session.api.request(`/v1/students/${id}`, {
                    method: "PATCH",
                    school: school.school.id,
                    body,
                  });
                  setEditing(false);
                  profile.reload();
                }}
              />
            </Dialog>
          ) : null}
          {messages ? (
            <Dialog
              title={`Messages: ${profile.data.name}`}
              onClose={() => setMessages(false)}
            >
              <Messages studentId={id} />
            </Dialog>
          ) : null}
        </>
      ) : null}
    </>
  );
}
function Messages({ studentId }) {
  const { school, user } = useSession(),
    resource = useResource(`/v1/students/${studentId}/messages`),
    action = useAction(),
    [body, setBody] = useState("");
  return (
    <>
      <Status resource={resource} />
      <div className="messages">
        {resource.data?.map((item) => (
          <article key={item.id}>
            <div className="section-heading">
              <strong>
                {item.authorId === user.id ? "You" : "School community"}
              </strong>
              <time>{dateText(item.createdAt)}</time>
            </div>
            <p className="pre-wrap">{item.body}</p>
          </article>
        ))}
        {resource.data?.length === 0 ? <p>No messages yet.</p> : null}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          action.run(async () => {
            await session.api.request(`/v1/students/${studentId}/messages`, {
              method: "POST",
              school: school.school.id,
              body: { body },
            });
            setBody("");
            resource.reload();
          });
        }}
      >
        <ErrorText>{action.error}</ErrorText>
        <Field
          label="Message"
          multiline
          required
          maxLength={5000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={action.busy}
        />
        <Button type="submit" disabled={action.busy || !body.trim()}>
          {action.busy ? "Sending..." : "Send message"}
        </Button>
      </form>
    </>
  );
}
