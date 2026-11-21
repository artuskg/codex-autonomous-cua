import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isDeepStrictEqual, promisify } from "node:util";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const sourceFile = fileURLToPath(import.meta.url);
const adapterRoot = dirname(dirname(sourceFile));
const transformVersion = 7;

const browserRelative = "@oai/browser-desktop/scripts/browser-service.mjs";
const verifiedSplitBrowserEntries = Object.freeze({
  "41f17b10c08b8bb38a663b837aabe00d72a4b7344b3d1c816ec8a03849136c54": "browser-service-core.mjs",
});
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
  return new RegExp(`(?<![\\w$])${escapeRegExp(identifier)}=${rest}`, "g");
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

const browserEnumPattern =
  /([A-Za-z_$][\w$]*)\.DisabledForLocalTesting="disabled-for-local-testing",/g;
const browserTablePattern =
  /\{"":\{bypassedSecurityChecks:([A-Za-z_$][\w$]*),operationsWithoutUserConsent:\1\},"disabled-for-local-testing":\{bypassedSecurityChecks:([A-Za-z_$][\w$]*),operationsWithoutUserConsent:([A-Za-z_$][\w$]*)\},"gaas-browser-environment":/g;

export function getBrowserCoreRelative(entry) {
  const entryHash = sha256(entry);
  if (Object.hasOwn(verifiedSplitBrowserEntries, entryHash)) {
    return join(dirname(browserRelative), verifiedSplitBrowserEntries[entryHash]);
  }
  const source = entry.toString("utf8");
  invariant(
    !Object.values(verifiedSplitBrowserEntries).some((name) => source.includes(name)) &&
      source.search(browserEnumPattern) !== -1 && source.search(browserTablePattern) !== -1,
    `Browser entry sha256 ${entryHash} is not a verified split entry and lacks the monolithic layout`,
  );
  return undefined;
}

export function transformBrowser(source) {
  const enumMatches = [...source.matchAll(browserEnumPattern)];
  invariant(enumMatches.length === 1, "Browser security-mode enum seam is not unique");
  const enumVariable = enumMatches[0][1];
  source = source.replace(
    browserEnumPattern,
    (seam) => `${seam}${enumVariable}.AutonomousVm="autonomous-vm",`,
  );

  const tableMatches = [...source.matchAll(browserTablePattern)];
  invariant(tableMatches.length === 1, "Browser security-mode policy table seam is not unique");
  const [matched, defaultBypassSet, disabledBypassSet, consentSet] = tableMatches[0];
  invariant(
    [...source.matchAll(declarationPattern(defaultBypassSet, "new Set(?:\\(\\))?[,;]"))].length === 1,
    "Browser default empty bypass set is missing or not unique",
  );
  const consentDeclarations = [
    ...source.matchAll(declarationPattern(consentSet, "new Set\\(\\[([^\\]]+)\\]\\)")),
  ];
  invariant(consentDeclarations.length === 1, "Browser consent-operation set is missing or not unique");
  const [consentDeclaration] = consentDeclarations;
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
    const directGetter = new RegExp(`function ${escapeRegExp(getter)}\\(\\)\\{[^{}]{0,700}globalThis\\.nodeRepl[^{}]{0,700}\\.createElicitation[^{}]{0,700}return [A-Za-z_$][\\w$]*\\}`).test(source);
    // Sky 0.7.17 factors nodeRepl access into a separate zero-argument helper.
    // Accept only the observed guarded getter and an exact nodeRepl accessor,
    // not an arbitrary indirection or fallback consent provider.
    const indirectGetter = source.match(new RegExp(
      `function ${escapeRegExp(getter)}\\(\\)\\{const ([A-Za-z_$][\\w$]*)=([A-Za-z_$][\\w$]*)\\(\\),([A-Za-z_$][\\w$]*)=null==\\1\\?void 0:\\1\\.createElicitation;if\\("function"!=typeof \\3\\)throw new Error\\("Computer Use requires nodeRepl.createElicitation"\\);return \\3\\}`,
    ));
    const accessor = indirectGetter?.[2];
    const indirectNodeRepl = accessor &&
      occurrences(source, `function ${accessor}(){return globalThis.nodeRepl}`) === 1 &&
      [...source.matchAll(new RegExp(`function ${escapeRegExp(accessor)}\\(`, "g"))].length === 1;
    invariant(
      directGetter || indirectNodeRepl,
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

// These builds lack the legacy seam. Install the selector only on verified
// source bytes, using one exact insertion with a pinned output. It takes
// precedence over product-SKU and request policy for autonomous runs; orbit
// still omits confirmations, and other runs retain the upstream behavior.
export const verifiedCuaDocumentation = Object.freeze({
  f53c7f1b1e2ce1eabca53b5cfff089d256c230b5d1f7566fe9b77e0b410e2a6f: Object.freeze({
    build: "26.1111.71704 (29030)",
    seam: 'if("orbit"===r||"aeon"===(null==t?void 0:t.product_sku))return"";',
    insertion: 'if("orbit"!==r&&"1"===(null==i?void 0:null==i.env?void 0:i.env.AUTONOMOUS_CUA))return n("confirmations");',
    outputHash: "fe00526f79e8e62a88736f42c6b779f9ed8604b04675bc6683d47aee91f7e5bc",
  }),
  "5a299e4742b282245dd2bf28b90eb1a926b353e71c3baa5875b66d017e429dd5": Object.freeze({
    build: "26.1117.41037 (29803)",
    seam: 'if("orbit"===i)return"";',
    insertion: 'if("orbit"!==i&&"1"===(null==t?void 0:null==t.env?void 0:t.env.AUTONOMOUS_CUA))return e("confirmations");',
    outputHash: "928b2a45cd5893eccb79231383fa80dfb5b1cc73b12cac09975b83251f9ff89d",
  }),
});

export function transformCuaDocumentation(source, verified = verifiedCuaDocumentation) {
  const sourceHash = sha256(source);
  const pinned = Object.hasOwn(verified, sourceHash) ? verified[sourceHash] : undefined;
  if (pinned) {
    invariant(
      occurrences(source, pinned.seam) === 1,
      `verified CUA documentation seam for ${pinned.build} is not unique`,
    );
    const seamIndex = source.indexOf(pinned.seam);
    const output = source.slice(0, seamIndex) + pinned.insertion + source.slice(seamIndex);
    invariant(
      occurrences(output, "AUTONOMOUS_CUA") === 1,
      "CUA autonomous policy selector was not installed exactly once",
    );
    invariant(
      sha256(output) === pinned.outputHash,
      `CUA documentation output for ${pinned.build} differs from the verified output`,
    );
    return output;
  }
  // Every other source keeps the exact 1.2.9 match and replacement.
  const seam = 'return void 0!==r?r:"training"===e?"":n("confirmations")';
  invariant(
    occurrences(source, seam) === 1,
    `CUA request-metadata confirmation-policy seam is not unique (source sha256 ${sourceHash} is not a verified build)`,
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

async function lstatIfPresent(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function checkedModulePath(root, module, { allowMissingFile = false } = {}) {
  const path = resolve(root, module);
  const parts = relative(resolve(root), path).split(sep);
  invariant(parts[0] && parts[0] !== ".." && !isAbsolute(module), `module path leaves its root: ${module}`);
  invariant((await lstat(root)).isDirectory(), `module root is not a real directory: ${root}`);
  const canonicalRoot = await realpath(root);
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    invariant((await lstat(current)).isDirectory(), `module ancestor is not a real directory: ${current}`);
  }
  const file = await lstatIfPresent(path);
  invariant(file?.isFile() || (!file && allowMissingFile), `module is not a regular file: ${path}`);
  const resolved = file ? path : dirname(path);
  const expected = join(canonicalRoot, relative(root, resolved));
  invariant(await realpath(resolved) === expected, `module path leaves its root: ${path}`);
  return path;
}

async function verifyOverlayBytes(nodeModules, outputPaths, expectedOutputs) {
  for (const [name, module] of Object.entries(outputPaths)) {
    const path = await checkedModulePath(nodeModules, module);
    invariant(
      (await readFile(path)).equals(expectedOutputs[name]),
      `overlay bytes differ from the fingerprinted source transform: ${module}`,
    );
  }
}

async function verifyCachedOverlay(target, { fingerprint, sourceHashes, outputPaths, expectedOutputs, outputHashes }) {
  const directory = await lstatIfPresent(target);
  if (!directory) return null;
  invariant(directory.isDirectory(), `overlay cache target is not a real directory: ${target}`);
  await verifyOverlayBytes(join(target, "node_modules"), outputPaths, expectedOutputs);
  const manifest = await readJson(await checkedModulePath(target, "manifest.json"));
  invariant(
    manifest.fingerprint === fingerprint && manifest.transformVersion === transformVersion &&
      isDeepStrictEqual(manifest.sourceHashes, sourceHashes) &&
      isDeepStrictEqual(manifest.outputHashes, outputHashes),
    `overlay cache manifest differs from the verified overlay: ${target}`,
  );
  return manifest;
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
  const modulePaths = {
    browser: browserRelative,
    sky: skyRelative,
    cuaDocs: cuaDocsRelative,
  };
  const browserPath = await checkedModulePath(sourceNodeModules, browserRelative);
  // Reject linked siblings before hashing even the entry, since the entry pin
  // selects which sibling participates in this build.
  for (const name of new Set(Object.values(verifiedSplitBrowserEntries))) {
    await checkedModulePath(sourceNodeModules, join(dirname(browserRelative), name), { allowMissingFile: true });
  }
  const browserEntry = await readFile(browserPath);
  const browserCore = getBrowserCoreRelative(browserEntry);
  if (browserCore) modulePaths.browserCore = browserCore;

  const sourceBytes = { browser: browserEntry };
  for (const [name, module] of Object.entries(modulePaths)) {
    if (name !== "browser") {
      sourceBytes[name] = await readFile(await checkedModulePath(sourceNodeModules, module));
    }
  }
  const policy = await readFile(policyPath);
  const sourceHashes = {
    browser: sha256(browserEntry),
    sky: sha256(sourceBytes.sky),
    cuaDocs: sha256(sourceBytes.cuaDocs),
    policy: sha256(policy),
    builder: await hashFile(sourceFile),
    ...(browserCore ? { browserCore: sha256(sourceBytes.browserCore) } : {}),
  };
  const outputPaths = { ...modulePaths, confirmationPolicy: confirmationRelative };
  const expectedOutputs = {
    browser: browserCore ? browserEntry : Buffer.from(transformBrowser(browserEntry.toString("utf8"))),
    ...(browserCore ? { browserCore: Buffer.from(transformBrowser(sourceBytes.browserCore.toString("utf8"))) } : {}),
    sky: Buffer.from(transformSky(sourceBytes.sky.toString("utf8"))),
    cuaDocs: Buffer.from(transformCuaDocumentation(sourceBytes.cuaDocs.toString("utf8"))),
    confirmationPolicy: policy,
  };
  const outputHashes = Object.fromEntries(
    Object.entries(expectedOutputs).map(([name, bytes]) => [name, sha256(bytes)]),
  );
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
  const expectation = { fingerprint, sourceHashes, outputPaths, expectedOutputs, outputHashes };
  const cached = await verifyCachedOverlay(target, expectation);
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
    const stagingPaths = {};
    for (const [name, module] of Object.entries(outputPaths)) {
      stagingPaths[name] = await checkedModulePath(outputNodeModules, module, {
        allowMissingFile: name === "confirmationPolicy",
      });
    }
    for (const [name, bytes] of Object.entries(sourceBytes)) {
      invariant(
        (await readFile(stagingPaths[name])).equals(bytes),
        `copied module differs from the fingerprinted source: ${modulePaths[name]}`,
      );
    }
    for (const [name, bytes] of Object.entries(expectedOutputs)) {
      if (name !== "browser" || !browserCore) await writeFile(stagingPaths[name], bytes);
    }
    await syntaxCheck(appNode, Object.keys(modulePaths).map((name) => stagingPaths[name]));
    await verifyOverlayBytes(outputNodeModules, outputPaths, expectedOutputs);
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
      const winner = await verifyCachedOverlay(target, expectation);
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
