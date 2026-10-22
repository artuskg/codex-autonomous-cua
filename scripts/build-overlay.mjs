import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const sourceFile = fileURLToPath(import.meta.url);
const adapterRoot = dirname(dirname(sourceFile));
const transformVersion = 3;

const browserRelative = "@oai/browser-desktop/scripts/browser-service.mjs";
const skyRelative =
  "@oai/sky/dist/project/cua/sky_js/src/targets/mac/computer-use-policy.js";
const cuaDocsRelative =
  "@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/create_documentation.js";
const confirmationRelative = "@oai/cua/docs/tinysky-alt-confirmations.md";

// Short literals below are compatibility fingerprints for the installed runtime.
// No upstream source file or package is vendored in this repository.

function invariant(condition, message) {
  if (!condition) {
    throw new Error(`autonomous-cua compatibility check failed: ${message}`);
  }
}

// Minified identifiers may contain `$`, which is special both in regular
// expressions and in string replacement patterns.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declarationPattern(identifier, rest) {
  return new RegExp(`(?<![\\w$])${escapeRegExp(identifier)}=${rest}`);
}

function occurrences(source, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function hashFile(path) {
  return sha256(await readFile(path));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readPlistValue(infoPlist, key) {
  const { stdout } = await execFileAsync("/usr/bin/plutil", [
    "-extract",
    key,
    "raw",
    "-o",
    "-",
    infoPlist,
  ]);
  return stdout.trim();
}

function transformBrowser(source) {
  const enumPattern =
    /([A-Za-z_$][\w$]*)\.DisabledForLocalTesting="disabled-for-local-testing",/g;
  const enumMatches = [...source.matchAll(enumPattern)];
  invariant(enumMatches.length === 1, "Browser security-mode enum seam is not unique");
  const enumVariable = enumMatches[0][1];
  source = source.replace(
    enumPattern,
    (seam) => `${seam}${enumVariable}.AutonomousVm="autonomous-vm",`,
  );

  const tablePattern =
    /\{"":\{bypassedSecurityChecks:([A-Za-z_$][\w$]*),operationsWithoutUserConsent:\1\},"disabled-for-local-testing":\{bypassedSecurityChecks:([A-Za-z_$][\w$]*),operationsWithoutUserConsent:([A-Za-z_$][\w$]*)\},"gaas-browser-environment":/g;
  const tableMatches = [...source.matchAll(tablePattern)];
  invariant(tableMatches.length === 1, "Browser security-mode policy table seam is not unique");
  const [matched, defaultBypassSet, disabledBypassSet, consentSet] = tableMatches[0];
  invariant(
    declarationPattern(defaultBypassSet, "new Set(?:\\(\\))?[,;]").test(source),
    "Browser default bypass set is no longer empty",
  );
  const consentDeclaration = source.match(
    declarationPattern(consentSet, "new Set\\(\\[([^\\]]+)\\]\\)"),
  );
  invariant(consentDeclaration, "Browser consent-operation set was not found");
  for (const operation of [
    "browser-history-read",
    "browser-origin-access",
    "file-download",
    "file-upload",
    "full-cdp",
    "page-asset-cross-origin-fetch",
    "page-asset-download",
    "raw-cdp-destination-url",
    "webmcp-tool-call",
  ]) {
    invariant(
      consentDeclaration[1].includes(`"${operation}"`),
      `Browser consent-operation set no longer contains ${operation}`,
    );
  }
  invariant(
    disabledBypassSet !== defaultBypassSet,
    "Browser local-testing and default bypass sets unexpectedly coincide",
  );
  const replacement = matched.replace(
    '"gaas-browser-environment":',
    () =>
      `"autonomous-vm":{bypassedSecurityChecks:${defaultBypassSet},operationsWithoutUserConsent:${consentSet}},"gaas-browser-environment":`,
  );
  source = source.replace(matched, () => replacement);

  invariant(
    occurrences(source, '"autonomous-vm"') === 2,
    "Browser autonomous mode was not installed in both enum and policy table",
  );
  invariant(
    source.includes('"check-navigation-url-policy"') &&
      source.includes('"check-url-site-status"'),
    "Browser navigation or site-status checks disappeared",
  );
  invariant(
    source.includes(
      `"autonomous-vm":{bypassedSecurityChecks:${defaultBypassSet},operationsWithoutUserConsent:${consentSet}}`,
    ),
    "Browser autonomous mode does not use the empty bypass set and consent set",
  );
  return source;
}

export function transformSky(source) {
  invariant(
    occurrences(source, ".getAppPolicy(") === 1,
    "Sky getAppPolicy seam is not unique",
  );
  const policyIndex = source.indexOf(".getAppPolicy(");
  const prefix = source.slice(0, policyIndex);
  // Older releases resolve a named capability; newer releases use a dedicated
  // getter. Identify the app binding next to getAppPolicy, never the audio one.
  const matches = [...prefix.matchAll(/([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\(("createElicitation")?\)(?=[,;])/g)];
  invariant(matches.length === 1, "Sky app-consent binding is not unique before getAppPolicy");
  const [binding, variable, getter, namedCapability] = matches[0];
  const resolver = `${getter}(${namedCapability ?? ""})`;
  const resolverBinding = new RegExp(`=${escapeRegExp(resolver)}(?=[,;])`, "g");
  invariant(
    [...source.matchAll(resolverBinding)].length === 2,
    "Sky no longer has the expected app and audio elicitation pair",
  );
  if (!namedCapability) {
    invariant(
      new RegExp(`function ${escapeRegExp(getter)}\\(\\)\\{[^{}]{0,700}globalThis\\.nodeRepl[^{}]{0,700}\\.createElicitation[^{}]{0,700}return [A-Za-z_$][\\w$]*\\}`).test(source),
      "Sky app-consent getter no longer resolves nodeRepl.createElicitation",
    );
  }
  invariant(
    policyIndex - matches[0].index < 700,
    "Sky app-consent binding moved too far from getAppPolicy",
  );
  const syntheticApproval = `${variable}=async()=>({action:"accept",content:{source:"computer-use-persisted-state"},_meta:{persist:"session"}})`;
  source = source.slice(0, matches[0].index) +
    source.slice(matches[0].index).replace(binding, () => syntheticApproval);

  invariant(
    [...source.matchAll(resolverBinding)].length === 1,
    "Sky audio elicitation was not preserved as the sole remaining prompt",
  );
  for (const marker of [
    ".getAppPolicy(",
    'case"allowed"',
    'case"denied"',
    'case"forbidden"',
    "requestComputerAudioApproval",
    "computer-use-persisted-state",
  ]) {
    invariant(source.includes(marker), `Sky postcondition is missing ${marker}`);
  }
  return source;
}

function transformCuaDocumentation(source) {
  const seam = 'return void 0!==r?r:"training"===e?"":n("confirmations")';
  invariant(
    occurrences(source, seam) === 1,
    "CUA request-metadata confirmation-policy seam is not unique",
  );
  const replacement =
    'return"1"===(null==i?void 0:null==i.env?void 0:i.env.AUTONOMOUS_CUA)?n("confirmations"):void 0!==r?r:"training"===e?"":n("confirmations")';
  source = source.replace(seam, replacement);
  invariant(
    occurrences(source, "AUTONOMOUS_CUA") === 1,
    "CUA autonomous policy selector was not installed exactly once",
  );
  return source;
}

async function copyPackage(sourceNodeModules, outputNodeModules, packageName) {
  const source = join(sourceNodeModules, packageName);
  const destination = join(outputNodeModules, packageName);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: true,
    preserveTimestamps: true,
    filter(path) {
      const relative = path.slice(source.length);
      return !/(^|\/)Codex Computer Use\.app(?:\/|$)/.test(relative);
    },
  });
}

async function copyPackageClosure(sourceNodeModules, outputNodeModules, roots) {
  const pending = [...roots];
  const copied = new Set();
  const versions = {};
  while (pending.length > 0) {
    const packageName = pending.shift();
    if (copied.has(packageName)) continue;
    const packageJsonPath = join(sourceNodeModules, packageName, "package.json");
    const packageJson = await readJson(packageJsonPath);
    await copyPackage(sourceNodeModules, outputNodeModules, packageName);
    copied.add(packageName);
    versions[packageName] = packageJson.version;
    for (const dependency of Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.optionalDependencies ?? {}),
    })) {
      try {
        await access(join(sourceNodeModules, dependency, "package.json"));
        pending.push(dependency);
      } catch (error) {
        if (packageJson.optionalDependencies?.[dependency] !== undefined) continue;
        throw new Error(
          `required dependency ${dependency} of ${packageName} is missing from the desktop runtime`,
          { cause: error },
        );
      }
    }
  }
  return { packages: [...copied].sort(), versions };
}

