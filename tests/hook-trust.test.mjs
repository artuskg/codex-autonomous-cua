import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";

const directory = await mkdtemp(join(tmpdir(), "autonomous-cua-hook-trust-"));
const configPath = join(directory, "config.toml");
process.env.AUTONOMOUS_CUA_CONFIG_PATH = configPath;
const { configurePlugin } = await import("../scripts/configure-plugin.mjs");
const pluginId = "unified-computer-use@autonomous-cua-local";
const original = '[unrelated]\nvalue = "preserve me"\n';
beforeEach(() => writeFile(configPath, original));
after(() => rm(directory, { recursive: true, force: true }));

test("preserves Codex trust tokens without assuming their format", async () => {
  const legacy = `sha256:${"a".repeat(64)}`;
  const tokens = [legacy, `${legacy}/sha256:${"b".repeat(64)}`, 'future:"opaque"\\token'];
  const hooks = tokens.map((currentHash, index) => ({ key: `${pluginId}:hook:${index}`, currentHash }));
  await configurePlugin("activate", hooks);
  const output = await readFile(configPath, "utf8");
  const stored = [...output.matchAll(/^trusted_hash = (.+)$/gm)].map((match) => JSON.parse(match[1]));
  assert.deepEqual(stored, tokens);
  assert.ok(output.startsWith(original));
  assert.equal((await configurePlugin("activate", hooks)).changed, false);
});

test("rejects missing trust values without changing the config", async () => {
  for (const currentHash of [undefined, null, 42, ""]) {
    await assert.rejects(configurePlugin("activate", [{ key: `${pluginId}:hook:0`, currentHash }]));
    assert.equal(await readFile(configPath, "utf8"), original);
  }
});

test("rejects hooks from another plugin without changing the config", async () => {
  await assert.rejects(configurePlugin("activate", [{
    key: "another-plugin:hook:0",
    currentHash: `sha256:${"a".repeat(64)}`,
  }]));
  assert.equal(await readFile(configPath, "utf8"), original);
});
