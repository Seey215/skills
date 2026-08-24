import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getFreePort, startProcess } from "../harness/process.mjs";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
// kelly-email is laid out as a busabase TEMPLATE, so its AirApp lives where
// the package format puts it — `content/<airapp>/` is both the node that gets
// installed and the project a developer runs. The other app-skills here still
// use `app/`.
const appRoot = join(repoRoot, "skills", "kelly-email", "content", "kelly-email-app");
let baseUrl;
let runtime;
let home;

test.before(async () => {
  const port = await getFreePort();
  home = await mkdtemp(join(tmpdir(), "kelly-email-home-"));
  baseUrl = `http://127.0.0.1:${port}`;
  runtime = await startProcess({
    command: process.execPath,
    args: ["server.js"],
    cwd: appRoot,
    env: { HOME: home, PORT: String(port) },
    // kelly-email has no /health route; /auth/status always returns 200 JSON.
    readyUrl: `${baseUrl}/auth/status`,
  });
});

test.after(async () => {
  await runtime?.stop();
  if (home) await rm(home, { recursive: true, force: true });
});

test("serves canonical browser assets with no-store", async () => {
  for (const path of ["/", "/app.js", "/js/config.js"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
  }
});

test("starts disconnected without leaking a local credential", async () => {
  const response = await fetch(`${baseUrl}/auth/status`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    connected: false,
    cloudBaseUrl: "https://busabase.com",
  });
});

test("rejects cross-origin OAuth starts", async () => {
  const response = await fetch(`${baseUrl}/auth/start`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://attacker.example",
    },
    body: "base_url=https%3A%2F%2Fbusabase.com",
    redirect: "manual",
  });
  assert.equal(response.status, 303);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.origin, baseUrl);
  assert.match(location.searchParams.get("oauth_error"), /origin mismatch/i);
});
