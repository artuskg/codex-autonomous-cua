# Autonomous macOS Computer Use plan

## Goal

Run the ChatGPT/Codex desktop app's Browser and macOS Computer Use surfaces without routine per-origin or per-app consent prompts on a dedicated macOS host, while retaining the native URL/site-status checks, organization policy decisions, forbidden-target decisions, authentication barriers, CAPTCHA barriers, TCC/accessibility enforcement, and lock-screen/input protections.

The activation boundary is plugin selection. There is deliberately no VM marker, app allowlist, sentinel file, machine attestation, or per-run flag.

## Baseline

- Codex CLI: `0.163.0`
- ChatGPT desktop: `26.1016.61520` (`21421`)
- `@oai/browser-desktop`: `0.1.1`
- `@oai/sky`: `0.7.12`
- `@oai/cua`: `0.2.6`

## Design

1. Package a personal plugin named `unified-computer-use` with a dedicated `autonomous_cua_repl` server, the same tools, and equivalent lifecycle hooks as the bundled plugin. The distinct server name avoids collisions with the desktop-managed global `cua_repl` entry introduced in newer builds.
2. Launch the current desktop app's `@oai/cua-repl`; do not vendor an old runtime or edit/re-sign `ChatGPT.app`.
3. On first launch after a source change, build a hash-keyed overlay under the user cache:
   - Browser: add an `autonomous-vm` security mode whose consent-free operations match the local-testing mode while its bypassed-security-check set remains empty.
   - Sky: retain `getAppPolicy()` and its `allowed`/`denied`/`forbidden` outcomes, but synthesize consent only after an `allowed` decision. Keep the separate computer-audio prompt.
   - CUA docs: replace the UI confirmation taxonomy with a narrow autonomous-run policy and make that local policy win over request metadata while this plugin is active.
4. Resolve trusted Browser and Sky services by absolute overlay paths. Put the overlay before the desktop app's packages in the trusted module search path.
5. Fail closed unless every source transform matches exactly once and all postconditions pass. Publish generated overlays atomically; never patch the signed app or its bundled plugin cache.
6. Install through a personal local marketplace, disable only `unified-computer-use@openai-bundled`, enable the local equivalent, and set the three `autonomous_cua_repl` MCP tools to `approve`.
7. After installation, ask the local app-server for the materialized plugin hooks and trust only the five packaged hooks whose exact keys and current hashes it returns: three cleanup hooks and two instruction hooks. Pass these opaque trust values to Codex's configuration API, which handles their storage format.

## Validation

- The installer builds the overlay once, including seam matching and syntax checks, and performs one inventory-only MCP smoke test that checks the exported tools, the complete current local policy in first-use documentation, and application/browser state shape. Its fixture metadata does not establish browser access or delegated availability.
- Installation refreshes the local plugin and its five current hook hashes. `verify-install.mjs` checks the enabled plugin, merged MCP registration, raw tool catalog, and hook trust, then exercises dispatch in direct and code-mode-only configurations through two isolated local Codex runs. A deterministic loopback responder drives the actual Core catalog and MCP handlers without calling a model service. The verifier checks Core-generated turn and permission metadata; it never fabricates or replays that context.
- Local configuration probes are distinct from live delegated Work verification. The automated report leaves the latter unverified because only its host owns the actual capability roots and final tool catalog; separately supplied live evidence is recorded in the routing investigation. `turn_ended` must remain hidden on all model-callable surfaces.
- `node --test tests/hook-trust.test.mjs` covers passing legacy and compound trust values unchanged to Codex, and rejection of missing values or hooks from another plugin. Set `AUTONOMOUS_CUA_TEST_CODEX` to a Codex 0.164.0 or later executable to also test native compound-hash storage in an isolated temporary config.
- `node --test tests/sky-policy.test.mjs` covers both Sky consent-binding shapes and exercises the installed transformed policy with isolated app-policy/consent stubs. These tests preserve blocked-app decisions and the separate audio prompt; the MCP smoke test supplies runtime inventory coverage only.
- `node --test tests/tool-routing.test.mjs` checks routing-report boundaries. Set `AUTONOMOUS_CUA_TEST_CODEX` to an installed Codex executable to include actual catalog and dispatch checks through the source launcher.

