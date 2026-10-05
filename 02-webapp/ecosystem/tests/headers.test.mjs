import test from "node:test";
import assert from "node:assert/strict";
import { securityHeaders } from "../src/headers.mjs";
test("production headers restrict connections to the exact configured HTTPS API origin", () => {
  const headers = securityHeaders("https://api.example.test/");
  assert.ok(headers.includes("connect-src 'self' https://api.example.test;"));
  assert.ok(headers.includes("Cache-Control: no-store"));
  assert.ok(headers.includes("frame-ancestors 'none'"));
  assert.equal(headers.includes("unsafe-inline"), false);
  assert.equal(headers.includes("unsafe-eval"), false);
});
test("production builds reject missing, insecure and injected API header values", () => {
  for (const value of [
    undefined,
    "http://api.example.test",
    "https://api.example.test/path",
    "https://api.example.test\nX-Test: value",
    "https://user:pass@api.example.test",
  ])
    assert.throws(() => securityHeaders(value));
});
