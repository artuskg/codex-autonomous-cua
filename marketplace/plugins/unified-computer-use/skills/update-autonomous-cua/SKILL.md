---
name: update-autonomous-cua
description: Update or repair Codex Autonomous CUA (codex-autonomous-cua) after desktop, CLI, or plugin updates. Recognize requests such as “Update Codex Autonomous CUA”, “update no approvals codex”, and “update no approvals cua”, including natural variations. Generic phrases such as “update our shim” apply only when the conversation clearly identifies this plugin.
---

For a request to update Codex Autonomous CUA, run the installed updater:

```sh
"${AUTONOMOUS_CUA_INSTALL_ROOT:-$HOME/.local/share/codex-autonomous-cua}/bin/update-autonomous-cua"
```

It fetches the latest shim from its GitHub repository, builds it for the installed desktop runtime, runs a quick inventory check, and activates the local plugin. It keeps the previous installation and restores it if activation fails. Use `--rebuild` only when the user asks to reapply the installed version without downloading a new shim. A custom installation uses `AUTONOMOUS_CUA_INSTALL_ROOT`; otherwise the command above works from any directory.

The inventory check uses fixture metadata; report it as inventory-only, not proof of live browser access. `scripts/verify-install.mjs` additionally checks registration and local Core dispatch, and reports live delegated Work availability separately. A local configuration probe does not verify the host's actual delegated tool catalog or browser access.

If a changed runtime seam is unsupported, report the specific error. Leave the existing installation in place; do not weaken compatibility checks or policy enforcement to force an update through. Report the shim and desktop versions and whether a new chat or app restart is needed. App/CLI upgrades and process cleanup are separate operations and need their own task scope.
