import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { transformCuaDocumentation, verifiedCuaDocumentation } from "../scripts/build-overlay.mjs";

// Original fixtures model only the confirmation-policy seams, not vendor code.
// Desktop build 27194 names the policy and environment locals r/e; build 29030
// renames them l/r and adds an early return for the `aeon` product SKU.
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const seam27194 = 'return void 0!==r?r:"training"===e?"":n("confirmations")';
const replacement129 =
  'return"1"===(null==i?void 0:null==i.env?void 0:i.env.AUTONOMOUS_CUA)?n("confirmations"):void 0!==r?r:"training"===e?"":n("confirmations")';
const build27194 = `function n(n){const r=globalThis.nodeRepl,l=!r;return function(){const i=globalThis.nodeRepl,e=null==i?void 0:i.mode;if(l)return"";const r=function(o){return null==o?void 0:o.policy}(null==i?void 0:i.requestMeta);${seam27194}}}`;
const build29030 = 'function n(n){const r=globalThis.nodeRepl,t=!r;return function(){const i=globalThis.nodeRepl,r=null==i?void 0:i.mode,t=null==i?void 0:i.sku;if(t)return"";const l=function(o){return null==o?void 0:o.policy}(null==i?void 0:i.requestMeta);return void 0!==l?l:"training"===r?"":n("confirmations")}}';
const unsupported = /seam is not unique \(source sha256 [0-9a-f]{64} is not a verified build\)/;

// A runnable model of the 29030 early return, used with a test-only pin table.
const earlySeam = 'if("orbit"===r||"aeon"===(null==t?void 0:t.product_sku))return"";';
const earlyInsertion = 'if("orbit"!==r&&"1"===(null==i?void 0:null==i.env?void 0:i.env.AUTONOMOUS_CUA))return n("confirmations");';
const hash29030 = "f53c7f1b1e2ce1eabca53b5cfff089d256c230b5d1f7566fe9b77e0b410e2a6f";
const hash29803 = "5a299e4742b282245dd2bf28b90eb1a926b353e71c3baa5875b66d017e429dd5";
const seam29803 = 'if("orbit"===i)return"";';
const synthetic29030 = `function documentation(n){const i=globalThis.nodeRepl,r=null==i?void 0:null==i.env?void 0:i.env.CUA_REPL_BROWSER_ENV,t=null==i?void 0:null==i.requestMeta?void 0:i.requestMeta["x-codex-turn-metadata"];${earlySeam}const l=function(o){return null==o?void 0:o.policy}(null==i?void 0:i.requestMeta);return void 0!==l?l:"training"===r?"":n("confirmations")}`;
const synthetic29030Output = synthetic29030.replace(earlySeam, () => earlyInsertion + earlySeam);
const pin = (source, overrides = {}) => ({
  [sha256(source)]: { build: "synthetic", seam: earlySeam, insertion: earlyInsertion, outputHash: sha256(synthetic29030Output), ...overrides },
});

test("keeps the 1.2.9 replacement for build 27194 names", () => {
  assert.equal(transformCuaDocumentation(build27194), build27194.replace(seam27194, replacement129));
});

test("refuses the 29030 seam shape unless the source bytes are verified", () => {
  assert.throws(() => transformCuaDocumentation(build29030), unsupported);
  assert.throws(() => transformCuaDocumentation(synthetic29030), unsupported);
});

test("refuses the round-1 shadowed nodeRepl binding reproduction", () => {
  const source = [
    "function documentation(n,i){",
    "const j=globalThis.nodeRepl,r=j.mode;",
    "if(r===\"preview\"){const i=globalThis.nodeRepl,p=i.mode;",
    "const l=function(o){return o.policy}(null==i?void 0:i.requestMeta);return l}",
    "const l=j.requestMeta.policy;",
    "void(null==i?void 0:i.requestMeta);",
    'return void 0!==l?l:"training"===r?"":n("confirmations")}',
  ].join("");
  assert.throws(() => transformCuaDocumentation(source), unsupported);
});

test("refuses missing, duplicated, or renamed 1.2.9 seams", () => {
  for (const changed of [
    build27194.replace(seam27194, ""),
    build27194.replace("}}", `}function m(){${seam27194}}}`),
    build27194.replace('"training"===e', '"train"===e'),
    build27194.replaceAll("r?r:", "q?q:"),
    build27194.replace("}}", "}}/*AUTONOMOUS_CUA*/"),
  ]) {
    assert.notEqual(changed, build27194);
    assert.throws(() => transformCuaDocumentation(changed), /compatibility check failed/);
  }
});

