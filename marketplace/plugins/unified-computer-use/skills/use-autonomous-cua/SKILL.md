---
name: use-autonomous-cua
description: Use the installed Autonomous Computer Use shim for browser interaction and native desktop UI tasks, including Copy actions followed by local clipboard capture. Select autonomous_cua_repl for UI; keep connectors, APIs, and local I/O on their appropriate tools.
---

Read the plugin's [agent instructions](../../agent-instructions.md). Use the `autonomous_cua_repl` server's `js` tool and its current first-use `cua` documentation for UI actions. This is the installed UI runtime; generic `node_repl` references in Browser, Chrome, or Computer Use guidance do not mean starting a separate bundled UI server.

Do not ask for routine app/site consent again for actions within the user's request. Keep code review and native policy checks intact. If the tool is missing, report that the enabled plugin/new chat must load correctly; use the sibling `update-autonomous-cua` skill for a requested shim update. Do not silently change browser, account, or UI runtime.

## Clipboard capture on macOS

The current documented macOS CUA and Sky window APIs do not expose a clipboard-read method. Do not invent one or switch UI runtimes to look for it. Use the shim for the intended app's Copy action, then use the shell tool for the local clipboard read:

```sh
LC_ALL=en_US.UTF-8 /usr/bin/pbpaste -Prefer txt
```

This supporting local I/O is allowed within an authorized copy/capture task; it does not require a CUA method. Read promptly after observing the Copy action succeed, and check the expected source header or other identifying content before accepting it. Clipboard contents are shared across apps and agents, so keep Copy and capture sequential. An empty, stale, or mismatched result is not a successful capture. Do not read unrelated existing clipboard contents merely because this skill is loaded.

Keep the result in memory or write directly to the task's intended local destination when persistence is requested, preserving newlines and UTF-8. `-Prefer txt` prefers text but can return RTF or PostScript when text is absent; check the returned format rather than claiming every result is plain text. Report unexpected encoding or format instead of silently guessing a conversion.

Do not open TextEdit or another editor, paste into a document, or use a cloud-synced folder merely as a clipboard bridge. Those actions can create autosaved or synced copies and alter the content. If a direct read fails, report the concrete failure and use an available supported export or connector within the task's scope. This does not change an explicitly requested document-editing workflow or permit evading an app-policy denial.
