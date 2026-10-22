import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { appNode, chooseCodex, installRoot } from "./paths.mjs";

const exec = promisify(execFile);
const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repository = "https://github.com/artuskg/codex-autonomous-cua.git";
const args = process.argv.slice(2);
let source;
let rebuild = false;
let check = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--source" && args[i + 1] && !args[i + 1].startsWith("--")) source = resolve(args[++i]);
  else if (args[i] === "--rebuild") rebuild = true;
  else if (args[i] === "--check") check = true;
  else if (args[i] === "--help") {
    process.stdout.write("Usage: update-autonomous-cua [--check] [--rebuild | --source PATH]\nFetch the latest shim and rebuild for the installed desktop app.\n--check validates without activating. --rebuild uses the installed shim.\n");
    process.exit(0);
  } else throw new Error(`unknown or incomplete option: ${args[i]}`);
}
if (source && rebuild) throw new Error("choose --source or --rebuild");

async function version(root) {
  return JSON.parse(await readFile(join(root, "marketplace/plugins/unified-computer-use/.codex-plugin/plugin.json"), "utf8")).version;
}

function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  if (left.length !== 3 || right.length !== 3 || [...left, ...right].some((n) => !Number.isSafeInteger(n))) throw new Error("unexpected shim version format");
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return Math.sign(left[i] - right[i]);
  return 0;
}

async function main() {
  const lock = `${installRoot}.update-lock`;
  await mkdir(dirname(installRoot), { recursive: true });
  try { await mkdir(lock); } catch (error) {
    if (error.code === "EEXIST") throw new Error(`another shim update is running (${lock})`);
    throw error;
  }
  let temporary;
  try {
    const codex = await chooseCodex();
    if (rebuild) source = sourceRoot;
    if (!source) {
      process.stderr.write("Fetching the latest shim…\n");
      temporary = await mkdtemp(join(tmpdir(), "autonomous-cua-update-"));
      source = join(temporary, "source");
      await exec("git", ["clone", "--depth", "1", "--single-branch", "--branch", "main", "--no-tags", "--", repository, source], { timeout: 120_000, maxBuffer: 1024 * 1024 });
    }
    const candidate = await version(source);
    let installed;
    try { installed = await version(installRoot); } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (installed && compareVersions(candidate, installed) < 0) throw new Error(`refusing to downgrade shim ${installed} to ${candidate}; the installed shim is newer than this source`);
    process.stderr.write(`Building shim ${candidate} and testing the runtime…\n`);
    const result = await exec(appNode, [join(source, "scripts/install.mjs"), ...(check ? ["--check"] : [])], {
      env: { ...process.env, AUTONOMOUS_CUA_CODEX_PATH: codex },
      maxBuffer: 8 * 1024 * 1024,
    });
    process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stderr || error.message}\n`);
  process.exitCode = 1;
});
