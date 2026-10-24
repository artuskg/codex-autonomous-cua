import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { appendFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { codexHome } from "./paths.mjs";

const sourceFile = fileURLToPath(import.meta.url);
const namespace = "mcp__autonomous_cua_repl";
const marker = "AUTONOMOUS_CUA_REGISTERED_DISPATCH_OK";
const hash = (value) => typeof value === "string" && value.length > 0
  ? createHash("sha256").update(value).digest("hex") : null;

function metadata(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" ? value : {};
}

export function summarizeCatalog(tools = []) {
  const names = tools.flatMap((tool) => tool.type === "namespace"
    ? tool.tools.map((child) => `${tool.name}.${child.name}`)
    : [tool.name]);
  const exec = tools.find((tool) => tool.name === "exec");
  return {
    direct: ["js", "js_reset"].every((tool) => names.includes(`${namespace}.${tool}`)
      || names.includes(`${namespace}__${tool}`)),
    codeMode: ["js", "js_reset"].every((tool) => exec?.description?.includes(`${namespace}__${tool}(`)),
    lifecycleHidden: !names.some((name) => name === `${namespace}.turn_ended`
      || name === `${namespace}__turn_ended`)
      && !exec?.description?.includes(`${namespace}__turn_ended(`),
  };
}

export function contextMatches(call, modelRequest, threadId) {
  const expected = metadata(modelRequest);
  return Boolean(call?.session && call?.turn && call?.thread
    && call.session === hash(expected.session_id)
    && call.turn === hash(expected.turn_id)
    && call.thread === hash(threadId)
    && call.sandboxMode === "read-only"
    && call.permissionProfilePresent);
}

// This observer forwards the original bytes. It never supplies or changes MCP metadata.
async function recordMcp(descriptorPath, logPath) {
  const descriptor = JSON.parse(await readFile(descriptorPath, "utf8"));
  const child = spawn(descriptor.command, descriptor.args ?? [], {
    env: { ...process.env, ...descriptor.env }, stdio: ["pipe", "pipe", "inherit"],
  });
  const requests = new Map();
  const record = (value) => appendFileSync(logPath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  const input = createInterface({ input: process.stdin });
  const output = createInterface({ input: child.stdout });
  input.on("line", (line) => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id !== undefined) requests.set(message.id, message);
    if (message.method !== "tools/call" || message.params?.name !== "js") return;
    const meta = metadata(message.params._meta?.["x-codex-turn-metadata"]);
    record({ type: "call", session: hash(meta.session_id), thread: hash(meta.thread_id),
      turn: hash(meta.turn_id), sandboxMode: meta.sandbox_mode,
      permissionProfilePresent: Boolean(message.params._meta?.["codex/sandbox-state"]?.permissionProfile) });
  });
  output.on("line", (line) => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const request = requests.get(message.id);
    if (!request) return;
    requests.delete(message.id);
    if (request.method === "tools/list") record({ type: "registered", tools: message.result?.tools?.map((tool) => ({
      name: tool.name, visibility: tool._meta?.ui?.visibility,
    })) ?? [], error: Boolean(message.error) });
    if (request.method === "tools/call" && request.params?.name === "js") record({
      type: "result", ok: !message.error && !message.result?.isError,
      marker: message.result?.content?.some((item) => item.type === "text" && item.text === marker) ?? false,
    });
  });
  process.stdin.pipe(child.stdin);
  child.stdout.pipe(process.stdout);
  const handlers = new Map(["SIGTERM", "SIGINT", "SIGHUP"].map((signal) => [signal, () => child.kill(signal)]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  try {
    const [code] = await once(child, "exit");
    process.exitCode = code ?? 1;
  } finally {
    input.close(); output.close();
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}

function complete(response, item, sequence) {
  const id = `routing_check_${sequence}`;
  const events = [
    { type: "response.created", response: { id, status: "in_progress", output: [] } },
    { type: "response.output_item.done", output_index: 0, item },
    { type: "response.completed", response: { id, status: "completed", output: [item],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } },
  ];
  response.writeHead(200, { "Content-Type": "text/event-stream" });
  response.end(events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
}

async function probeProfile({ codex, serverConfig, codeModeOnly }) {
  const directory = await mkdtemp(join(tmpdir(), "autonomous-cua-routing-"));
  const logPath = join(directory, "mcp.jsonl");
  let catalog, requestMeta, route, threadId, output = "", stderr = "", sequence = 0, handlerError;
  let child;
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "POST" || request.url !== "/v1/responses") {
        response.writeHead(404).end(); return;
      }
      let body = "";
      for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body);
      sequence += 1;
      let item;
      if (sequence === 1) {
        catalog = summarizeCatalog(payload.tools);
        requestMeta = request.headers["x-codex-turn-metadata"];
        route = codeModeOnly && catalog.codeMode ? "code_mode" : catalog.direct ? "direct" : null;
        const args = { code: `nodeRepl.write(${JSON.stringify(marker)})`, title: "Verify registered CUA dispatch" };
        if (route === "code_mode") item = { id: "routing_call", type: "custom_tool_call", call_id: "routing_call", name: "exec",
          input: `if (ALL_TOOLS.some(tool => tool.name === "${namespace}__turn_ended") || typeof tools.${namespace}__turn_ended !== "undefined") throw new Error("Lifecycle tool exposed in code mode"); text(await tools.${namespace}__js(${JSON.stringify(args)}));` };
        else if (route === "direct") {
          const namespaced = payload.tools.some((tool) => tool.type === "namespace" && tool.name === namespace);
          item = { id: "routing_call", type: "function_call", call_id: "routing_call",
            name: namespaced ? "js" : `${namespace}__js`, ...(namespaced ? { namespace } : {}), arguments: JSON.stringify(args) };
        }
      }
      item ??= { id: "routing_done", type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: "Routing diagnostic complete.", annotations: [] }] };
      complete(response, item, sequence);
    } catch (error) { handlerError = error; response.writeHead(500).end(); }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const descriptorPath = join(directory, "server.json");
    await writeFile(descriptorPath, JSON.stringify({ command: serverConfig.command,
      args: serverConfig.args ?? [], env: { CODEX_HOME: codexHome, ...serverConfig.env } }), { mode: 0o600 });
    // A deterministic loopback responder drives Core's real catalog and dispatch code.
    // No model service, credentials, copied session IDs, UI actions, or persistent threads.
    const config = `model = "autonomous-cua-routing-fixture"
model_provider = "routing_check"
project_doc_max_bytes = 0
include_environment_context = false
[model_providers.routing_check]
name = "Local deterministic routing diagnostic"
base_url = "http://127.0.0.1:${server.address().port}/v1"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
request_max_retries = 0
stream_max_retries = 0
[features]
code_mode = { enabled = true, direct_only_tool_namespaces = ["mcp__codex_apps__hotline"] }
code_mode_only = ${codeModeOnly}
plugins = false
apps = false
[mcp_servers.autonomous_cua_repl]
command = ${JSON.stringify(process.execPath)}
args = ${JSON.stringify([sourceFile, "--record-mcp", descriptorPath, logPath])}
enabled_tools = ${JSON.stringify(serverConfig.enabled_tools ?? ["js", "js_reset", "turn_ended"])}
disabled_tools = ${JSON.stringify(serverConfig.disabled_tools ?? [])}
omit_tools_from = ${JSON.stringify(serverConfig.omit_tools_from ?? [])}
default_tools_approval_mode = "approve"
startup_timeout_sec = 120
`;
    await writeFile(join(directory, "config.toml"), config, { mode: 0o600 });
    child = spawn(codex, ["exec", "--json", "--ephemeral", "--skip-git-repo-check", "-s", "read-only", "-C", directory,
      "Run the deterministic CUA dispatch diagnostic."], {
      env: { ...process.env, CODEX_HOME: directory }, stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-4000); });
    const [code] = await once(child, "exit");
    if (handlerError) throw handlerError;
    for (const line of output.split("\n")) {
      try { const event = JSON.parse(line); if (event.type === "thread.started") threadId = event.thread_id; } catch { /* Non-JSON diagnostics. */ }
    }
    const records = (await readFile(logPath, "utf8").catch(() => "")).trim().split("\n").filter(Boolean).map(JSON.parse);
    const registered = records.find((record) => record.type === "registered");
    const result = records.find((record) => record.type === "result");
    const call = records.find((record) => record.type === "call");
    const lifecycle = registered?.tools?.find((tool) => tool.name === "turn_ended");
    const registrationOk = ["js", "js_reset", "turn_ended"].every((name) => registered?.tools?.some((tool) => tool.name === name));
    const contextBound = contextMatches(call, requestMeta, threadId);
    const lifecycleHidden = Boolean(catalog?.lifecycleHidden && Array.isArray(lifecycle?.visibility) && lifecycle.visibility.length === 0);
    const dispatchOk = Boolean(result?.ok && result.marker && sequence === 2);
    return {
      ok: code === 0 && registrationOk && Boolean(route) && lifecycleHidden && contextBound && dispatchOk,
      scope: "isolated_local_catalog_and_dispatch", codeModeOnly, registered: registrationOk,
      catalog: catalog ?? null, route, lifecycleHidden, contextBound, dispatchOk,
      browserAccess: "not_tested", liveDelegatedTask: "not_verified",
      ...(code !== 0 ? { error: `Codex exited ${code}: ${stderr}` } : {}),
    };
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

export async function verifyToolRouting(options) {
  const directLocal = await probeProfile({ ...options, codeModeOnly: false });
  const delegatedConfiguration = await probeProfile({ ...options, codeModeOnly: true });
  return {
    ok: directLocal.ok && delegatedConfiguration.ok,
    directLocal,
    delegated: {
      status: "not_verified",
      reason: "A live Work task's capability registration and final catalog are owned by its host, not this local CLI.",
      localConfigurationProbe: delegatedConfiguration,
    },
  };
}

if (process.argv[1] === sourceFile && process.argv[2] === "--record-mcp") {
  await recordMcp(process.argv[3], process.argv[4]);
}
