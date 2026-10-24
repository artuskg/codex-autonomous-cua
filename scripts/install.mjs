import { execFile } from "node:child_process";
import { access, chmod, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { configurePlugin, configPath } from "./configure-plugin.mjs";
import { listPluginHooks, trustPluginHooks } from "./list-plugin-hooks.mjs";
import { appNode, chooseCodex, installRoot, pluginId } from "./paths.mjs";

const exec = promisify(execFile);
const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const marketplaceRoot = join(installRoot, "marketplace");
const run = (command, args, env = process.env) => exec(command, args, { env, maxBuffer: 8 * 1024 * 1024 });

async function materializeMcpLauncher(stagingRoot) {
  const manifestPath = join(stagingRoot, "marketplace/plugins/unified-computer-use/.mcp.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const server = manifest.mcpServers?.autonomous_cua_repl;
  if (!["__AUTONOMOUS_CUA_LAUNCHER__", join(sourceRoot, "bin/launch-autonomous-cua")].includes(server?.command)) {
    throw new Error(`unexpected autonomous_cua_repl command in ${manifestPath}`);
  }
  const launcher = join(installRoot, "bin/launch-autonomous-cua");
  server.command = launcher;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return launcher;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check")) throw new Error("Usage: install.mjs [--check]");
  const checkOnly = args.includes("--check");
  const codex = await chooseCodex();
  const parent = dirname(installRoot);
  await mkdir(parent, { recursive: true });
  const lock = `${installRoot}.install-lock`;
  try { await mkdir(lock); } catch (error) {
    if (error.code === "EEXIST") throw new Error(`another shim installation is running (${lock})`);
    throw error;
  }
  const staging = await mkdtemp(join(parent, ".autonomous-cua-install-"));
  const previous = `${installRoot}.previous`;
  let swapped = false;
  let hadPrevious = false;
  let originalConfig;
  let configCaptured = false;
  try {
    for (const entry of ["bin", "docs", "marketplace", "policy", "scripts", "README.md", "PLAN.md", "CHANGELOG.md", "LICENSE", "NOTICE.md"]) {
      await cp(join(sourceRoot, entry), join(staging, entry), { recursive: true, preserveTimestamps: true });
    }
    const launcher = await materializeMcpLauncher(staging);
    for (const entry of ["launch-autonomous-cua", "update-autonomous-cua"]) await chmod(join(staging, "bin", entry), 0o755);
    const verification = JSON.parse((await run(appNode, [join(staging, "scripts/verify-overlay.mjs")])).stdout);
    const smoke = JSON.parse((await run(appNode, [join(staging, "scripts/smoke-mcp.mjs")], {
      ...process.env, AUTONOMOUS_CUA_LAUNCHER: join(staging, "bin/launch-autonomous-cua"),
    })).stdout);
    const version = JSON.parse(await readFile(join(staging, "marketplace/plugins/unified-computer-use/.codex-plugin/plugin.json"), "utf8")).version;
    let revision = null;
    try {
      await access(join(sourceRoot, ".git"));
      revision = (await run("git", ["-C", sourceRoot, "rev-parse", "HEAD"])).stdout.trim();
    } catch { /* Installed copies have no Git checkout. */ }
    if (checkOnly) {
      process.stdout.write(`${JSON.stringify({ ok: true, checkOnly, version, verification, smoke }, null, 2)}\n`);
      return;
    }
    try { originalConfig = await readFile(configPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
    configCaptured = true;
    await rm(previous, { recursive: true, force: true });
    try {
      await rename(installRoot, previous);
      hadPrevious = true;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    await rename(staging, installRoot);
    swapped = true;
    const marketplaces = await run(codex, ["plugin", "marketplace", "list"]);
    const registered = marketplaces.stdout.split("\n").find((line) => /^autonomous-cua-local\s+/.test(line));
    if (registered && !registered.includes(marketplaceRoot)) throw new Error(`autonomous-cua-local points at another installation: ${registered}`);
    if (!registered) await run(codex, ["plugin", "marketplace", "add", marketplaceRoot, "--json"]);
    const installed = await run(codex, ["plugin", "add", pluginId, "--json"]);
    const cwd = process.env.AUTONOMOUS_CUA_HOOK_CWD ?? process.cwd();
    const hooks = await listPluginHooks(codex, cwd, pluginId);
    if (hooks.length !== 5) {
      throw new Error(`expected two agent-context hooks and three cleanup hooks, found ${JSON.stringify(hooks.map(({ key, eventName }) => ({ key, eventName })))}`);
    }
    const configured = await configurePlugin("activate");
    await trustPluginHooks(codex, cwd, hooks, configPath);
    const receipt = {
      ok: true, installedAt: new Date().toISOString(), version, revision,
      sourceRoot, installRoot, codex, launcher, updater: join(installRoot, "bin/update-autonomous-cua"),
      pluginId, verification, smoke: { ...smoke, launcher },
      pluginInstall: JSON.parse(installed.stdout),
      trustedHooks: hooks.map(({ key, currentHash, eventName }) => ({ key, currentHash, eventName })),
      configured, previous: hadPrevious ? previous : null, restartRequired: true,
    };
    await writeFile(join(installRoot, "INSTALL.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } catch (error) {
    if (swapped || hadPrevious) {
      try {
        if (swapped) await rename(installRoot, `${installRoot}.failed-${Date.now()}`);
        if (hadPrevious) {
          await rename(previous, installRoot);
        }
        try {
          await run(codex, ["plugin", hadPrevious ? "add" : "remove", pluginId, "--json"]);
        } finally {
          if (configCaptured) {
            if (originalConfig) {
              const temporary = `${configPath}.autonomous-cua-restore-${process.pid}`;
              await writeFile(temporary, originalConfig, { mode: 0o600 });
              await rename(temporary, configPath);
            } else await rm(configPath, { force: true });
          }
        }
      } catch (restoreError) {
        throw new Error(`update failed: ${error.message}; restoring the previous installation also failed: ${restoreError.message}; previous files: ${previous}`, { cause: error });
      }
    }
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stderr || error.message}\n`);
  process.exitCode = 1;
});