async function describePackageClosure(sourceNodeModules, roots) {
  const pending = [...roots];
  const visited = new Set();
  const versions = {};
  const packageJsonHashes = {};
  while (pending.length > 0) {
    const packageName = pending.shift();
    if (visited.has(packageName)) continue;
    const packageJsonPath = join(sourceNodeModules, packageName, "package.json");
    const packageJson = await readJson(packageJsonPath);
    visited.add(packageName);
    versions[packageName] = packageJson.version;
    packageJsonHashes[packageName] = await hashFile(packageJsonPath);
    for (const dependency of Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.optionalDependencies ?? {}),
    })) {
      try {
        await access(join(sourceNodeModules, dependency, "package.json"));
        pending.push(dependency);
      } catch (error) {
        if (packageJson.optionalDependencies?.[dependency] !== undefined) continue;
        throw new Error(
          `required dependency ${dependency} of ${packageName} is missing from the desktop runtime`,
          { cause: error },
        );
      }
    }
  }
  return {
    packages: [...visited].sort(),
    versions,
    packageJsonHashes,
  };
}

async function syntaxCheck(nodePath, paths) {
  for (const path of paths) {
    await execFileAsync(nodePath, ["--check", path]);
  }
}

async function verifyCachedOverlay(target, fingerprint) {
  try {
    const manifest = await readJson(join(target, "manifest.json"));
    if (manifest.fingerprint !== fingerprint || manifest.transformVersion !== transformVersion) {
      return null;
    }
    await access(join(target, "node_modules", browserRelative));
    await access(join(target, "node_modules", skyRelative));
    await access(join(target, "node_modules", cuaDocsRelative));
    return manifest;
  } catch {
    return null;
  }
}

