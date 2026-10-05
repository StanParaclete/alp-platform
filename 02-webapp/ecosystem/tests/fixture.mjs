// Synthetic data is available only to the browser test runner, never to the app bundle.
import { randomUUID } from "node:crypto";
export function fixture() {
  const school = {
      id: randomUUID(),
      name: "ALP Synthetic School",
      country: "GH",
    },
    student = {
      id: randomUUID(),
      name: "Synthetic Learner",
      grade: "3",
      categories: ["Reading support"],
      supportLevel: "targeted",
      strengths: "Enjoys collaborative learning.",
      needs: "Structured reading practice.",
      updatedAt: new Date().toISOString(),
    },
    hidden = {
      id: randomUUID(),
      name: "Unlinked Learner",
      grade: "4",
      categories: [],
      supportLevel: "universal",
      updatedAt: new Date().toISOString(),
    };
  const teacher = {
      id: randomUUID(),
      name: "Synthetic Teacher",
      email: "browser-teacher@example.test",
      memberships: [{ role: "TEACHER", school }],
    },
    parent = {
      id: randomUUID(),
      name: "Synthetic Parent",
      email: "browser-parent@example.test",
      memberships: [{ role: "PARENT", school }],
    };
  let plan = null,
    revisionHistory = [],
    comments = [],
    observations = [],
    active = teacher;
  return {
    student,
    teacher,
    parent,
    async handle(route) {
      const request = route.request(),
        path = new URL(request.url()).pathname,
        method = request.method(),
        body = request.postDataJSON?.();
      let data = null,
        status = 200;
      if (path === "/auth/login") {
        active = body.email === parent.email ? parent : teacher;
        data = {
          accessToken: "synthetic-access",
          refreshToken: "synthetic-refresh",
        };
      } else if (path === "/auth/logout") status = 204;
      else if (path === "/me") data = active;
      else if (path === "/v1/students")
        data = {
          items: active === parent ? [student] : [student, hidden],
          total: active === parent ? 1 : 2,
          offset: 0,
          limit: 50,
        };
      else if (path === `/v1/students/${student.id}`) data = student;
      else if (path === `/v1/students/${student.id}/plans`) {
        if (method === "POST") {
          plan = {
            ...body,
            id: randomUUID(),
            studentId: student.id,
            revision: 1,
            status: "DRAFT",
            goals: [],
            updatedAt: new Date().toISOString(),
          };
          revisionHistory = [
            {
              id: randomUUID(),
              revision: 1,
              snapshot: structuredClone(plan),
              createdAt: new Date().toISOString(),
            },
          ];
          data = plan;
        } else data = active === parent ? [] : plan ? [plan] : [];
      } else if (plan && path === `/v1/plans/${plan.id}`) {
        if (method === "PATCH") {
          if (body.revision !== plan.revision) {
            status = 409;
            data = { error: "This plan changed. Reload before saving." };
          } else {
            plan = { ...plan, ...body, revision: plan.revision + 1 };
            revisionHistory.unshift({
              id: randomUUID(),
              revision: plan.revision,
              snapshot: structuredClone(plan),
              createdAt: new Date().toISOString(),
            });
            data = plan;
          }
        } else
          data = {
            ...plan,
            goals: plan.goals.map((item) => ({
              ...item,
              progress: observations.filter(
                (point) => point.goalId === item.id,
              ),
            })),
          };
      } else if (plan && path === `/v1/plans/${plan.id}/goals`) {
        const goal = { ...body, id: randomUUID(), progress: [] };
        plan.goals.push(goal);
        plan.revision++;
        data = goal;
      } else if (path.startsWith("/v1/goals/")) {
        data = { ...body, id: randomUUID(), goalId: path.split("/")[3] };
        observations.push(data);
      } else if (path.endsWith("/versions")) data = revisionHistory;
      else if (path.endsWith("/comments")) {
        if (method === "POST") {
          data = {
            ...body,
            id: randomUUID(),
            authorId: active.id,
            createdAt: new Date().toISOString(),
          };
          comments.push(data);
        } else data = comments;
      } else if (path === "/v1/notifications") data = [];
      else if (path.startsWith("/auth/password/")) {
        status = 503;
        data = {
          error:
            "Password recovery is not available. Contact your school administrator.",
        };
      } else {
        status = 404;
        data = { error: "Not found" };
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: status === 204 ? "" : JSON.stringify(data),
      });
    },
  };
}
