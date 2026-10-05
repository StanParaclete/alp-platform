import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "vite";
import { fixture } from "./fixture.mjs";

const integration = process.argv.includes("--integration"),
  base = "http://127.0.0.1:3309",
  apiBase = "http://127.0.0.1:3310";
process.env.VITE_API_URL = apiBase;
let db, apiServer, browser, vite, context;
const data = fixture(),
  password = randomBytes(24).toString("hex");
try {
  if (integration) {
    assert.equal(process.env.NODE_ENV, "test");
    const url = new URL(process.env.ALP_INTEGRATION_DATABASE_URL);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/alp_test");
    const { database } = await import("../../../05-backend/src/db.mjs"),
      { hashPassword } = await import("../../../05-backend/src/security.mjs"),
      { createApp } = await import("../../../05-backend/src/app.mjs");
    db = database({ DATABASE_URL: url.href });
    const passwordHash = await hashPassword(password);
    const school = await db.school.create({
      data: { name: "ALP Synthetic Browser School", country: "GH" },
    });
    for (const [user, role] of [
      [data.teacher, "TEACHER"],
      [data.parent, "PARENT"],
    ])
      await db.user.create({
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          passwordHash,
          memberships: { create: { schoolId: school.id, role } },
        },
      });
    await db.student.create({ data: { ...data.student, schoolId: school.id } });
    await db.student.create({
      data: {
        schoolId: school.id,
        name: "Unlinked Learner",
        grade: "4",
        categories: [],
      },
    });
    await db.studentAccess.create({
      data: { userId: data.parent.id, studentId: data.student.id },
    });
    const app = await createApp({
      db,
      env: { JWT_SECRET: randomBytes(48).toString("hex"), CORS_ORIGINS: base },
      rateLimit: { health: async () => true, allow: async () => true },
    });
    apiServer = app.listen(3310, "127.0.0.1");
    await new Promise((resolve, reject) => {
      apiServer.once("listening", resolve);
      apiServer.once("error", reject);
    });
  }
  vite = await createServer({
    server: { host: "127.0.0.1", port: 3309, strictPort: true },
    logLevel: "error",
  });
  await vite.listen();
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  if (!integration) await context.route(`${apiBase}/**`, data.handle);
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mkdir("test-results", { recursive: true });
  async function screenshot(name) {
    await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
  }
  async function accessible() {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      result.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
      [],
    );
  }
  async function fits() {
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Viewport must not overflow horizontally",
    );
  }
  async function login(user) {
    await page.getByLabel("Email address", { exact: true }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Students", exact: true }),
    ).toBeVisible();
  }
  async function signOut() {
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome to ALP" }),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(base);
  await accessible();
  await fits();
  await screenshot("login-desktop");
  await expect(
    page.getByRole("link", { name: "Stan Paraclete" }),
  ).toHaveAttribute("href", "https://www.stanparaclete.com/");
  assert.ok(
    await page
      .locator(".auth-photo img")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await fits();
  await screenshot("login-mobile");
  await page.setViewportSize({ width: 1440, height: 960 });
  await login(data.teacher);
  if (integration) {
    await page
      .getByRole("button", { name: "Add student", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Student name", { exact: true })
      .fill("Additional Browser Learner");
    await page
      .getByRole("dialog")
      .getByLabel("Grade / year", { exact: true })
      .fill("5");
    await page
      .getByRole("button", { name: "Save student", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Additional Browser Learner",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit student", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Strengths", { exact: true })
      .fill("Synthetic edited strengths.");
    await page
      .getByRole("button", { name: "Save student", exact: true })
      .click();
    await expect(
      page.getByText("Synthetic edited strengths.", { exact: true }),
    ).toBeVisible();
    const saved = await db.student.findFirst({
      where: { name: "Additional Browser Learner" },
    });
    assert.equal(saved.strengths, "Synthetic edited strengths.");
    await page
      .getByRole("link", { name: "Students", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Students", exact: true }),
    ).toBeVisible();
  }
  await accessible();
  await screenshot("students-desktop");
  await page.getByRole("link", { name: "Synthetic Learner" }).click();
  await page.getByRole("button", { name: "Create ALP", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ALP - Synthetic Learner", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Strengths/ }).click();
  await page
    .getByLabel("Section content", { exact: true })
    .fill("Synthetic learner enjoys collaborative reading.");
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByText(/Revision 2 \/ /).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Synthetic learner enjoys collaborative reading.", {
        exact: true,
      }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  for (const [label, value] of [
    ["Goal", "Read ten words independently"],
    ["Baseline", "0"],
    ["Target", "10"],
    ["Unit", "words"],
    ["Due date", "2027-03-01"],
  ])
    await page
      .getByRole("dialog")
      .getByLabel(label, { exact: true })
      .fill(value);
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Read ten words independently" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record progress", exact: true })
    .click();
  await page.getByLabel("Observed value (words)", { exact: true }).fill("8");
  await page
    .getByLabel("Observation note", { exact: true })
    .fill("Synthetic observation.");
  await page
    .getByRole("button", { name: "Save observation", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "8 words", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await page
    .getByLabel("Comment", { exact: true })
    .fill("Staff-only synthetic review.");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(
    page.getByText("Staff-only synthetic review.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await accessible();
  await fits();
  await screenshot("plan-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Plan section", { exact: true })).toHaveValue(
    "strengths",
  );
  await page.getByLabel("Plan section", { exact: true }).selectOption("needs");
  await expect(
    page.getByRole("heading", { name: "Needs", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Plan section", { exact: true })
    .selectOption("strengths");
  await expect(page.getByLabel("Section content", { exact: true })).toHaveValue(
    "Synthetic learner enjoys collaborative reading.",
  );
  await accessible();
  await fits();
  await screenshot("plan-mobile");
  await page.setViewportSize({ width: 1440, height: 960 });
  const failSave = async (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Synthetic save outage" }),
        })
      : route.fallback();
  await context.route(`${apiBase}/v1/plans/*`, failSave);
  await page
    .getByLabel("Section content", { exact: true })
    .fill("An unsaved synthetic edit.");
  await expect(page.getByRole("alert")).toHaveText("Synthetic save outage", {
    timeout: 10000,
  });
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Unsaved changes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stay on plan", exact: true }).click();
  await expect(page.getByLabel("Section content")).toHaveValue(
    "An unsaved synthetic edit.",
  );
  await context.unroute(`${apiBase}/v1/plans/*`, failSave);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await accessible();
  await screenshot("plan-dark");
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  await signOut();
  await login(data.parent);
  await expect(
    page.getByRole("link", { name: "Unlinked Learner" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add student", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Synthetic Learner" }).click();
  await expect(page.getByText("No learning plans available.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create ALP", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit student", exact: true }),
  ).toHaveCount(0);
  await signOut();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page
    .getByLabel("Account email", { exact: true })
    .fill(data.teacher.email);
  await page
    .getByRole("button", { name: "Request recovery code", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Password recovery is not available",
  );
  assert.deepEqual(errors, []);
  console.log(
    `Browser checks passed (${integration ? "real PostgreSQL API" : "synthetic transport fixture"}): login, media, roles, plan saves, history, goals, progress, comments, failed-save navigation, recovery failure, no persistent session data, WCAG scan, desktop/mobile and dark theme.`,
  );
} catch (error) {
  const page = context?.pages()[0];
  if (page)
    await page
      .screenshot({ path: "test-results/failure.png", fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  await context?.close();
  await browser?.close();
  await vite?.close();
  if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
  await db?.$disconnect();
}
