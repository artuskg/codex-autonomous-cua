# codex-autonomous-cua

This repository packages the Autonomous Computer Use shim. Use the installed `autonomous_cua_repl` tools for browser and native desktop UI work. Keep ordinary code, file, shell, and API tasks on their appropriate tools.

End-user routing instructions live in `marketplace/plugins/unified-computer-use/agent-instructions.md`. The plugin delivers them through trusted SessionStart and SubagentStart hooks, so they work in other projects and on other users' machines. Keep the usage/update skills and installer consistent with that distribution; a repository AGENTS.md alone does not configure end-user agents.

Use the current desktop runtime without modifying the signed app or distributing upstream packages. Preserve native policy enforcement and the user's actual task scope. For a scoped change, use the relevant existing check; do not rerun unrelated UI tests. See README.md for installation and update commands and PLAN.md for the compatibility boundary.

## Publishing versions

Publishing a new version includes the code push, a matching `vX.Y.Z` Git tag, and a published GitHub release with a meaningful title and description. Keep the plugin manifest version, dated CHANGELOG.md entry, tag, and release version consistent. Create the tag at the exact verified release commit, and use that version's changelog entry for the release description, including relevant validation and known limits. Do not move an existing release tag.

Before reporting publication complete, verify that the remote tag resolves to the intended commit and that the GitHub release is published with its description. Mark a normal stable release as Latest; preserve an explicitly requested prerelease or draft status. Pushing the branch alone does not complete a version publication.
