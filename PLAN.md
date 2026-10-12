# Autonomous macOS Computer Use plan

## Goal

Run the ChatGPT/Codex desktop app's Browser and macOS Computer Use surfaces without routine per-origin or per-app consent prompts on a dedicated macOS host, while retaining the native URL/site-status checks, organization policy decisions, forbidden-target decisions, authentication barriers, CAPTCHA barriers, TCC/accessibility enforcement, and lock-screen/input protections.

The activation boundary is plugin selection. There is deliberately no VM marker, app allowlist, sentinel file, machine attestation, or per-run flag.

## Baseline

- Codex CLI: `0.162.1`
- ChatGPT desktop: `26.1007.30912` (`20156`)
- `@oai/browser-desktop`: `0.1.1`
- `@oai/sky`: `0.7.6`
- `@oai/cua`: `0.2.6`

## Design

1. Package a personal plugin named `unified-computer-use` with a dedicated
   `autonomous_cua_repl` server, the same tools, and equivalent lifecycle hooks
   as the bundled plugin. The distinct server name avoids collisions with the
   desktop-managed global `cua_repl` entry introduced in newer builds.
2. Launch the current desktop app's `@oai/cua-repl`; do not vendor an old runtime or edit/re-sign `ChatGPT.app`.
3. On first launch after a source change, build a hash-keyed overlay under the user cache:
   - Browser: add an `autonomous-vm` security mode whose consent-free operations match the local-testing mode while its bypassed-security-check set remains empty.
   - Sky: retain `getAppPolicy()` and its `allowed`/`denied`/`forbidden` outcomes, but synthesize consent only after an `allowed` decision. Keep the separate computer-audio prompt.
   - CUA docs: replace the UI confirmation taxonomy with a narrow autonomous-run policy and make that local policy win over request metadata while this plugin is active.
4. Resolve trusted Browser and Sky services by absolute overlay paths. Put the overlay before the desktop app's packages in the trusted module search path.
5. Fail closed unless every source transform matches exactly once and all postconditions pass. Publish generated overlays atomically; never patch the signed app or its bundled plugin cache.
6. Install through a personal local marketplace, disable only `unified-computer-use@openai-bundled`, enable the local equivalent, and set the three `autonomous_cua_repl` MCP tools to `approve`.
7. After installation, ask the local app-server for the materialized plugin hooks and trust only the three lifecycle hooks whose exact keys and current hashes it returns.

## Validation

- Run source-transform unit checks and JavaScript syntax checks.
- Verify the generated manifest binds the exact desktop version, build, package versions, and source hashes.
- Verify Browser `autonomous-vm` uses the default empty security-bypass set and the consent-operation set, with navigation and site-status code still present.
- Verify Sky still calls `getAppPolicy`, preserves `denied` and `forbidden`, and leaves exactly one `createElicitation` for audio.
- Verify the CUA policy override is active only when the local launcher's environment is present.
- Start the MCP server and complete its initialize/list-tools handshake without operating a browser or desktop app.
- Verify the materialized local plugin hooks report `trusted`, not `untrusted` or `modified`.
- Confirm Codex reports the local plugin installed and enabled, its source MCP
  manifest binds `autonomous_cua_repl` to the local launcher, and its materialized
  hooks remain trusted. Do not use an unscoped `codex mcp get cua_repl` for this check:
  newer desktop builds can install a separate disabled global entry with the
  same server name.

## Rollback

Disable `unified-computer-use@autonomous-cua-local` and re-enable `unified-computer-use@openai-bundled`, then restart the desktop app. Generated overlays are inert when the local plugin is disabled and can be removed separately.

## Known compatibility boundary

The local marketplace and plugin-scoped MCP approval settings are supported extension points. The Browser, Sky, and CUA source transforms are reverse-engineered adapters. Desktop updates should normally rebuild automatically; a changed source seam requires updating and revalidating this adapter. Dot compatibility is maximized by preserving the plugin name, server name, tool names, and hooks, but must be rechecked after desktop updates because the exact bundled plugin identity is not a documented Dot contract.
