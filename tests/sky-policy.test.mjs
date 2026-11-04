import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { transformSky } from "../scripts/build-overlay.mjs";

// Original fixtures model only the small compatibility seam, not vendor code.
for (const getter of ['b("createElicitation")', 'get$()']) {
  test(`supports the app/audio binding shape ${getter}`, () => {
    const helper = getter === 'get$()' ? 'function get$(){const n=globalThis.nodeRepl,t=n.createElicitation;return t}' : '';
    const source = `function* app(){const consent$=${getter},client=yield next(),policy=client.getAppPolicy();switch(policy.decision){case"allowed":break;case"denied":throw 1;case"forbidden":throw 2;}}function requestComputerAudioApproval(){const audio=${getter};} ${helper}`;
    const output = transformSky(source);
    assert.match(output, /consent\$=async/);
    assert.ok(output.includes(`const audio=${getter}`));
    assert.throws(() => transformSky(source + `const duplicate=${getter};`), /expected app and audio/);
  });
}

test("supports the guarded indirect nodeRepl getter without widening the accepted source", () => {
  const accessor = 'function repl$(){return globalThis.nodeRepl}';
  const helper = 'function get$(){const n=repl$(),t=null==n?void 0:n.createElicitation;if("function"!=typeof t)throw new Error("Computer Use requires nodeRepl.createElicitation");return t}';
  const policy = 'function* app(){const consent$=get$(),client=yield next(),policy=client.getAppPolicy();switch(policy.decision){case"allowed":break;case"denied":throw 1;case"forbidden":throw 2;}}function requestComputerAudioApproval(){const audio=get$();}';
  const source = `${policy}${helper}${accessor}`;
  const output = transformSky(source);
  assert.match(output, /consent\$=async/);
  assert.ok(output.includes('const audio=get$();'));
  assert.ok(output.endsWith(`${helper}${accessor}`));
  for (const changed of [
    source.replace('return globalThis.nodeRepl', 'return globalThis.other'),
    source.replace('const n=repl$()', 'const n=other()'),
    source.replace('n.createElicitation', 'n.other'),
    source.replace('return t}', 'return fallback}'),
    source + 'function repl$(){return globalThis.other}',
    source + 'const extra=get$();',
  ]) assert.throws(() => transformSky(changed), /compatibility check failed/);
});

test("installed Sky still denies blocked apps and prompts for audio", async (t) => {
  const root = process.env.AUTONOMOUS_CUA_APP_ROOT ?? "/Applications/ChatGPT.app";
  let original;
  try { original = await readFile(`${root}/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/computer-use-policy.js`, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return t.skip("desktop runtime is not installed"); throw error; }
  let decision = "allowed";
  let prompts = 0;
  let calls = 0;
  const stubs = {
    async __awaiter(self, args, promise, factory) {
      const generator = factory.call(self);
      let next = generator.next();
      while (!next.done) {
        try { next = generator.next(await next.value); }
        catch (error) { next = generator.throw(error); }
      }
      return next.value;
    },
    getClient: async () => ({ getAppPolicy: async () => ({ decision, target: { bundleIdentifier: "example.Test", displayName: "Test", appPath: "/Test.app" } }) }),
    logComputerUseToolCalled() {}, logComputerUseApprovalRequested() {}, logComputerUseApprovalResolved() {},
    SkyComputerUseError: Error, ServerErrorCode: {},
  };
  let source = transformSky(original).replace(/import\{([^}]+)\}from"[^"]+";/g, (_, bindings) => bindings.split(",").map((binding) => {
    const [name, alias = name] = binding.trim().split(/ as /);
    assert.ok(name in stubs, `unknown installed dependency ${name}`);
    return `const ${alias}=stubs.${name};`;
  }).join(""));
  source = source.replace(/export\{([^}]+)\};/, (_, bindings) => `globalThis.policy={${bindings.split(",").map((binding) => {
    const [local, name = local] = binding.trim().split(/ as /);
    return `${name}:${local}`;
  }).join(",")}};`);
  const context = vm.createContext({ stubs, performance: globalThis.performance, nodeRepl: { createElicitation: async () => { prompts++; return { action: "decline" }; } } });
  vm.runInContext(source, context);
  const operate = () => context.policy.withComputerUsePolicy("click", { app: "example.Test" }, async () => { calls++; return "ok"; });
  assert.equal(await operate(), "ok");
  assert.equal(prompts, 0);
  for (decision of ["denied", "forbidden"]) await assert.rejects(operate());
  assert.equal(calls, 1);
  await assert.rejects(context.policy.requestComputerAudioApproval(), /not approved/);
  assert.equal(prompts, 1);
});
