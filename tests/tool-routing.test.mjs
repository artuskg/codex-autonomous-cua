import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { contextMatches, summarizeCatalog, verifyToolRouting } from "../scripts/verify-tool-routing.mjs";

test("registered names alone do not establish a callable catalog", () => {
  assert.deepEqual(summarizeCatalog([{ name: "tool_search" }]), {
    direct: false, codeMode: false, lifecycleHidden: true,
  });
  const namespaced = [{ type: "namespace", name: "mcp__autonomous_cua_repl", tools: [
    { name: "js" }, { name: "js_reset" }, { name: "turn_ended" },
  ] }];
  assert.equal(summarizeCatalog(namespaced).lifecycleHidden, false);
  assert.equal(summarizeCatalog([{ name: "exec", description:
    "mcp__autonomous_cua_repl__js(args) mcp__autonomous_cua_repl__js_reset(args) mcp__autonomous_cua_repl__turn_ended(args)" }]).lifecycleHidden, false);
});

test("dispatch evidence must match the current Core turn and retain permission context", () => {
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const expected = { session_id: "current-session", thread_id: "current-thread", turn_id: "current-turn" };
  const call = { session: digest(expected.session_id), thread: digest(expected.thread_id), turn: digest(expected.turn_id),
    sandboxMode: "read-only", permissionProfilePresent: true };
  assert.equal(contextMatches(call, expected, expected.thread_id), true);
  assert.equal(contextMatches(call, JSON.stringify(expected), expected.thread_id), true);
  assert.equal(contextMatches(call, { ...expected, turn_id: "previous-turn" }, expected.thread_id), false);
  assert.equal(contextMatches(call, { ...expected, session_id: "another-session" }, expected.thread_id), false);
  assert.equal(contextMatches(call, expected, "another-thread"), false);
  assert.equal(contextMatches({ ...call, permissionProfilePresent: false }, expected, expected.thread_id), false);
  assert.equal(contextMatches(null, expected, expected.thread_id), false);
});

test("native Core preserves the registered route in direct and delegated configurations", {
  skip: !process.env.AUTONOMOUS_CUA_TEST_CODEX,
}, async () => {
  const manifest = JSON.parse(await readFile(new URL("../marketplace/plugins/unified-computer-use/.mcp.json", import.meta.url), "utf8"));
  const result = await verifyToolRouting({
    codex: process.env.AUTONOMOUS_CUA_TEST_CODEX,
    serverConfig: { ...manifest.mcpServers.autonomous_cua_repl,
      command: fileURLToPath(new URL("../bin/launch-autonomous-cua", import.meta.url)) },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.directLocal.route, "direct");
  assert.equal(result.delegated.localConfigurationProbe.route, "direct");
  assert.equal(result.delegated.status, "not_verified");
});
