import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildOverlay, transformSky } from "./build-overlay.mjs";

const { path, manifest, cached } = await buildOverlay();
const browser = await readFile(
  join(path, "node_modules/@oai/browser-desktop/scripts/browser-service.mjs"),
  "utf8",
);
const sky = await readFile(
  join(
    path,
    "node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/computer-use-policy.js",
  ),
  "utf8",
);
const cuaDocs = await readFile(
  join(
    path,
    "node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/create_documentation.js",
  ),
  "utf8",
);
const sourceSky = await readFile(join(manifest.app.path, "Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/computer-use-policy.js"), "utf8");
const checks = {
  browserMode: browser.includes('AutonomousVm="autonomous-vm"'),
  browserPolicy: /"autonomous-vm":\{bypassedSecurityChecks:[A-Za-z_$][\w$]*,operationsWithoutUserConsent:[A-Za-z_$][\w$]*\}/.test(
    browser,
  ),
  browserNavigationPolicy: browser.includes('"check-navigation-url-policy"'),
  browserSiteStatus: browser.includes('"check-url-site-status"'),
  skyPolicy: sky.includes(".getAppPolicy("),
  skyDenied: sky.includes('case"denied"'),
  skyForbidden: sky.includes('case"forbidden"'),
  skyOnlyAudioPrompt: sky === transformSky(sourceSky),
  cuaLocalPolicySelector: cuaDocs.includes("AUTONOMOUS_CUA"),
  nativeServiceUnmodified: manifest.guarantees.nativeComputerUseServiceUnmodified,
};
const failed = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);
if (failed.length > 0) {
  throw new Error(`overlay verification failed: ${failed.join(", ")}`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      cached,
      path,
      app: manifest.app,
      packageVersions: manifest.packageVersions,
      fingerprint: manifest.fingerprint,
      checks,
    },
    null,
    2,
  )}\n`,
);
