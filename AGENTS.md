# codex-autonomous-cua

This repository packages the Autonomous Computer Use shim. Use the installed `autonomous_cua_repl` tools for browser and native desktop UI work. Keep ordinary code, file, shell, and API tasks on their appropriate tools.

End-user routing instructions live in `marketplace/plugins/unified-computer-use/agent-instructions.md`. The plugin delivers them through trusted SessionStart and SubagentStart hooks, so they work in other projects and on other users' machines. Keep the usage/update skills and installer consistent with that distribution; a repository AGENTS.md alone does not configure end-user agents.

Use the current desktop runtime without modifying the signed app or distributing upstream packages. Preserve native policy enforcement and the user's actual task scope. For a scoped change, use the relevant existing check; do not rerun unrelated UI tests. See README.md for installation and update commands and PLAN.md for the compatibility boundary.
