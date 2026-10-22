import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

export async function listPluginHooks(codex, cwd, pluginId) {
  const child = spawn(codex, ["app-server", "--stdio"], {
    cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Map();
  const stderr = [];
  let nextId = 1;
  let exited = false;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.on("exit", (code, signal) => {
    exited = true;
    const detail = `app-server exited before replying: code=${code} signal=${signal}; ${stderr.join("")}`;
    for (const { reject } of pending.values()) reject(new Error(detail));
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

  function request(method, params, timeoutMs = 15_000) {
    if (exited) return Promise.reject(new Error("app-server is not running"));
    const id = nextId++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timed out waiting for app-server ${method}`));
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
    await request("initialize", {
      clientInfo: { name: "autonomous-cua-installer", version: "1.0.0" },
      capabilities: {},
    });
    notify("initialized", {});
    const result = await request("hooks/list", { cwds: [cwd] });
    const entry = result.data?.find((item) => item.cwd === cwd);
    if (!entry) throw new Error(`hooks/list did not return cwd ${cwd}`);
    if (entry.errors?.length) {
      throw new Error(`hooks/list returned errors: ${JSON.stringify(entry.errors)}`);
    }
    return entry.hooks.filter((hook) => hook.pluginId === pluginId);
  } finally {
    lines.close();
    if (!exited) child.kill("SIGTERM");
  }
}
