# Changelog

Each version records its user-visible changes and material verification limits. GitHub release notes use the corresponding entry. Earlier entries were reconstructed from the published releases and version commits.

## 1.2.11 — 2026-11-21

- Fix the overlay build with ChatGPT desktop `26.1117.41037` (build `29803`). The builder requires an exact SHA-256 match for the split Browser entry before applying the existing security-mode transform to its sibling core. It rejects linked Browser files and directories in the source, staging and cached overlays.
- Pin the 29803 CUA documentation source and output around one exact insertion. Autonomous runs receive the local confirmation policy outside `orbit`. Other runs retain the desktop's request, product, and CAPTCHA policy behavior.
- Warm overlay lookups on both split and monolithic layouts recompute the expected Browser, Sky, CUA documentation and confirmation-policy bytes from the source inputs. The builder and verifier refuse mismatches, including when a cached file's manifest hash has also been edited.
- Cold builds and warm verification passed on builds `29803` and `29030`. The 29030 payload matches 1.2.10 byte-for-byte. The 29803 Browser entry and core, Sky policy, and CUA documentation passed offline syntax and import checks with bundled Node. Live relaunch and tool dispatch remain unverified.

## 1.2.10 — 2026-11-20

- Fix the overlay build with ChatGPT desktop `26.1111.71704` (build `29030`). Its re-minified CUA documentation module renames the locals around the request-metadata confirmation-policy seam, so 1.2.9 stopped with "confirmation-policy seam is not unique" and the `autonomous_cua_repl` server did not start.
- Support build `29030` only for its verified module bytes (SHA-256 `f53c7f1b…`): the overlay makes one exact insertion and checks the result against a pinned output hash. Every other source keeps the exact 1.2.9 match and is refused unless that seam occurs exactly once, so a renamed or restructured module stops the build instead of being patched by shape. Older generated overlays are invalidated.
- In build `29030`, an `aeon` product SKU in object-form turn metadata makes the module drop all confirmation text. Autonomous runs now receive the local policy in that case too. Runs without `AUTONOMOUS_CUA=1` behave exactly as the unmodified module, and `orbit` still yields no confirmation text, as in earlier builds. Codex `0.171.0` forwards `product_sku` only to `node_repl` and `cua_repl`, so this path is not reached through `autonomous_cua_repl` today.
- For every cached overlay from builds `20156` to `27194` (18 overlays, three distinct source files, originals hash-checked against their manifests), the new transform's output is byte-identical to 1.2.9's. On build `29030`, eight focused tests and a full overlay build with syntax and compatibility checks passed. The tests compare the installed module with and without the insertion across environment, request-policy and product-SKU cases. The installer's inventory smoke test, tool-routing checks and live browser or app access were not run for this build before release.

## 1.2.9 — 2026-11-14

- Fix installation when an SDK warning and the inventory JSON arrive in the same MCP text block, as observed on Galahad. The smoke test now identifies its own result with a unique marker and parses that line independently of diagnostic output.
- Continue requiring exactly one successful app/browser inventory result, the complete current policy, and all overlay compatibility checks. Unmarked JSON, duplicate results, malformed data, and unsuccessful inventory are rejected.
- Four focused parser regression tests passed. The fixed installer also passed its preactivation check on Galahad with ChatGPT desktop `26.1106.51428` (build `26605`). These checks cover inventory and policy delivery; they do not establish live browser access. The CAPTCHA instructions and runtime enforcement are unchanged from 1.2.8.

## 1.2.8 — 2026-11-14

- Preauthorize completing CAPTCHA challenges through their normal visible controls during an otherwise authorized task, without a confirmation or user handoff solely because a CAPTCHA is present. External CAPTCHA-solving services still require separate authorization.
- Deliver the guidance in the runtime policy, session instructions, and usage skill. Native Browser/Sky enforcement and account, task, and audio-consent boundaries remain in place.
- Verified the changed runtime policy in a fresh delegated session on Tintagel with ChatGPT desktop `26.1106.51428` (build `26605`): an existing Chrome profile completed the visible STRATO CAPTCHA and reached the authenticated account page without an app restart. No actual native-policy denial was overridden; the policy's instruction to ignore contrary CAPTCHA prohibitions was not exercised as an enforcement override.
- Release installation checks verify overlay compatibility and complete policy delivery using inventory-only fixture metadata. They do not establish live browser access on other machines or support for every CAPTCHA variant.

## 1.2.7 — 2026-11-04

- Support Sky 0.7.17's guarded consent getter through its exact `nodeRepl` accessor, while refusing unrelated or ambiguous accessor chains.
- Preserve native app-policy decisions and the separate audio prompt. Focused tests exercise these boundaries against the installed runtime.
- Invalidate older generated overlays so the compatibility change is rebuilt.
- Verify registration, hook trust, and direct/code-mode local dispatch with standalone CLI `0.166.0` and bundled CLI `0.166.0-alpha.6` on desktop `26.1029.61003` (build `24614`). Live in-app browser navigation and native Calculator state access passed in a direct chat without restarting the app. Live delegated Work availability remains separately unverified for this version.

## 1.2.6 — 2026-10-24

- Add another supported invocation path for browser and desktop actions, broadening compatibility with delegated Work tasks.
- Improve installation diagnostics and clarify their scope, so local tool availability and live access in delegated tasks are reported separately.
- Add a versioned changelog to make changes between releases easier to follow.

Earlier reports of unavailable tools in Work tasks remain under investigation.

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
