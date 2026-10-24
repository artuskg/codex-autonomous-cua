import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { installRoot } from "./paths.mjs";

const launcher =
  process.env.AUTONOMOUS_CUA_LAUNCHER ??
  join(installRoot, "bin", "launch-autonomous-cua");
const child = spawn(launcher, [], { stdio: ["pipe", "pipe", "pipe"] });
const pending = new Map();
const stderr = [];
let nextId = 1;
let exited = false;
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => stderr.push(chunk));
child.on("exit", (code, signal) => {
  exited = true;
  const error = new Error(
    `cua_repl exited before replying: code=${code} signal=${signal}; ${stderr.join("")}`,
  );
  for (const { reject } of pending.values()) reject(error);
  pending.clear();
});
child.on("error", (error) => {
  exited = true;
  for (const { reject } of pending.values()) reject(error);
  pending.clear();
});
const lines = createInterface({ input: child.stdout });
lines.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.id === undefined || !pending.has(message.id)) return;
  const waiter = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
  else waiter.resolve(message.result);
});

function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

function request(method, params, timeoutMs = 45_000) {
  if (exited) return Promise.reject(new Error("cua_repl is not running"));
  const id = nextId++;
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timed out waiting for cua_repl ${method}`));
    }, timeoutMs);
    pending.set(id, {
      resolve(value) {
        clearTimeout(timer);
        resolve(value);
      },
      reject(error) {
        clearTimeout(timer);
        reject(error);
      },
    });
  });
}

try {
  const initialize = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "autonomous-cua-smoke", version: "1.0.0" },
  });
  notify("notifications/initialized", {});
  const tools = await request("tools/list", {});
  const toolNames = tools.tools.map((tool) => tool.name);
  for (const required of ["js", "js_reset", "turn_ended"]) {
    if (!toolNames.includes(required)) throw new Error(`missing MCP tool ${required}`);
  }
  const call = await request("tools/call", {
    name: "js",
    arguments: {
      code: "const smokeState = await cua.getState({emit:false}); nodeRepl.write(JSON.stringify({apps:Array.isArray(smokeState.apps),browsers:Array.isArray(smokeState.browsers)}));",
      title: "Smoke test autonomous CUA",
    },
    _meta: {
      "x-codex-turn-metadata": JSON.stringify({
        session_id: "autonomous-cua-smoke",
        turn_id: "initialization",
      }),
    },
  });
  if (call.isError) throw new Error(JSON.stringify(call.content));
  const texts = call.content
    .filter((item) => item.type === "text")
    .map((item) => item.text);
  const expectedPolicy = (await readFile(new URL("../policy/computer-use-autonomous.md", import.meta.url), "utf8")).trim();
  if (!expectedPolicy || !texts.some((text) => text.includes(expectedPolicy))) {
    throw new Error("the complete current autonomous policy was not present in first-use documentation");
  }
  const state = texts
    .map((text) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })
    .find((value) => value?.apps === true && value?.browsers === true);
  if (!state) {
    const diagnostic = texts
      .filter((text) => !text.includes("# Autonomous Computer Use Policy"))
      .map((text) => text.slice(0, 500));
    throw new Error(
      `unexpected autonomous runtime state: ${JSON.stringify(state)}; content=${JSON.stringify(diagnostic)}`,
    );
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        launcher,
        protocolVersion: initialize.protocolVersion,
        serverInfo: initialize.serverInfo,
        tools: toolNames,
        runtime: state,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  lines.close();
  if (!exited) child.kill("SIGTERM");
}
