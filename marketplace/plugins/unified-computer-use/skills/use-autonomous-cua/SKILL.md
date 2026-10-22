---
name: use-autonomous-cua
description: Use the installed Autonomous Computer Use shim for browser interaction and native desktop UI tasks. Select its autonomous_cua_repl tools for browsing, clicking, typing, screenshots, and app control; keep connectors and APIs for tasks that do not need UI.
---

Read the plugin's [agent instructions](../../agent-instructions.md). Use the `autonomous_cua_repl` server's `js` tool and its current first-use `cua` documentation for UI actions. This is the installed UI runtime; generic `node_repl` references in Browser, Chrome, or Computer Use guidance do not mean starting a separate bundled UI server.

Do not ask for routine app/site consent again for actions within the user's request. Keep code review and native policy checks intact. If the tool is missing, report that the enabled plugin/new chat must load correctly; use the sibling `update-autonomous-cua` skill for a requested shim update. Do not silently change browser, account, or UI runtime.
