# Registered CUA tool routing

## Current live verification

On October 24, two fresh delegated Work tasks passed on installed version 1.2.6, revision `75b239bb9007191d8654e905677293c26d285a73`, using `functions.exec` → `tools.mcp__autonomous_cua_repl__js`. The installed receipt still identifies that revision. No app restart or installation, configuration, permission, or trust change was reported for either successful test.

| Live case | Result | Evidence reviewed |
| --- | --- | --- |
| Native app | A fresh delegated task operated a native app and retrieved its response. | User-reported pass from a separate task; not rerun or independently inspected here. |
| Browser | A separate fresh delegated task opened `about:blank` in the intended Chrome profile, read its accessibility tree, captured a screenshot, closed only the new tab, and confirmed its removal. It also read an existing tab without changing controls. | Saved verification report reviewed and blank-page screenshot inspected; no additional browser run performed. |

The browser report records host-registered dispatch without agent-supplied session metadata or a shell-launched adapter, with `turn_ended` absent from the callable catalog. The screenshot supports the blank-page observation; the report supplies evidence for the route, accessibility read, cleanup, and inspection without changing controls.

These passes verify current delegated functionality in the tested tasks. They do not establish the cause of the earlier missing executor, prove that the exposure change repaired it, or support a restart-based explanation. The user also reported stale 1.2.3 skill-path resolution in earlier testing; its causal role is unproven. Raw Work-host registration and filtering decisions remain unavailable. No further exposure change or app restart is indicated solely to restore current access. Version 1.2.6 remains unreleased in this repository; publication has not been performed or verified as part of this evidence update.

## Earlier unresolved regression

The desktop configuration transformer in build 21477 replaces `features.code_mode.direct_only_tool_namespaces` with a hotline-only list for Aeon durable tasks. That overwrite alone does not prove that CUA disappears: the standalone 0.164.0 and bundled 0.163.0-alpha.11.2 Core runtimes both preserve native CUA tools when the previous descriptor excludes code mode and deferred discovery. This was checked against their final model request catalogs using a deterministic local responder.

The reported live Work child had no UI executor. Its raw registered catalog, selected capability roots, and effective configuration were not exposed by the available diagnostics. Local registration and an isolated configuration probe are therefore insufficient to identify the failing stage in that child.

A fresh delegated Work retest on October 24 with the original exclusions again had no callable UI executor. The code-mode lookup failed with `tools.mcp__autonomous_cua_repl__js is not a function`, before MCP dispatch; no browser operation ran. A separate attempt to inspect runtime hooks failed because the task's read-only configuration directory prevented SQLite initialization. That filesystem failure provides no evidence about browser policy.

The installed desktop's capability-root selection code admits enabled local marketplace plugins, and the local plugin listing includes this enabled plugin. This establishes local eligibility only. Existing desktop logs show local CUA startup, but do not expose the Work host's accepted roots or raw catalog.

An earlier fresh delegated Work retest of candidate `75b239b` also failed before dispatch. Its final code-mode catalog contained 656 tools, including no CUA executor; the attempted `js` lookup was undefined. That attempt showed that allowing code mode did not by itself ensure access in that task. The later passes on the same installed revision do not resolve this regression or identify which boundary differed. Exposure flags remain unchanged.

A real direct-local control on the same installed candidate exposed `js` and `js_reset` and successfully created, observed, and closed a task-owned `about:blank` browser tab through the registered CUA tool. This was an actual browser operation in an existing local task, separate from the CLI probe. Its final catalog contained 662 tools. The two host catalogs have other differences, so their total-count difference does not identify the cause.

| Boundary | Earlier direct-local control | Earlier failed delegated Work candidate |
| --- | --- | --- |
| Selected and accepted capability roots for that task | No task-specific snapshot exposed; successful dispatch proves an operational route, not an accepted manifest fingerprint. | Local plugin eligibility established; the roots selected and accepted for this task remain unobserved. |
| Raw tools registered by the task's host | No raw snapshot from this live host; `js` registration is functionally demonstrated by successful dispatch. | No raw snapshot exposed; registration versus downstream filtering remains unresolved. |
| Final callable catalog and dispatch | `js` and `js_reset` present; registered `js` performed the blank-tab control. | Both absent; `js` failed at lookup before MCP dispatch. |
| Inclusion or exclusion reasons | Successful invocation observed; intermediate decision records unavailable. | No task-specific registration or exclusion reason available. |

The available desktop logs for that comparison contain the direct browser session and the failed delegated task's read/completion events, but not the requested three-boundary payloads. The thread-reading tool returns status and turn summaries without accepted roots or a raw catalog. Existing local log-database queries returned no records for either task. These missing records are an observability limit, not evidence that registration never happened. The earlier end-to-end boundary trace remains incomplete despite the later successful tasks.

## Local diagnostics and compatibility experiment

