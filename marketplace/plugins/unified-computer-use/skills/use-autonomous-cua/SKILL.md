---
name: use-autonomous-cua
description: Use the installed Autonomous Computer Use shim for browser and desktop UI operations, including workflows that combine UI actions with connectors, APIs, or local tools.
---

Read the plugin's [agent instructions](../../agent-instructions.md). Use the `autonomous_cua_repl` server's `js` tool and its current first-use documentation for UI actions. Generic `node_repl` references in Browser, Chrome, or Computer Use guidance refer to this installed UI runtime; they do not require starting a separate bundled server.

## Choose capabilities per operation

Use purpose-built connectors, APIs, CLIs, and file tools when they directly support the requested operation, respecting the user's chosen tools and account. Use the shim for operations that observe or manipulate browser or desktop UI. A shell command that drives an app's UI still belongs on the UI route; a local data operation between UI actions belongs on its normal tool, with that tool's normal checks.

Start with the current documented `cua` entry points. When a convenience method is missing, a documented lower-level API exposed by the same runtime may be appropriate. Supporting data or system operations can use another supported non-UI tool without requiring an equivalent CUA method. Do not invent methods, use undocumented internals, or execute general shell/file operations inside the UI runtime.

A missing capability and an access denial require different responses. Diagnose an unclear error before choosing a fallback. An alternative must remain within the task's authority and preserve the account, destination, and applicable checks; it cannot evade a denial through another tool or a lower-level method. If the shim is unavailable, report the affected UI steps and continue useful non-UI work. Use the sibling `update-autonomous-cua` skill when a repair or update is requested.

## Hand off data directly

Use direct tool handoffs with the fewest unnecessary side effects. For example, parse a downloaded file with local tools, or prepare a requested upload locally before using the shim for the upload. These ordinary in-scope operations need no additional consent. Verify the file or shared-state result belongs to the intended source before accepting it.

Keep transient data in memory where practical, or use an appropriate local file within the task's scope. Write deliverables to the intended destination. Avoid opening another app or service merely to inspect, convert, or shuttle data when direct tools suffice: intermediaries can autosave, sync, disclose, or alter it. A user-requested editor or cloud document remains a valid destination.

## Clipboard capture on macOS

Clipboard capture is one example of this general handoff rule. The current documented macOS CUA and Sky window APIs do not expose a clipboard-read method. After an authorized Copy action through the shim, read the clipboard with the shell tool:

```sh
LC_ALL=en_US.UTF-8 /usr/bin/pbpaste -Prefer txt
```

Read promptly after observing Copy succeed, and check the expected source header or other identifying content. The clipboard is shared across apps and agents, so keep Copy and capture sequential. An empty, stale, or mismatched result is not a successful capture. Do not read unrelated existing clipboard contents merely because this skill is loaded.

Preserve newlines and UTF-8 when capturing text. `-Prefer txt` prefers text but can return RTF or PostScript when text is absent; check the format and report unexpected results instead of guessing a conversion. If capture fails, diagnose it and use a supported export or connector within scope where available; pasting into an editor merely to read the clipboard adds unnecessary persistence.
