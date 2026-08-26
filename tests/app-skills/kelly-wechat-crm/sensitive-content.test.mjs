import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitive } from "../../../skills/kelly-wechat-crm/scripts/lib/sensitive-content.mjs";

test("redacts secret-shaped fields and values recursively", () => {
  const result = redactSensitive({
    token: "bsr_12345678901234567890",
    nested: [{ text: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz" }],
    api_key: "sk-12345678901234567890",
  });
  assert.equal(result.hasSensitiveContent, true);
  assert.ok(result.redactionCount >= 3);
  assert.equal(JSON.stringify(result.data).includes("12345678901234567890"), false);
});

test("removes credentials from URLs without changing normal chat content", () => {
  const result = redactSensitive({
    link: "https://alice:password@example.com/private",
    message: "周五下午再聊产品试用。",
  });
  assert.equal(result.data.link.includes("password"), false);
  assert.equal(result.data.message, "周五下午再聊产品试用。");
});
