---
name: update-autonomous-cua
description: Update or repair the Autonomous Computer Use shim after Codex desktop, CLI, or plugin updates. Use when the user asks to update our shim or refresh the autonomous CUA adapter.
---

Run the installed updater:

```sh
"${AUTONOMOUS_CUA_INSTALL_ROOT:-$HOME/.local/share/codex-autonomous-cua}/bin/update-autonomous-cua"
```

It fetches the latest shim from its GitHub repository, builds it for the installed desktop runtime, runs a quick runtime test, and activates the local plugin. It keeps the previous installation and restores it if activation fails. Use `--rebuild` only when the user asks to reapply the installed version without downloading a new shim. A custom installation uses `AUTONOMOUS_CUA_INSTALL_ROOT`; otherwise the command above works from any directory.

If a changed runtime seam is unsupported, report the specific error. Leave the existing installation in place; do not weaken compatibility checks or policy enforcement to force an update through. Report the shim and desktop versions and whether a new chat or app restart is needed. App/CLI upgrades and process cleanup are separate operations and need their own task scope.
