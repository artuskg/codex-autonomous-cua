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
7. After installation, ask the local app-server for the materialized plugin hooks and trust only the five packaged hooks whose exact keys and current hashes it returns: three cleanup hooks and two instruction hooks.

## Validation

- The installer builds the overlay once, including seam matching and syntax checks, and performs one MCP runtime smoke test that checks the exported tools, local policy, and application/browser state shape.
- Installation refreshes the local plugin and its five current hook hashes. `verify-install.mjs` is an optional diagnostic for the enabled plugin, merged MCP registration, and hook trust.
- `node --test tests/sky-policy.test.mjs` covers both Sky consent-binding shapes and exercises the installed transformed policy with isolated app-policy/consent stubs. These tests preserve blocked-app decisions and the separate audio prompt; the MCP smoke test supplies live-runtime coverage.

## Rollback

Disable `unified-computer-use@autonomous-cua-local` and re-enable `unified-computer-use@openai-bundled`, then restart the desktop app. Generated overlays are inert when the local plugin is disabled and can be removed separately.

## Known compatibility boundary

The local marketplace and plugin-scoped MCP approval settings are supported extension points. The Browser, Sky, and CUA source transforms are reverse-engineered adapters. Desktop updates should normally rebuild automatically; a changed source seam requires updating and revalidating this adapter. Dot compatibility is maximized by preserving the plugin name, server name, tool names, and hooks, but must be rechecked after desktop updates because the exact bundled plugin identity is not a documented Dot contract.

## Agent-driven updates

The plugin bundles an `update-autonomous-cua` skill and installs `bin/update-autonomous-cua`. A user can ask “Update Codex Autonomous CUA” or invoke `$update-autonomous-cua`; the command fetches this repository’s `main` branch into a temporary checkout and runs the installer. `--rebuild` reapplies the installed code without network access, `--source` selects an explicit checkout, and `--check` performs preflight without activation. The installer builds and tests the candidate before swapping directories, preserves the previous installation, refreshes plugin installation and cleanup-hook trust, and restores the old files and configuration if activation fails. Concurrent installs and updates are serialized, and older shim versions cannot replace newer ones through the updater. No scheduled job is created.

## Portable agent routing

The enabled plugin supplies agent-instructions.md through SessionStart and SubagentStart command hooks, using PLUGIN_ROOT to locate the installed file. Codex adds their plain stdout to developer context. A discoverable use-autonomous-cua skill provides the same routing entry point on hosts that disable hooks. Installation and updates refresh the two context hooks and three existing cleanup hooks together. No user/global AGENTS.md is edited, and disabling the plugin disables its context injection.
