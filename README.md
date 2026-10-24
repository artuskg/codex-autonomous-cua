# Codex Autonomous CUA

This adapter replaces the bundled `unified-computer-use` plugin with a local plugin that launches the current ChatGPT desktop runtime through a generated overlay. It suppresses routine Browser and per-app Sky consent prompts while retaining Browser navigation/site-status enforcement and Sky's native app-policy decisions.

It does **not** modify or re-sign `/Applications/ChatGPT.app`, replace the signed Computer Use service, enable forbidden targets, bypass CAPTCHA/authentication barriers, or disable the lock-screen guardian.

This repository contains original adapter code and short compatibility fingerprints. It does not redistribute the OpenAI runtime or generated overlays. See [NOTICE.md](NOTICE.md) for provenance, [LICENSE](LICENSE) for the MIT license on original code, and [PLAN.md](PLAN.md) for the design.

See the [changelog](CHANGELOG.md) for changes and verification limits in every version, or browse the [GitHub releases](https://github.com/artuskg/codex-autonomous-cua/releases).

Validated on October 22, 2026 with standalone Codex CLI `0.163.0`, ChatGPT desktop `26.1016.61520` (build `21421`), and its bundled Browser/Chrome/unified Computer Use plugins `26.1016.61520`. The runtime packages are `@oai/browser-desktop 0.1.1`, `@oai/sky 0.7.12`, `@oai/cua 0.2.6`, and `@oai/cua-repl 0.1.2`. Both the earlier named-capability consent binding and the newer Sky consent getter are supported.

## Install

Clone this repository, then run:

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/install.mjs
```

The installer builds the overlay and runs one quick inventory test before activation. That test checks tool discovery, policy documentation, and app/browser inventory shape using fixture metadata; it does not establish live browser access or delegated-task availability. It stages the shim under `~/.local/share/codex-autonomous-cua`, registers the `autonomous-cua-local` personal marketplace, enables its `unified-computer-use` plugin, disables only `unified-computer-use@openai-bundled`, and configures the three `autonomous_cua_repl` tools, their exact lifecycle cleanup hooks, and two agent-instruction hooks. The previous shim is kept at `~/.local/share/codex-autonomous-cua.previous`; an activation failure restores it and the prior configuration.

Start a new chat after installation; restart the desktop app when it has also been upgraded. An existing conversation keeps its loaded tool server until it is reloaded.

## Agents discover the shim automatically

The installed plugin injects its short `agent-instructions.md` through **SessionStart** and **SubagentStart** hooks. New chats, resumed/forked sessions, post-compaction continuations, and subagents are told to use `autonomous_cua_repl` for browser and native app UI. The bundled `use-autonomous-cua` skill also appears in skill discovery. These files travel with every installation/update and contain no machine-specific paths; users do not need to copy instructions into their projects or global AGENTS.md.

The installer records trust for the two context hooks alongside the three cleanup hooks through Codex's configuration API. It passes trust values back unchanged so Codex handles their storage, including the separate content hash introduced in CLI 0.164.0. The context hooks only print the packaged instruction file; they do not modify projects or user instructions. Disabling or rolling back the plugin stops its instruction injection. A host that disables plugin hooks will still discover the usage skill, but cannot receive the hook's automatic context.

This removes repeat questions about routine app/site access already covered by the user's task. Separate code review, native policy denials, account boundaries, and audio consent still apply. Read the [packaged instructions](marketplace/plugins/unified-computer-use/agent-instructions.md) for the exact routing rule. The repository's AGENTS.md is for maintainers; it is not the distribution mechanism.

### Routing mixed workflows

Agents choose tools for each operation. Connectors, APIs, CLIs, and file tools handle the operations they support directly; the shim handles browser and desktop UI. A single workflow can use both, such as downloading through the browser and then processing the file locally. Each tool retains its normal checks, and the user's specified browser, account, and destination still apply.

An absent convenience method can be handled by another documented capability in the same UI runtime or a supported non-UI tool. An actual policy or access denial cannot be bypassed through another route. Direct handoffs avoid unnecessary intermediary apps, autosaved documents, and synced copies; shared-state results must match the intended source.

Version 1.2.3 puts these general rules in the injected instructions. Platform recipes live in the [usage skill](marketplace/plugins/unified-computer-use/skills/use-autonomous-cua/SKILL.md), including macOS clipboard capture through the shell after an authorized UI Copy. The routing change does not add runtime APIs or change policy enforcement.

### Certificate warnings

Version 1.2.5 replaces mandatory user handoff for HTTPS certificate warnings, including `NET::ERR_CERT_AUTHORITY_INVALID`, with explicit approval for the displayed origin and error. The agent explains the risk, waits for approval, then uses the browser's normal visible proceed control through the shim. Approval already given for that same warning in the current task is sufficient. General task consent and automatic code review do not approve a certificate exception.

The rule is delivered in the session instructions, usage skill, and runtime policy so the bundled Computer Use skill's handoff wording does not override it. Native policy denials remain binding; a missing proceed control remains a blocker. The shim does not disable TLS validation, change certificate trust stores, add hidden bypasses, or extend this exception to other safety barriers.

## Update

Tell the agent **“Update Codex Autonomous CUA.”** Natural alternatives such as **“update no approvals codex”** and **“update no approvals cua”** select the same updater. You can also invoke `$update-autonomous-cua` directly. The shorter “update our shim” works when the conversation already identifies this plugin. The installed update skill runs:

```sh
"$HOME/.local/share/codex-autonomous-cua/bin/update-autonomous-cua"
```

The command fetches the latest shim from this repository's `main` branch into a temporary checkout, rebuilds against the installed desktop app, checks runtime inventory once, and refreshes the local plugin, agent instructions, and hook trust. It never pulls into or overwrites a working Git checkout. It refuses a downgrade and leaves the existing installation in place when a changed runtime seam cannot be adapted.

For an offline rebuild of the installed shim:

```sh
"$HOME/.local/share/codex-autonomous-cua/bin/update-autonomous-cua" --rebuild
```

Use `--check` to build and test without activation, or `--source /absolute/path/to/checkout` to install a local development version. Set `AUTONOMOUS_CUA_INSTALL_ROOT`, `AUTONOMOUS_CUA_APP_ROOT`, or `AUTONOMOUS_CUA_CODEX_PATH` for a custom installation. `CODEX_HOME` and `AUTONOMOUS_CUA_CONFIG_PATH` are respected.

The launcher also detects desktop runtime changes on each start and automatically creates a new hash-keyed overlay when the source seams remain compatible. A CLI update does not replace the personal plugin. If an incompatible desktop update moves a seam, use the update command to fetch the adapter fix. App/CLI upgrades remain separate from a shim update; this command does not restart apps, kill servers, or create a background job.

## Verify or roll back

The update command already builds and checks runtime inventory. For an installation and routing diagnostic:

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/verify-install.mjs
```

The diagnostic checks the enabled plugin, merged MCP configuration, registered tool catalog, and five trusted hooks. It then runs two isolated local Codex configurations: direct tools and code-mode-only tools with the hotline-only namespace override used by durable Work tasks. A deterministic loopback responder invokes the real registered MCP tool; no model service is called. It checks the returned marker, host-generated session/turn binding, permission metadata, and hidden lifecycle tool. It does not open a browser or create a persistent task.

The unreleased 1.2.6 candidate permits code-mode exposure and retains the deferred-catalog exclusion. Fresh delegated native-app and browser tests now pass on installed candidate `75b239b` through `functions.exec` → `tools.mcp__autonomous_cua_repl__js`: the native-app pass is user-reported, and the browser report and screenshot were reviewed. Neither test reported an app restart or installation, configuration, permission, or trust change. `turn_ended` stays hidden and available to lifecycle hooks.

Earlier tasks on the same candidate lacked the callable executor. Those failures remain an unresolved regression case; the later passes do not prove that the exposure change or a restart caused recovery. No further exposure change or app restart is indicated solely to restore current access. No desktop app code or browser security check is changed, and publication remains held.

The automated report separates `directLocal` from `delegated`. The latter includes a local configuration probe but remains `not_verified` for a live Work task: this CLI cannot observe that host's capability registration or final catalog. This verifier status is distinct from the separately recorded live passes and earlier failures. A successful install or local probe alone must not be reported as working delegated browser access. See [the routing investigation](docs/tool-routing.md) for the current evidence, earlier boundary comparison, and unresolved cause.

To return to bundled Computer Use:

```sh
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node scripts/rollback.mjs
```

Then restart the app. Rollback switches plugin selection and retains generated caches and the local marketplace.
