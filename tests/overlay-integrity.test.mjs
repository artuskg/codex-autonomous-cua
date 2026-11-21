import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, copyFile, lstat, mkdir, mkdtemp, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildOverlay, getBrowserCoreRelative } from "../scripts/build-overlay.mjs";

const execFileAsync = promisify(execFile);
const verifier = fileURLToPath(new URL("../scripts/verify-overlay.mjs", import.meta.url));
const installedApp = process.env.AUTONOMOUS_CUA_APP_ROOT ?? "/Applications/ChatGPT.app";
const splitApp = process.env.AUTONOMOUS_CUA_TEST_SPLIT_APP_ROOT ?? installedApp;
const runtime = "Contents/Resources/cua_node";
const nodeModules = `${runtime}/lib/node_modules`;
const browser = "@oai/browser-desktop/scripts/browser-service.mjs";
const core = "@oai/browser-desktop/scripts/browser-service-core.mjs";
const sky = "@oai/sky/dist/project/cua/sky_js/src/targets/mac/computer-use-policy.js";
const docs = "@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/create_documentation.js";
const policy = "@oai/cua/docs/tinysky-alt-confirmations.md";
const marker = "\n/* overlay integrity test */\n";

async function makeFixture(t, source, requireSplit = false) {
  const sourceModules = join(source, nodeModules);
  let entry;
  try {
    entry = await readFile(join(sourceModules, browser));
  } catch (error) {
    if (error.code !== "ENOENT" || (requireSplit && process.env.AUTONOMOUS_CUA_TEST_SPLIT_APP_ROOT)) throw error;
    t.skip("desktop runtime is unavailable");
    return;
  }
  const browserCore = getBrowserCoreRelative(entry);
  if (requireSplit && !browserCore) {
    if (process.env.AUTONOMOUS_CUA_TEST_SPLIT_APP_ROOT) assert.fail("expected a verified split runtime");
    t.skip("verified split runtime is unavailable");
    return;
  }
  const work = await mkdtemp(join(tmpdir(), "autonomous-cua-integrity-"));
  const appRoot = join(work, "ChatGPT.app");
  const cacheRoot = join(work, "cache");
  const modules = join(appRoot, nodeModules);
  await mkdir(join(appRoot, runtime, "bin"), { recursive: true });
  await copyFile(join(source, "Contents/Info.plist"), join(appRoot, "Contents/Info.plist"));
  await symlink(process.execPath, join(appRoot, runtime, "bin/node"));
  for (const module of [browser, sky, docs, ...(browserCore ? [browserCore] : [])]) {
    const path = join(modules, module);
    await mkdir(dirname(path), { recursive: true });
    await copyFile(join(sourceModules, module), path);
  }
  for (const name of ["@oai/browser-desktop", "@oai/sky", "@oai/cua"]) {
    await writeFile(join(modules, name, "package.json"), '{"version":"0.0.0","type":"module"}');
  }
  await mkdir(dirname(join(modules, policy)), { recursive: true });
  return { work, modules, options: { appRoot, cacheRoot } };
}

async function rejectsVerifier({ appRoot, cacheRoot }, error) {
  await assert.rejects(execFileAsync(process.execPath, [verifier], {
    env: {
      PATH: "/usr/bin:/bin",
      TMPDIR: tmpdir(),
      AUTONOMOUS_CUA_APP_ROOT: appRoot,
      AUTONOMOUS_CUA_CACHE_ROOT: cacheRoot,
    },
  }), { code: 1, message: error, stdout: "" });
}

test("refuses a linked source core without altering its out-of-tree target", async (t) => {
  const fixture = await makeFixture(t, splitApp, true);
  if (!fixture) return;
  const path = join(fixture.modules, core);
  const outside = join(fixture.work, "outside-core.mjs");
  await rename(path, outside);
  const original = await readFile(outside);
  await symlink(outside, path);
  await assert.rejects(buildOverlay(fixture.options), /module is not a regular file.*browser-service-core\.mjs/);
  assert.deepEqual(await readFile(outside), original);
  await assert.rejects(lstat(fixture.options.cacheRoot), { code: "ENOENT" });
});

test("refuses a linked source ancestor in the active Browser layout", async (t) => {
  const fixture = await makeFixture(t, installedApp);
  if (!fixture) return;
  const scripts = dirname(join(fixture.modules, browser));
  const outside = join(fixture.work, "outside-scripts");
  await rename(scripts, outside);
  await symlink(outside, scripts);
  await assert.rejects(buildOverlay(fixture.options), /module ancestor is not a real directory.*scripts/);
  await assert.rejects(lstat(fixture.options.cacheRoot), { code: "ENOENT" });
});

test("refuses a cached core changed together with its manifest hash", async (t) => {
  const fixture = await makeFixture(t, splitApp, true);
  if (!fixture) return;
  const cold = await buildOverlay(fixture.options);
  assert.equal(cold.cached, false);
  const entry = join(cold.path, "node_modules", browser);
  assert.deepEqual(await readFile(entry), await readFile(join(fixture.modules, browser)));
  assert.equal((await buildOverlay(fixture.options)).cached, true);
  const corePath = join(cold.path, "node_modules", core);
  await appendFile(corePath, marker);
  const manifestPath = join(cold.path, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.outputHashes.browserCore = createHash("sha256").update(await readFile(corePath)).digest("hex");
  await writeFile(manifestPath, JSON.stringify(manifest));
  const mismatch = /overlay bytes differ.*browser-service-core\.mjs/;
  await assert.rejects(buildOverlay(fixture.options), mismatch);
  await rejectsVerifier(fixture.options, mismatch);
});

test("refuses cached documentation changed with its pinned manifest left intact", async (t) => {
  const fixture = await makeFixture(t, splitApp, true);
  if (!fixture) return;
  const { path } = await buildOverlay(fixture.options);
  const manifestPath = join(path, "manifest.json");
  const manifest = await readFile(manifestPath);
  await appendFile(join(path, "node_modules", docs), marker);
  const mismatch = /overlay bytes differ.*create_documentation\.js/;
  await assert.rejects(buildOverlay(fixture.options), mismatch);
  await rejectsVerifier(fixture.options, mismatch);
  assert.deepEqual(await readFile(manifestPath), manifest);
});

test("refuses changed cached outputs for the active Browser layout", async (t) => {
  const fixture = await makeFixture(t, installedApp);
  if (!fixture) return;
  const { path } = await buildOverlay(fixture.options);
  for (const module of [browser, sky, docs, policy]) {
    const file = join(path, "node_modules", module);
    const original = await readFile(file);
    await appendFile(file, marker);
    await assert.rejects(buildOverlay(fixture.options), (error) =>
      error.message.includes("overlay bytes differ") && error.message.includes(module));
    await writeFile(file, original);
  }
  assert.equal((await buildOverlay(fixture.options)).cached, true);
});