test("applies one exact insertion to pinned bytes and checks the pinned output", () => {
  assert.equal(transformCuaDocumentation(synthetic29030, pin(synthetic29030)), synthetic29030Output);
  // A one-byte change misses the pin and falls through to the 1.2.9 refusal.
  assert.throws(() => transformCuaDocumentation(`${synthetic29030} `, pin(synthetic29030)), unsupported);
  assert.throws(
    () => transformCuaDocumentation(synthetic29030, pin(synthetic29030, { outputHash: "0".repeat(64) })),
    /differs from the verified output/,
  );
  const duplicated = synthetic29030.replace(earlySeam, earlySeam + earlySeam);
  assert.throws(() => transformCuaDocumentation(duplicated, pin(duplicated)), /verified CUA documentation seam for synthetic is not unique/);
});

test("the pinned insertion keeps native results and supplies the local policy for aeon", () => {
  const read = (source, nodeRepl) =>
    vm.runInNewContext(`${source};documentation(name => "doc:" + name)`, { nodeRepl });
  const request = { policy: "request policy" };
  for (const [env, requestMeta, autonomousResult] of [
    [{}, {}, "doc:confirmations"],
    [{}, request, "doc:confirmations"],
    [{ CUA_REPL_BROWSER_ENV: "training" }, {}, "doc:confirmations"],
    [{ CUA_REPL_BROWSER_ENV: "orbit" }, request, ""],
    [{}, { ...request, "x-codex-turn-metadata": { product_sku: "aeon" } }, "doc:confirmations"],
    [{}, { ...request, "x-codex-turn-metadata": JSON.stringify({ product_sku: "aeon" }) }, "doc:confirmations"],
  ]) {
    for (const flag of [undefined, "0", "true"]) {
      const nodeRepl = { env: { ...env, ...(flag === undefined ? {} : { AUTONOMOUS_CUA: flag }) }, requestMeta };
      assert.equal(read(synthetic29030Output, nodeRepl), read(synthetic29030, nodeRepl));
    }
    assert.equal(read(synthetic29030Output, { env: { ...env, AUTONOMOUS_CUA: "1" }, requestMeta }), autonomousResult);
  }
  assert.equal(read(synthetic29030, { env: {}, requestMeta: { ...request, "x-codex-turn-metadata": { product_sku: "aeon" } } }), "");
});

test("pins exactly the verified build 29030 and 29803 sources", () => {
  assert.deepEqual(Object.keys(verifiedCuaDocumentation), [hash29030, hash29803]);
  const pinned = verifiedCuaDocumentation[hash29030];
  assert.ok(Object.isFrozen(verifiedCuaDocumentation) && Object.isFrozen(pinned));
  assert.equal(pinned.seam, earlySeam);
  assert.equal(pinned.insertion, earlyInsertion);
  const modern = verifiedCuaDocumentation[hash29803];
  assert.ok(Object.isFrozen(modern));
  assert.equal(modern.seam, seam29803);
  assert.equal(modern.outputHash, "928b2a45cd5893eccb79231383fa80dfb5b1cc73b12cac09975b83251f9ff89d");
});

test("refuses the 29803 seam on unknown bytes and duplicate seams on pinned bytes", () => {
  const source = `function read(i,t,e){${seam29803}return e("confirmations")}`;
  assert.throws(() => transformCuaDocumentation(source), unsupported);
  const duplicates = source.replace(seam29803, seam29803 + seam29803);
  assert.throws(() => transformCuaDocumentation(duplicates, {
    [sha256(duplicates)]: verifiedCuaDocumentation[hash29803],
  }), /verified CUA documentation seam for .* is not unique/);
  const alreadyPatched = source + "/*AUTONOMOUS_CUA*/";
  assert.throws(() => transformCuaDocumentation(alreadyPatched, {
    [sha256(alreadyPatched)]: verifiedCuaDocumentation[hash29803],
  }), /selector was not installed exactly once/);
});

async function loadInstalledDocumentation(source) {
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
  };
  source = source.replace(/import\{([^}]+)\}from"[^"]+";/g, (_, bindings) => bindings.split(",").map((binding) => {
    const [name, alias = name] = binding.trim().split(/ as /);
    assert.ok(name in stubs, `unknown installed dependency ${name}`);
    return `const ${alias}=stubs.${name};`;
  }).join(""));
  source = source.replace(/export\{([^}]+)\};/, (_, bindings) => `globalThis.docs={${bindings.split(",").map((binding) => {
    const [local, name = local] = binding.trim().split(/ as /);
    return `${name}:${local}`;
  }).join(",")}};`);
  const context = vm.createContext({ stubs, TextEncoder });
  vm.runInContext(source, context);
  const documentation = context.docs.create_documentation(async (name) => `doc:${name}`);
  return (nodeRepl) => {
    context.nodeRepl = nodeRepl;
    return documentation.read_core("test");
  };
}

