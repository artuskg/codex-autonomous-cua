import { execFile } from "node:child_process";
import {
  access,
  chmod,
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { configurePlugin } from "./configure-plugin.mjs";
import { listPluginHooks } from "./list-plugin-hooks.mjs";

const execFileAsync = promisify(execFile);
const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const installRoot =
  process.env.AUTONOMOUS_CUA_INSTALL_ROOT ??
  join(homedir(), ".local", "share", "codex-autonomous-cua");
const marketplaceRoot = join(installRoot, "marketplace");
const pluginId = "unified-computer-use@autonomous-cua-local";
const launcherPlaceholder = "__AUTONOMOUS_CUA_LAUNCHER__";

async function chooseCodex() {
  for (const candidate of [
    process.env.AUTONOMOUS_CUA_CODEX_PATH,
    join(homedir(), ".local", "bin", "codex"),
    "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
  ]) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next current installation.
    }
  }
  throw new Error("could not locate a current Codex CLI");
}

async function materializeMcpLauncher(stagingRoot) {
  const manifestPath = join(
    stagingRoot,
    "marketplace",
    "plugins",
    "unified-computer-use",
    ".mcp.json",
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const server = manifest.mcpServers?.autonomous_cua_repl;
  if (server?.command !== launcherPlaceholder) {
    throw new Error(
      `refusing to rewrite unexpected autonomous_cua_repl command in ${manifestPath}`,
    );
  }
  const launcher = join(installRoot, "bin", "launch-autonomous-cua");
  server.command = launcher;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return launcher;
}

async function run(command, args) {
  return execFileAsync(command, args, {
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
}

async function main() {
  const parent = dirname(installRoot);
  await mkdir(parent, { recursive: true });
  const staging = `${installRoot}.staging-${process.pid}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  for (const entry of [
    "bin",
    "marketplace",
    "policy",
    "scripts",
    "README.md",
    "PLAN.md",
    "LICENSE",
    "NOTICE.md",
  ]) {
    await cp(join(sourceRoot, entry), join(staging, entry), {
      recursive: true,
      preserveTimestamps: true,
    });
  }
  const launcher = await materializeMcpLauncher(staging);
  await chmod(join(staging, "bin", "launch-autonomous-cua"), 0o755);
  const nodePath =
    "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node";
  const verification = await run(nodePath, [
    join(staging, "scripts", "verify-overlay.mjs"),
  ]);
  const previous = `${installRoot}.previous`;
  try {
    await rm(previous, { recursive: true, force: true });
    await rename(installRoot, previous);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await rename(staging, installRoot);

  const codex = await chooseCodex();
  const marketplaces = await run(codex, ["plugin", "marketplace", "list"]);
  if (!/^autonomous-cua-local\s+/m.test(marketplaces.stdout)) {
    await run(codex, ["plugin", "marketplace", "add", marketplaceRoot, "--json"]);
  }
  const plugins = await run(codex, ["plugin", "list"]);
  if (/^unified-computer-use@autonomous-cua-local\s+/m.test(plugins.stdout)) {
    await run(codex, ["plugin", "remove", pluginId, "--json"]);
  }
  const installed = await run(codex, ["plugin", "add", pluginId, "--json"]);
  const hookListing = await listPluginHooks(
    codex,
    process.env.AUTONOMOUS_CUA_HOOK_CWD ?? process.cwd(),
    pluginId,
  );
  if (hookListing.length !== 3) {
    throw new Error(
      `expected exactly three lifecycle hooks for ${pluginId}, found ${hookListing.length}`,
    );
  }
  const configured = await configurePlugin("activate", hookListing);
  const receipt = {
    installedAt: new Date().toISOString(),
    sourceRoot,
    installRoot,
    codex,
    launcher,
    pluginId,
    verification: JSON.parse(verification.stdout),
    pluginInstall: JSON.parse(installed.stdout),
    trustedHooks: hookListing.map(({ key, currentHash, eventName }) => ({
      key,
      currentHash,
      eventName,
    })),
    configured,
    restartRequired: true,
  };
  await writeFile(join(installRoot, "INSTALL.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
