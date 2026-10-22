import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { listPluginHooks } from "./list-plugin-hooks.mjs";
import { chooseCodex, installRoot } from "./paths.mjs";

const execFileAsync = promisify(execFile);
const codex = await chooseCodex();
const cwd = process.env.AUTONOMOUS_CUA_VERIFY_CWD ?? process.cwd();
const pluginId = "unified-computer-use@autonomous-cua-local";
const marketplaceName = "autonomous-cua-local";
const serverName = "autonomous_cua_repl";
const launcher =
  process.env.AUTONOMOUS_CUA_LAUNCHER ??
  join(installRoot, "bin", "launch-autonomous-cua");

const { stdout } = await execFileAsync(
  codex,
  ["plugin", "list", "--marketplace", marketplaceName, "--json"],
  { cwd, maxBuffer: 4 * 1024 * 1024 },
);
const pluginListing = JSON.parse(stdout);
const plugin = pluginListing.installed?.find(
  (entry) => entry.pluginId === pluginId,
);
if (!plugin?.installed || !plugin.enabled) {
  throw new Error(`local plugin is not installed and enabled: ${stdout}`);
}
const mcpManifestPath = join(plugin.source.path, ".mcp.json");
const mcpManifest = JSON.parse(await readFile(mcpManifestPath, "utf8"));
const mcp = mcpManifest.mcpServers?.[serverName];
if (!mcp?.enabled || mcp.command !== launcher) {
  throw new Error(
    `local plugin MCP manifest does not bind ${serverName} to ${launcher}: ${mcpManifestPath}`,
  );
}
for (const tool of ["js", "js_reset", "turn_ended"]) {
  if (!mcp.enabled_tools?.includes(tool)) {
    throw new Error(`${serverName} is missing enabled tool ${tool}`);
  }
}
const { stdout: resolvedMcpStdout } = await execFileAsync(
  codex,
  ["mcp", "get", serverName, "--json"],
  { cwd, maxBuffer: 4 * 1024 * 1024 },
);
const resolvedMcp = JSON.parse(resolvedMcpStdout);
if (
  !resolvedMcp.enabled ||
  resolvedMcp.transport?.command !== launcher ||
  ["js", "js_reset", "turn_ended"].some(
    (tool) => !resolvedMcp.enabled_tools?.includes(tool),
  )
) {
  throw new Error(
    `${serverName} is not registered in the merged Codex MCP runtime: ${resolvedMcpStdout}`,
  );
}
const hooks = await listPluginHooks(codex, cwd, pluginId);
if (
  hooks.length !== 5 ||
  hooks.some((hook) => !hook.enabled || hook.trustStatus !== "trusted")
) {
  throw new Error(`plugin hook trust validation failed: ${JSON.stringify(hooks)}`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      pluginId,
      plugin: {
        version: plugin.version,
        source: plugin.source.path,
      },
      mcp: {
        server: serverName,
        command: resolvedMcp.transport.command,
        enabledTools: resolvedMcp.enabled_tools,
      },
      hooks: hooks.map(({ key, eventName, currentHash, trustStatus }) => ({
        key,
        eventName,
        currentHash,
        trustStatus,
      })),
    },
    null,
    2,
  )}\n`,
);
