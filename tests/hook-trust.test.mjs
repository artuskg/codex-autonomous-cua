import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { hookTrustEdits, trustPluginHooks } from "../scripts/list-plugin-hooks.mjs";

const pluginId = "unified-computer-use@autonomous-cua-local";

test("passes opaque trust values unchanged to the Codex configuration API", () => {
  const legacy = `sha256:${"a".repeat(64)}`;
  const tokens = [legacy, `${legacy}/sha256:${"b".repeat(64)}`, 'future:"opaque"\\token'];
  const hooks = tokens.map((currentHash, index) => ({ key: `${pluginId}:hook:${index}`, currentHash }));
  const edits = hookTrustEdits(hooks);
  assert.deepEqual(edits.map(({ value }) => value), tokens);
  assert.deepEqual(edits.map(({ keyPath }) => keyPath), [
    `hooks.state."${pluginId}:hook:0".trusted_hash`,
    `hooks.state."${pluginId}:hook:1".trusted_hash`,
    `hooks.state."${pluginId}:hook:2".trusted_hash`,
  ]);
  assert.ok(edits.every(({ mergeStrategy }) => mergeStrategy === "upsert"));
});

test("rejects missing trust values before sending configuration edits", () => {
  for (const currentHash of [undefined, null, 42, ""]) {
    assert.throws(() => hookTrustEdits([{ key: `${pluginId}:hook:0`, currentHash }]));
  }
});

test("rejects hooks from another plugin before sending configuration edits", () => {
  assert.throws(() => hookTrustEdits([{
    key: "another-plugin:hook:0",
    currentHash: `sha256:${"a".repeat(64)}`,
  }]));
});

test("Codex stores compound trust through its native API", {
  skip: !process.env.AUTONOMOUS_CUA_TEST_CODEX && "set AUTONOMOUS_CUA_TEST_CODEX to Codex 0.164.0 or later",
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "autonomous-cua-hook-trust-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // The API writes only its own user config; give this process an isolated home.
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = directory;
  t.after(() => {
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
  });
  const configPath = join(directory, "config.toml");
  const key = `${pluginId}:test:0`;
  const hookHash = `sha256:${"a".repeat(64)}`;
  const contentHash = `sha256:${"b".repeat(64)}`;
  await writeFile(configPath, `[hooks.state."${key}"]\ntrusted_hash = "stale"\n\n[unrelated]\nvalue = "keep"\n`);
  await trustPluginHooks(process.env.AUTONOMOUS_CUA_TEST_CODEX, directory, [{
    key, currentHash: `${hookHash}/${contentHash}`,
  }], configPath);
  const output = await readFile(configPath, "utf8");
  assert.ok(output.includes(`trusted_hash = "${hookHash}"`));
  assert.ok(output.includes(`trusted_content_hash = "${contentHash}"`));
  assert.ok(output.includes('value = "keep"'));
  assert.ok(!output.includes('trusted_hash = "stale"'));
});