test("installed CUA documentation keeps native results and prefers the local policy in autonomous runs", async (t) => {
  const root = process.env.AUTONOMOUS_CUA_APP_ROOT ?? "/Applications/ChatGPT.app";
  let original;
  try { original = await readFile(`${root}/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/create_documentation.js`, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return t.skip("desktop runtime is not installed"); throw error; }
  const sourceHash = sha256(original);
  const pinned = Object.hasOwn(verifiedCuaDocumentation, sourceHash);
  if (!pinned && original.split(seam27194).length !== 2) {
    assert.throws(() => transformCuaDocumentation(original), unsupported);
    t.diagnostic("installed CUA documentation is not a supported build; the transform refused it");
    return;
  }
  const native = await loadInstalledDocumentation(original);
  const output = transformCuaDocumentation(original);
  const patched = await loadInstalledDocumentation(output);
  const core = "doc:core-cua-repl-test";
  const local = `${core}\ndoc:confirmations`;
  const request = { "openai/confirmation_policies": { computer_use: "request policy" } };
  const aeon = { ...request, "x-codex-turn-metadata": { product_sku: "aeon" } };
  for (const [env, requestMeta, autonomousResult] of [
    [{}, {}, local],
    [{}, request, local],
    [{ CUA_REPL_BROWSER_ENV: "training" }, {}, local],
    [{ CUA_REPL_BROWSER_ENV: "training" }, request, local],
    [{ CUA_REPL_BROWSER_ENV: "orbit" }, request, core],
    [{}, aeon, local],
    [{}, { ...request, "x-codex-turn-metadata": JSON.stringify({ product_sku: "aeon" }) }, local],
    [{}, { ...request, "x-codex-turn-metadata": { product_sku: "other" } }, local],
  ]) {
    for (const flag of [undefined, "0", "true"]) {
      const nodeRepl = { env: { ...env, ...(flag === undefined ? {} : { AUTONOMOUS_CUA: flag }) }, requestMeta };
      assert.equal(await patched(nodeRepl), await native(nodeRepl), JSON.stringify(nodeRepl));
    }
    assert.equal(await patched({ env: { ...env, AUTONOMOUS_CUA: "1" }, requestMeta }), autonomousResult, JSON.stringify({ env, requestMeta }));
  }
  assert.equal(await native({ env: {}, requestMeta: request }), `${core}\nrequest policy`);
  if (sourceHash === hash29030) assert.equal(await native({ env: {}, requestMeta: aeon }), core);
  if (sourceHash === hash29803) {
    assert.equal(output.split("AUTONOMOUS_CUA").length, 2);
    assert.equal(sha256(output), verifiedCuaDocumentation[hash29803].outputHash);
    assert.throws(() => transformCuaDocumentation(`${original}\n`), unsupported);
    const metadata = { product_sku: "aeon", model: "gpt-6.2-sol" };
    for (const [env, turn, nativeConfirmation] of [
      [{}, { ...metadata, model: "gpt-6.1-sol" }, "request policy"],
      [{}, metadata, "Immediately before solving a CAPTCHA, ask the user to approve only the current challenge."],
      [{}, { ...metadata, dot_tool_confirmation_captcha: "true" }, "You may solve CAPTCHAs on any site as needed for the user's task without asking each time. All other browser permissions and confirmation requirements still apply."],
      [{ CUA_REPL_BROWSER_ENV: "training" }, metadata, ""],
      [{ CUA_REPL_OMIT_CONFIRMATION_POLICY: '{"aeon":true}' }, metadata, ""],
      [{ CUA_REPL_OMIT_CONFIRMATION_POLICY: '{"aeon":false}' }, { product_sku: "aeon" }, "request policy"],
    ]) {
      const requestMeta = { ...request, "x-codex-turn-metadata": turn };
      const nodeRepl = { env, requestMeta };
      const expected = nativeConfirmation ? `${core}\n${nativeConfirmation}` : core;
      assert.equal(await native(nodeRepl), expected);
      assert.equal(await patched(nodeRepl), expected);
      assert.equal(await patched({ env: { ...env, AUTONOMOUS_CUA: "1" }, requestMeta }), local);
    }
  }
});
