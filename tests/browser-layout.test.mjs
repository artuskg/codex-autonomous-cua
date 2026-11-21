import assert from "node:assert/strict";
import { test } from "node:test";
import { getBrowserCoreRelative, transformBrowser } from "../scripts/build-overlay.mjs";

// Original fixtures model the minified layout and compatibility seams.
const lazyImport = 'var path$="./browser-service-core.mjs",cache,load=()=>cache??=import(path$);';
const entry = `${lazyImport}export const handleRpc=()=>load();`;
const enumSeam = 'mode.DisabledForLocalTesting="disabled-for-local-testing",';
const policyTable = '{"":{bypassedSecurityChecks:empty,operationsWithoutUserConsent:empty},"disabled-for-local-testing":{bypassedSecurityChecks:local,operationsWithoutUserConsent:consent},"gaas-browser-environment":{}}';
const operations = [
  "browser-history-read",
  "browser-origin-access",
  "file-download",
  "file-upload",
  "full-cdp",
  "page-asset-cross-origin-fetch",
  "page-asset-download",
  "raw-cdp-destination-url",
  "webmcp-tool-call",
];
const consentSet = `consent=new Set(${JSON.stringify(operations)})`;
const core = `const mode={};(${enumSeam}mode);const empty=new Set,${consentSet},local=new Set(["check-navigation-url-policy","check-url-site-status"]),table=${policyTable};`;

test("uses the sibling core for the split layout and preserves the entry import", () => {
  assert.equal(getBrowserCoreRelative(entry), "@oai/browser-desktop/scripts/browser-service-core.mjs");
  assert.throws(() => transformBrowser(entry), /enum seam is not unique/);
  const patched = transformBrowser(core);
  assert.equal(patched, core
    .replace(enumSeam, `${enumSeam}mode.AutonomousVm="autonomous-vm",`)
    .replace('"gaas-browser-environment":', '"autonomous-vm":{bypassedSecurityChecks:empty,operationsWithoutUserConsent:consent},"gaas-browser-environment":'));
});

test("uses the existing seams in a monolithic browser service", () => {
  assert.equal(getBrowserCoreRelative(core), undefined);
  assert.match(transformBrowser(core), /mode\.AutonomousVm="autonomous-vm"/);
});

test("refuses duplicate, rewired, or ambiguous browser core imports", () => {
  for (const source of [
    entry + lazyImport,
    entry.replace("import(path$)", "import(other)"),
    entry.replace("cache??=", "other??="),
    entry + 'const duplicate="./browser-service-core.mjs";',
  ]) assert.throws(() => getBrowserCoreRelative(source), /core import seam is not unique/);
  for (const seam of [enumSeam, policyTable]) {
    assert.throws(() => getBrowserCoreRelative(entry + seam), /entry unexpectedly contains a security-mode seam/);
  }
});

test("refuses missing or duplicated browser policy seams and bindings", () => {
  for (const [seam, error] of [
    [enumSeam, /enum seam is not unique/],
    [policyTable, /policy table seam is not unique/],
    ["empty=new Set,", /empty bypass set is missing or not unique/],
    [consentSet, /consent-operation set is missing or not unique/],
  ]) {
    assert.throws(() => transformBrowser(core.replace(seam, "")), error);
    assert.throws(() => transformBrowser(core + seam), error);
  }
});
