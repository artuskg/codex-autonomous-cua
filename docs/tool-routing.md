# Registered CUA tool routing

## Observed behavior

The desktop configuration transformer in build 21477 replaces `features.code_mode.direct_only_tool_namespaces` with a hotline-only list for Aeon durable tasks. That overwrite alone does not prove that CUA disappears: the standalone 0.164.0 and bundled 0.163.0-alpha.11.2 Core runtimes both preserve native CUA tools when the previous descriptor excludes code mode and deferred discovery. This was checked against their final model request catalogs using a deterministic local responder.

The reported live Work child had no UI executor. Its raw registered catalog, selected capability roots, and effective configuration were not exposed by the available diagnostics. Local registration and an isolated configuration probe are therefore insufficient to identify the failing stage in that child.

A fresh delegated Work retest on October 24 with the original exclusions again had no callable UI executor. The code-mode lookup failed with `tools.mcp__autonomous_cua_repl__js is not a function`, before MCP dispatch; no browser operation ran. A separate attempt to inspect runtime hooks failed because the task's read-only configuration directory prevented SQLite initialization. That filesystem failure provides no evidence about browser policy.

The installed desktop's capability-root selection code admits enabled local marketplace plugins, and the local plugin listing includes this enabled plugin. This establishes local eligibility only. Existing desktop logs show local CUA startup, but do not expose the Work host's accepted roots or raw catalog.

## Local diagnostics and compatibility experiment

The original 1.2.6 diagnostic build preserved the code-mode and deferred exclusions. The diagnostic exercises both direct and code-mode-only configurations with the installed descriptor. Both tested local Core versions retain a native invocation route with those exclusions, despite the live Work failure.

The current unreleased candidate removes only the code-mode exclusion for a controlled comparison with the failing baseline. Actual local calls through `tools.mcp__autonomous_cua_repl__js` received Core-generated current-turn and permission metadata, and `turn_ended` remained hidden. That demonstrates local compatibility, not a repair for the failing Work task. The version stays at 1.2.6; the candidate remains unpublished pending a fresh live Work retest. Record its source revision and manifest fingerprint to distinguish the two builds without a version bump.

The diagnostic's loopback responder supplies only a deterministic model tool call. Core creates the session, turn, and permission metadata. A transparent observer compares that MCP metadata with the current model request and thread, without modifying the traffic; receipts retain comparison results rather than identifiers. The registered lifecycle tool retains `_meta.ui.visibility: []` and must be absent from both callable catalogs.

The probe only writes a fixed marker through the REPL. It does not prove site access, browser operation, policy approval, or live Work registration. The inventory smoke uses fixture context and is explicitly labelled inventory-only.

## Platform follow-up

The owning platform should derive required native UI namespaces from resolved, enabled, authorized capability registrations and preserve them alongside its own namespaces when creating a durable task. It must keep permission, approval, and trusted dispatch context intact. The downstream catalog must retain at least one supported invocation route for an eligible registered UI tool and distinguish registration errors from presentation filtering. Arbitrary model-supplied namespace strings are not a source of authorization.

The relevant desktop path is `readCapabilityRoots()` → `postExecutorRegistration()` → durable child configuration (`Sw()` in build 21477) → backend MCP eligibility and catalog construction. The corresponding current open-source Core logic is in [`core/src/tools/spec_plan.rs`](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/core/src/tools/spec_plan.rs); dispatch metadata is constructed in [`core/src/mcp_tool_call.rs`](https://github.com/openai/codex/blob/rust-v0.164.0/codex-rs/core/src/mcp_tool_call.rs). The local shim does not own the cloud backend or patch the signed desktop archive.

For a fresh direct task and a fresh delegated Work task using the same installed version, capture these minimal observations from the owning host:

| Observation | Meaning |
| --- | --- |
| Accepted plugin ID, version, and manifest fingerprint | Establishes which installation reached the host. |
| UI tool missing from the registered raw catalog | Registration/loading problem, before presentation filtering. |
| Registered `js`, but absent from native and code-mode catalogs | Catalog exposure problem. |
| Callable `js`, but mismatched or missing host-generated turn context | Dispatch/context problem. |
| Bound call reaches a native policy denial | That specific policy needs investigation. |

Use a diagnostic correlation key and tool names; omit credentials, session/access identifiers, tool arguments, and page contents. A live browser check must use the host's own registered executor and a harmless task-owned page. Never replay another task's context to make it pass.

The first platform patch should add three correlated events, without changing routing or access controls:

| Event and placement | Minimal payload |
| --- | --- |
| Registration accepted, after successful `postExecutorRegistration()` | Diagnostic correlation key; accepted plugin IDs, versions, and manifest fingerprints. Record the accepted result, not merely the locally requested roots. |
| Child configuration resolved, after inheritance and host overrides | Same correlation key; effective tool mode, direct-only namespaces, UI-server enabled state, and exposure exclusions. |
| Tool catalog filtered, in the backend that owns the final catalog | Same correlation key; raw registered UI tool name, native/code-mode/deferred inclusion, and a reason when excluded, such as unregistered, disabled, policy-denied, app-only/lifecycle-only, over-budget, or surface-excluded. |

The shim's local verifier cannot emit these as observations of a cloud task. The desktop/delegation platform must implement them in its source and expose a sanitized diagnostic result. A confirmed filtering failure can then justify a routing patch; missing registration or metadata requires its own fix.
