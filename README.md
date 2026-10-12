# Autonomous macOS Computer Use adapter

This adapter replaces the bundled `unified-computer-use` plugin with a local plugin that launches the current ChatGPT desktop runtime through a generated overlay. It suppresses routine Browser and per-app Sky consent prompts while retaining Browser navigation/site-status enforcement and Sky's native app-policy decisions.

It does **not** modify or re-sign `/Applications/ChatGPT.app`, replace the signed Computer Use service, enable forbidden targets, bypass CAPTCHA/authentication barriers, or disable the lock-screen guardian.

This repository does not redistribute the OpenAI runtime or generated overlays.
It contains original adapter code plus short compatibility fingerprints used to
locate required seams in a user's installed runtime. See [NOTICE.md](NOTICE.md).

See [PLAN.md](PLAN.md) for the design and compatibility boundary.

The original adapter code and documentation are available under the
[MIT License](LICENSE). Third-party components are not included in that grant;
see [NOTICE.md](NOTICE.md).

The adapter is currently validated with Codex CLI `0.162.1` and ChatGPT
desktop `26.1007.30912` (`20156`). Its exact-match transforms deliberately
fail closed if a later desktop build moves a required source seam.

## Install

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/install.mjs
```

The installer:

1. stages the adapter under `~/.local/share/codex-autonomous-cua`;
2. builds and verifies the overlay for the installed ChatGPT app;
3. registers the `autonomous-cua-local` personal marketplace;
4. installs and enables `unified-computer-use@autonomous-cua-local`;
5. disables `unified-computer-use@openai-bundled`;
6. sets `autonomous_cua_repl`'s `js`, `js_reset`, and `turn_ended` tools to `approve`; and
7. records trust for this plugin's three exact, current-hash lifecycle cleanup hooks.

Restart ChatGPT after installation so new conversations load the local plugin. The currently running conversation keeps its already-loaded tool server.

## Update behavior

The installer derives its paths from the current macOS user's home directory and materializes the MCP launch command for that account. The launcher reads `/Applications/ChatGPT.app` every time it starts. A new desktop source hash creates a new overlay under `~/.cache/codex-autonomous-cua/overlays/`. Exact-count transforms and postcondition checks fail closed when an app update moves a required seam.

Codex CLI updates do not replace the personal plugin. If this adapter itself changes, rerun the installer to refresh the installed local copy.

## Verify

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/verify-overlay.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/smoke-mcp.mjs
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/verify-install.mjs
```

## Roll back

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/rollback.mjs
```

Then restart ChatGPT. Rollback only switches plugin selection; it does not delete the generated cache or uninstall the local marketplace, so reactivation remains reversible.
