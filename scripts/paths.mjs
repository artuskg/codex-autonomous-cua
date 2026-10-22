import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const appRoot = process.env.AUTONOMOUS_CUA_APP_ROOT ?? "/Applications/ChatGPT.app";
export const appNode = join(appRoot, "Contents/Resources/cua_node/bin/node");
export const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
export const installRoot = process.env.AUTONOMOUS_CUA_INSTALL_ROOT ?? join(homedir(), ".local/share/codex-autonomous-cua");
export const pluginId = "unified-computer-use@autonomous-cua-local";

export async function chooseCodex() {
  const explicit = process.env.AUTONOMOUS_CUA_CODEX_PATH;
  const candidates = explicit ? [explicit] : [
    join(homedir(), ".local/bin/codex"),
    ...(process.env.PATH ?? "").split(":").filter(Boolean).map((path) => join(path, "codex")),
    join(appRoot, "Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch { /* Try the next installed CLI. */ }
  }
  throw new Error("could not locate an executable Codex CLI; set AUTONOMOUS_CUA_CODEX_PATH");
}