The original 1.2.6 diagnostic build preserved the code-mode and deferred exclusions. The diagnostic exercises both direct and code-mode-only configurations with the installed descriptor. Both tested local Core versions retain a native invocation route with those exclusions, despite the live Work failure.

The current unreleased candidate removes only the code-mode exclusion for a controlled comparison with the failing baseline. Actual local calls through `tools.mcp__autonomous_cua_repl__js` received Core-generated current-turn and permission metadata, and `turn_ended` remained hidden. Those checks demonstrate local compatibility. The live history now includes both a failed Work retest and later native-app and browser passes on the same installed revision. Current functionality is established for the passing cases; a causal repair of the earlier failure is not. The version stays at 1.2.6 and installed candidate `75b239b` remains unchanged. Record its source revision and manifest fingerprint to distinguish the two builds without a version bump.

The diagnostic's loopback responder supplies only a deterministic model tool call. Core creates the session, turn, and permission metadata. A transparent observer compares that MCP metadata with the current model request and thread, without modifying the traffic; receipts retain comparison results rather than identifiers. The registered lifecycle tool retains `_meta.ui.visibility: []` and must be absent from both callable catalogs.

The probe only writes a fixed marker through the REPL. It does not prove site access, browser operation, policy approval, or live Work registration. The inventory smoke uses fixture context and is explicitly labelled inventory-only.

## Remaining regression investigation

The owning platform should derive required native UI namespaces from resolved, enabled, authorized capability registrations and preserve them alongside its own namespaces when creating a durable task. It must keep permission, approval, and trusted dispatch context intact. The downstream catalog must retain at least one supported invocation route for an eligible registered UI tool and distinguish registration errors from presentation filtering. Arbitrary model-supplied namespace strings are not a source of authorization.

The relevant desktop path is `readCapabilityRoots()` → `postExecutorRegistration()` → `thread/environmentReady` → durable child configuration (`Sw()` in build 21477) → backend MCP eligibility and catalog construction. The corresponding current open-source Core logic is in [`core/src/tools/spec_plan.rs`](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/core/src/tools/spec_plan.rs); dispatch metadata is constructed in [`core/src/mcp_tool_call.rs`](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/core/src/mcp_tool_call.rs). The local shim does not own the cloud backend or patch the signed desktop archive.

In this desktop build, `postExecutorRegistration()` sends `selected_capability_roots`, validates a response containing an executor ID, and retains the requested roots in `registeredPluginRoots`. `reportReady()` forwards those roots to the task. The response schema does not provide per-plugin loading results or a raw tool catalog. A successful registration response therefore cannot be reported as proof that the Work host loaded this MCP server. Same-path registration refreshes also compare root IDs and paths, not manifest content; whether the Work loader cached either candidate's contents was not observed.

For a fresh direct task and a fresh delegated Work task using the same installed version, capture these minimal observations from the owning host:

| Observation | Meaning |
| --- | --- |
| Accepted plugin ID, version, and manifest fingerprint | Establishes which installation reached the host. |
| UI tool missing from the registered raw catalog | Registration/loading problem, before presentation filtering. |
| Registered `js`, but absent from native and code-mode catalogs | Catalog exposure problem. |
| Callable `js`, but mismatched or missing host-generated turn context | Dispatch/context problem. |
| Bound call reaches a native policy denial | That specific policy needs investigation. |

Use a diagnostic correlation key and tool names; omit credentials, session/access identifiers, tool arguments, and page contents. A live browser check must use the host's own registered executor and a harmless task-owned page. Never replay another task's context to make it pass.

Locating the earlier regression requires three correlated observations from the owning platform, without changing routing or access controls:

| Event and placement | Minimal payload |
| --- | --- |
| Capability roots selected, at the desktop selection and task-forwarding boundary | Diagnostic correlation key; candidate plugin IDs, versions, manifest fingerprints, selected root IDs, and inclusion/exclusion reasons. Distinguish the requested roots from the host's accepted results. |
| Raw tools registered, in the Work host after capability loading and MCP initialization | Same correlation key; accepted plugin/root fingerprint, server load or skip result, registration errors, and raw tool names. An executor ID alone is insufficient evidence. |
| Callable catalog built, after host configuration and filtering | Same correlation key; effective tool mode, direct-only namespaces, enabled state and exposure exclusions; native/code-mode/deferred inclusion for each raw UI tool and the actual reason for exclusion. Keep app-only/lifecycle-only tools hidden. |

The shim's local verifier cannot emit these as observations of a cloud task. The desktop/delegation platform would need to expose a sanitized diagnostic result. Compare equivalent root-resolution, registration, and final-catalog observations from passing and failing tasks. If a failing Work host never registers CUA, repair forwarding or loading; if registered tools disappear, repair catalog filtering or native-slot preservation. Investigate trusted context only for calls that reach dispatch. This remains a regression investigation; it does not require further exposure changes, a restart, or another access-restoration test for the currently working tasks.