## Rollback

Disable `unified-computer-use@autonomous-cua-local` and re-enable `unified-computer-use@openai-bundled`, then restart the desktop app. Generated overlays are inert when the local plugin is disabled and can be removed separately.

## Known compatibility boundary

The local marketplace and plugin-scoped MCP approval settings are supported extension points. The Browser, Sky, and CUA source transforms are reverse-engineered adapters. Desktop updates should normally rebuild automatically; a changed source seam requires updating and revalidating this adapter. Dot compatibility is maximized by preserving the plugin name, server name, tool names, and hooks, but must be rechecked after desktop updates because the exact bundled plugin identity is not a documented Dot contract.

The unreleased 1.2.6 candidate removes the code-mode exclusion while preserving the deferred exclusion. Local context/lifecycle checks and an actual direct-local browser control passed. Later fresh delegated native-app and browser tests also passed on installed candidate `75b239b`, with no reported app restart or installation, configuration, permission, or trust change. The native-app pass is user-reported; the browser report and screenshot were reviewed. Earlier fresh Work tasks on the same candidate failed before dispatch and remain an unresolved regression case, with no causal repair established. Exposure flags, version, and installation remain unchanged, and publication is held. The shim does not alter the desktop's durable-task configuration transformer. The [live evidence and earlier boundary comparison](docs/tool-routing.md) preserve the missing accepted-root and raw-catalog observations needed for root-cause investigation; no further exposure change or restart is indicated solely to restore current access.

## Agent-driven updates

The plugin bundles an `update-autonomous-cua` skill and installs `bin/update-autonomous-cua`. A user can ask “Update Codex Autonomous CUA” or invoke `$update-autonomous-cua`; the command fetches this repository’s `main` branch into a temporary checkout and runs the installer. `--rebuild` reapplies the installed code without network access, `--source` selects an explicit checkout, and `--check` performs preflight without activation. The installer builds and tests the candidate before swapping directories, preserves the previous installation, refreshes plugin installation and cleanup-hook trust, and restores the old files and configuration if activation fails. Concurrent installs and updates are serialized, and older shim versions cannot replace newer ones through the updater. No scheduled job is created.

## Portable agent routing

The enabled plugin supplies agent-instructions.md through SessionStart and SubagentStart command hooks, using PLUGIN_ROOT to locate the installed file. Codex adds their plain stdout to developer context. A discoverable use-autonomous-cua skill provides the same routing entry point on hosts that disable hooks. Installation and updates refresh the two context hooks and three existing cleanup hooks together. No user/global AGENTS.md is edited, and disabling the plugin disables its context injection.

Routing is defined per operation: browser and desktop UI run through the shim, while connectors, APIs, CLIs, and local tools handle supported non-UI work under their own checks. Missing convenience methods can use documented lower-level capabilities in the same runtime or appropriate non-UI tools; actual policy or access denials cannot be routed around. Direct handoffs avoid unnecessary persistence or disclosure and verify the source of shared-state results. The injected instructions carry these general rules, and the usage skill carries platform recipes such as macOS clipboard capture. This instruction change leaves runtime enforcement intact.

HTTPS certificate warnings use explicit user approval for the observed origin and certificate error instead of mandatory manual handoff. The session instructions, usage skill, and runtime policy all carry this narrow exception to the bundled Computer Use handoff wording. After approval, the agent can use a normal visible browser proceed control if runtime policy permits. General task consent does not approve the exception; native denials, missing proceed controls, and other safety barriers remain binding. Browser and Sky enforcement transforms are unchanged.
