# Changelog

Each version records its user-visible changes and material verification limits. GitHub release notes use the corresponding entry. Earlier entries were reconstructed from the published releases and version commits.

## 1.2.6 — Unreleased

- Extend installation verification to inspect the registered catalog and exercise dispatch in direct and code-mode-only configurations through the installed Codex runtime. Report live delegated Work availability separately from the local configuration probe.
- Verify current-turn and permission metadata, and require `turn_ended` to remain hidden from model invocation and reserved for lifecycle hooks.
- Label the installer smoke test as inventory-only, with fixture metadata and browser access explicitly unverified.
- Add this version history and link it from the README.
- Prepare a local compatibility candidate that permits code-mode exposure while retaining the deferred exclusion. Record later fresh delegated native-app and browser passes on the same installed candidate, while retaining the earlier failed tests as an unresolved regression case.

Fresh delegated native-app and browser tests now pass on installed v1.2.6 / `75b239b`, both through `functions.exec` → `tools.mcp__autonomous_cua_repl__js`, without a reported restart or change to installation, configuration, permissions, or trust. The native-app pass is user-reported from a separate task. The browser report and screenshot were reviewed: the task created, observed, and closed only a new blank tab, confirmed its removal, and read an existing tab without changing controls. No further exposure changes or app restart are indicated solely to restore current access.

Earlier fresh Work tasks with both the original exclusions and candidate `75b239b` lacked the callable executor and failed before dispatch. Those failures remain an unresolved regression case. Stale 1.2.3 skill-path resolution was also reported, but raw Work-host registration and filtering decisions remain unavailable. Neither the exposure change nor a restart is established as the cause of the later success. The signed desktop app and native policy checks remain unchanged.

Validation: the existing three focused tests passed with standalone CLI 0.164.0 and with desktop 26.1016.62342's bundled CLI 0.163.0-alpha.11.2, and the actual direct-local browser control succeeded. The later delegated live passes are recorded separately from the inventory-only smoke and local configuration probe. No runtime tests were repeated for this documentation-only evidence update. The version stays at 1.2.6; publication remains held and no release status was verified. The routing document preserves the earlier boundary comparison and the diagnostics needed to investigate its unresolved cause.

## 1.2.5 — 2026-10-24

- Replace mandatory handoff at HTTPS certificate warnings with explicit user approval for the displayed origin and error, followed by the browser's normal visible proceed control when runtime policy permits.
- Deliver the rule through session instructions, the usage skill, and runtime policy. Preserve native policy checks and require the complete current policy in the inventory smoke test.
- Local installation, policy delivery, and five trusted hooks were checked. Proceeding past a live certificate warning was not tested.

## 1.2.4 — 2026-10-23

- Fix installation with Codex CLI 0.164.0 compound hook trust values by passing opaque values to Codex's configuration API. Codex owns their format and separate content-hash storage.
- Remove the fixed hash-format check and direct hook-trust TOML writes. Keep trust scoped to this plugin's five hooks.
- Four focused tests, isolated native trust storage, local reinstall, and inventory smoke passed; all five hooks were trusted.

## 1.2.3 — 2026-10-23

- Choose tools per operation in mixed workflows: use the shim for UI and supported connectors, APIs, CLIs, and file tools for their operations.
- Allow documented lower-level capabilities for missing convenience methods while preserving actual access denials. Keep platform recipes in the usage skill.
- This was an instruction-level change. Installation and inventory smoke passed; fresh-agent behavior and a new clipboard capture were not tested.

## 1.2.2 — 2026-10-23

- Document direct macOS clipboard reads with `pbpaste` after a Copy action through the shim, avoiding editor or cloud-document intermediaries.
- Document stale/shared clipboard checks, UTF-8 capture, and format validation.
- Skill validation, installation, and inventory smoke passed. No new live clipboard-capture test was claimed.

## 1.2.1 — 2026-10-22

- Recognize “Update Codex Autonomous CUA”, “update no approvals codex”, and “update no approvals cua” through the packaged update skill.
- Publish the portable routing instructions and updater introduced in 1.1.0 and 1.2.0.
- Inventory smoke passed in four installations. Two fresh agent sessions selected and ran the updater from its natural-language aliases.

## 1.2.0 — 2026-10-22

- Inject portable routing instructions through SessionStart and SubagentStart hooks, and include a discoverable usage skill.
- Refresh trust for the two instruction hooks alongside the three lifecycle hooks during installation.

## 1.1.0 — 2026-10-22

- Add the agent-discoverable updater with source selection, offline rebuild, preflight checking, downgrade protection, and restoration after activation failure.
- Support the newer Sky consent getter while retaining native app-policy decisions and separate audio consent.

## 1.0.2 — 2026-10-12

- Initial public release of the local Autonomous CUA marketplace plugin and generated runtime overlay.
- Suppress routine Browser and per-app Sky consent within the user's task, retain native policy enforcement, and provide lifecycle cleanup and rollback.
