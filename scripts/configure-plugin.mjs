import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { codexHome } from "./paths.mjs";

export const configPath =
  process.env.AUTONOMOUS_CUA_CONFIG_PATH ??
  join(codexHome, "config.toml");
const localPlugin = "unified-computer-use@autonomous-cua-local";
const bundledPlugin = "unified-computer-use@openai-bundled";
const serverName = "autonomous_cua_repl";
const legacyServerName = "cua_repl";

function findSection(lines, header) {
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !/^\s*\[.*\]\s*$/.test(lines[end])) end += 1;
  return { start, end };
}

function upsertSection(lines, header, body, replaceBody = true) {
  const section = findSection(lines, header);
  const replacement = [header, ...body, ""];
  if (!section) {
    if (lines.length && lines.at(-1) !== "") lines.push("");
    lines.push(...replacement);
    return;
  }
  if (replaceBody) {
    lines.splice(section.start, section.end - section.start, ...replacement);
    return;
  }
  const desiredKeys = new Map(
    body.map((line) => [line.slice(0, line.indexOf("=")).trim(), line]),
  );
  const existing = lines.slice(section.start + 1, section.end);
  for (const [key, desired] of desiredKeys) {
    const index = existing.findIndex(
      (line) => line.includes("=") && line.slice(0, line.indexOf("=")).trim() === key,
    );
    if (index === -1) existing.push(desired);
    else existing[index] = desired;
  }
  while (existing.length && existing.at(-1) === "") existing.pop();
  lines.splice(section.start, section.end - section.start, header, ...existing, "");
}

function removeSection(lines, header) {
  const section = findSection(lines, header);
  if (!section) return;
  lines.splice(section.start, section.end - section.start);
}

export async function configurePlugin(mode) {
  if (!new Set(["activate", "rollback"]).has(mode)) {
    throw new Error(`unknown plugin configuration mode: ${mode}`);
  }
  let original = "";
  let metadata = { mode: 0o600 };
  let exists = false;
  try {
    original = await readFile(configPath, "utf8");
    metadata = await stat(configPath);
    exists = true;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const lines = original.replace(/\n$/, "").split("\n");
  const activating = mode === "activate";
  upsertSection(
    lines,
    `[plugins."${bundledPlugin}"]`,
    [`enabled = ${activating ? "false" : "true"}`],
    false,
  );
  upsertSection(
    lines,
    `[plugins."${localPlugin}"]`,
    [`enabled = ${activating ? "true" : "false"}`],
    false,
  );
  for (const suffix of [
    `[plugins."${localPlugin}".mcp_servers.${legacyServerName}]`,
    ...["js", "js_reset", "turn_ended"].map(
      (tool) =>
        `[plugins."${localPlugin}".mcp_servers.${legacyServerName}.tools.${tool}]`,
    ),
  ]) {
    removeSection(lines, suffix);
  }
  if (activating) {
    upsertSection(
      lines,
      `[plugins."${localPlugin}".mcp_servers.${serverName}]`,
      [
        "enabled = true",
        'default_tools_approval_mode = "approve"',
        'enabled_tools = ["js", "js_reset", "turn_ended"]',
      ],
    );
    for (const tool of ["js", "js_reset", "turn_ended"]) {
      upsertSection(
        lines,
        `[plugins."${localPlugin}".mcp_servers.${serverName}.tools.${tool}]`,
        ['approval_mode = "approve"'],
      );
    }
  }
  const output = `${lines.join("\n").replace(/\n+$/, "")}\n`;
  if (output === original) return { changed: false, configPath };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `${configPath}.pre-autonomous-cua-${timestamp}`;
  const temporary = `${configPath}.autonomous-cua-${process.pid}.tmp`;
  await mkdir(dirname(configPath), { recursive: true });
  if (exists) await copyFile(configPath, backup);
  await writeFile(temporary, output, { mode: metadata.mode });
  await rename(temporary, configPath);
  return { changed: true, configPath, ...(exists ? { backup } : {}) };
}

if (process.argv[1]?.endsWith("configure-plugin.mjs")) {
  configurePlugin(process.argv[2] ?? "activate")
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error}\n`);
      process.exitCode = 1;
    });
}