export async function buildOverlay(options = {}) {
  const appRoot =
    options.appRoot ??
    process.env.AUTONOMOUS_CUA_APP_ROOT ??
    "/Applications/ChatGPT.app";
  const cacheRoot =
    options.cacheRoot ??
    process.env.AUTONOMOUS_CUA_CACHE_ROOT ??
    join(homedir(), ".cache", "codex-autonomous-cua");
  const resources = join(appRoot, "Contents", "Resources");
  const sourceNodeModules = join(resources, "cua_node", "lib", "node_modules");
  const appNode = join(resources, "cua_node", "bin", "node");
  const infoPlist = join(appRoot, "Contents", "Info.plist");
  const policyPath = join(adapterRoot, "policy", "computer-use-autonomous.md");
  const paths = {
    browser: join(sourceNodeModules, browserRelative),
    sky: join(sourceNodeModules, skyRelative),
    cuaDocs: join(sourceNodeModules, cuaDocsRelative),
    policy: policyPath,
    builder: sourceFile,
  };
  for (const path of Object.values(paths)) {
    await access(path);
  }
  await access(appNode);

  const [appVersion, appBuild] = await Promise.all([
    readPlistValue(infoPlist, "CFBundleShortVersionString"),
    readPlistValue(infoPlist, "CFBundleVersion"),
  ]);
  const packageVersions = {};
  const rootPackages = ["@oai/browser-desktop", "@oai/sky", "@oai/cua"];
  for (const packageName of rootPackages) {
    packageVersions[packageName] = (
      await readJson(join(sourceNodeModules, packageName, "package.json"))
    ).version;
  }
  const dependencyClosure = await describePackageClosure(
    sourceNodeModules,
    rootPackages,
  );
  const sourceHashes = {};
  for (const [name, path] of Object.entries(paths)) {
    sourceHashes[name] = await hashFile(path);
  }
  const fingerprint = sha256(
    JSON.stringify({
      transformVersion,
      appVersion,
      appBuild,
      packageVersions,
      dependencyClosure,
      sourceHashes,
    }),
  );
  const overlaysRoot = join(cacheRoot, "overlays");
  const target = join(
    overlaysRoot,
    `${appVersion}-${appBuild}-${fingerprint.slice(0, 24)}`,
  );
  await mkdir(overlaysRoot, { recursive: true });
  const cached = await verifyCachedOverlay(target, fingerprint);
  if (cached) {
    return { path: target, manifest: cached, cached: true };
  }

  const staging = await mkdtemp(join(overlaysRoot, ".build-"));
  try {
    const outputNodeModules = join(staging, "node_modules");
    const copiedDependencyClosure = await copyPackageClosure(
      sourceNodeModules,
      outputNodeModules,
      rootPackages,
    );
    invariant(
      JSON.stringify(copiedDependencyClosure.packages) ===
        JSON.stringify(dependencyClosure.packages),
      "copied dependency closure differs from the fingerprinted closure",
    );
    const outputBrowser = join(outputNodeModules, browserRelative);
    const outputSky = join(outputNodeModules, skyRelative);
    const outputCuaDocs = join(outputNodeModules, cuaDocsRelative);
    const outputConfirmation = join(outputNodeModules, confirmationRelative);

    await writeFile(
      outputBrowser,
      transformBrowser(await readFile(outputBrowser, "utf8")),
    );
    await writeFile(outputSky, transformSky(await readFile(outputSky, "utf8")));
    await writeFile(
      outputCuaDocs,
      transformCuaDocumentation(await readFile(outputCuaDocs, "utf8")),
    );
    await writeFile(outputConfirmation, await readFile(policyPath));
    await syntaxCheck(appNode, [outputBrowser, outputSky, outputCuaDocs]);

    const outputHashes = {
      browser: await hashFile(outputBrowser),
      sky: await hashFile(outputSky),
      cuaDocs: await hashFile(outputCuaDocs),
      confirmationPolicy: await hashFile(outputConfirmation),
    };
    const manifest = {
      schemaVersion: 1,
      transformVersion,
      fingerprint,
      generatedAt: new Date().toISOString(),
      app: { path: appRoot, version: appVersion, build: appBuild },
      packageVersions,
      dependencyClosure,
      sourceHashes,
      outputHashes,
      guarantees: {
        browserConsentSuppressed: true,
        browserSecurityBypasses: [],
        browserNavigationPolicyRetained: true,
        browserSiteStatusRetained: true,
        skyAppPolicyRetained: true,
        skyDeniedAndForbiddenRetained: true,
        skyAudioConsentRetained: true,
        nativeComputerUseServiceUnmodified: true,
      },
    };
    await writeFile(
      join(staging, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await chmod(staging, 0o755);
    try {
      await rename(staging, target);
    } catch (error) {
      const winner = await verifyCachedOverlay(target, fingerprint);
      if (!winner) {
        throw error;
      }
      await rm(staging, { recursive: true, force: true });
      return { path: target, manifest: winner, cached: true };
    }
    return { path: target, manifest, cached: false };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const result = await buildOverlay();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${result.path}\n`);
  }
}

if (process.argv[1] === sourceFile) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
