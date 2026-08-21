# Client Health Collector Operations Foundation Contract

Status: deterministic data-layer foundation only (Task 6a). No production collection is enabled.

## Current production posture

- Every production client allowlist is empty.
- Every production source, account, relation, spreadsheet, range, alias, ClickUp list, and request allowlist is empty.
- No production adapter is registered with the refresh orchestrator.
- No credentials are configured or read by this foundation.
- No scheduled workflow, cron job, n8n workflow, webhook, or other automatic trigger is active.
- The foundation performs no database, schema, seed, mapping, source, or UI setup by itself.
- Canary Data is outside the client-health project boundary and is not a source or target.

A future production enablement requires a separately reviewed task that supplies approved plans, adapters, persistence, lifecycle repositories, credentials, operational controls, and release evidence. This document does not authorize that work.

## Injected run contract

`runClientHealthRefresh` accepts only injected data and ports:

1. A frozen run plan with one `snapshotDate`, calculation version, source-contract version, unique invocation UUID, bounded lease duration, bounded per-call deadline, bounded concurrency, and client plans.
2. Each client plan contains a complete `SnapshotAssemblyInput` skeleton whose `sourceResults` starts empty.
3. Approved clients contain exactly one collector for every `sourceBindings` key and no collector outside that set. Configuration-required clients contain no collectors; their bindings and metric configuration are deliberately not interpreted.
4. A lifecycle repository port creates/completes refresh and source runs.
5. `AtomicSnapshotPersistencePort` is passed to the approved Task 5b `storeSnapshot` boundary.
6. An ordered clock supplies every canonical timestamp. The orchestrator does not read ambient time.

Before any lifecycle write or collector call, the orchestrator validates and deeply reconstructs the complete approved assembly authorization: Phoenix windows, required and optional source lists, binding identity and fingerprint, provider-specific binding fields, metric configuration, and fixed values. Unknown authorization fields are rejected rather than forwarded. Collectors receive only this frozen normalized client context, their exact approved binding, and their exact per-collector source-row window. They must return a completed adapter result (`succeeded`, `partial`, or `failed`). They do not receive repository or persistence ports from the orchestrator.

Each collector explicitly declares either two canonical date endpoints or a `null`/`null` pair for a non-windowed source. Date windows must be ordered and remain within the approved Phoenix previous-period start through snapshot date. The exact pair is persisted on the source-run row; orchestration never substitutes a shared or inferred window.

## Deterministic execution and evidence

- Client IDs and source keys are processed in code-unit canonical order.
- Refresh-run and source-run IDs are deterministic caller-generated UUIDs derived from the normalized run identity. Lifecycle create methods must be idempotent for that exact ID and requested identity.
- Every successful create receipt and response-loss readback must match the complete requested identity, including status, parent/client/source keys, exact nullable windows, versions, and `startedAt`. The authoritative run hash uses the persisted refresh `startedAt`, never an unverified local value.
- A create throw or malformed create receipt is an uncertain response, not proof that creation failed. The orchestrator reads the exact caller-known ID and continues only when the complete returned identity and expected `collecting`/`running` state match. Mismatch or unavailable reconciliation stops forward progress.
- After refresh creation, each process generates a cryptographically random per-execution claim-attempt UUID and atomically acquires an exclusive lease. The claim-attempt UUID is excluded from refresh identity and evidence. A logical invocation UUID, exact claim-attempt UUID, and positive monotonic fencing token are passed to every subsequent lifecycle mutation and atomic persistence call; implementations must reject inactive, expired, wrong-attempt, or stale-fence operations.
- Lease acquisition response loss is reconciled against the exact refresh, logical invocation, and per-execution claim attempt. A duplicate process using the same logical invocation still has a different attempt UUID and cannot adopt another process's lease. An invocation that cannot prove ownership performs no collection, persistence, cleanup, failure, validation, or publication against the shared run.
- Before every bounded owned phase, the orchestrator atomically renews the exact invocation-attempt-fence claim to a strictly later expiry. Renewal response loss requires exact readback reconciliation. The lease duration must exceed every individual operation deadline by a fixed safety margin, so an operation aborts before its renewed lease can expire. Uncertain renewal ownership stops every further mutation.
- Every source-run row is established before collection begins. The caller-known source ID is tracked before crossing the create boundary, so an unreconciled response-loss path can best-effort close that exact ID without guessing whether creation committed.
- Collection uses explicit bounded concurrency; completion timing cannot change assembly, source completion, persistence, receipt, or run-hash ordering.
- Adapter payloads remain untrusted until the approved assembler validates and projects them.
- Source-run completion uses only assembler-sanitized status, freshness, row count, request fingerprint, public failure reason, and evidence. Raw adapter errors and extra evidence fields are never persisted by orchestration.
- Every client assembly is persisted through `storeSnapshot`, including incomplete snapshots produced from adapter-declared partial or failed results.
- The authoritative refresh evidence hash covers explicit run identity/version/date/start metadata and sorted client entries containing client ID, assembly evidence hash, persistence idempotency key, and snapshot ID.
- Validation occurs only after all source completions and valid atomic persistence receipts. Publication occurs only after validation succeeds.
- Every lifecycle call, collector call, and persistence call has its own bounded deadline and receives an `AbortSignal`. Timeout aborts the in-flight operation, clears its timer, stops forward progress, and enters the same fail-closed cleanup path.

## Fail-closed lifecycle

Infrastructure throws, malformed collector output, assembly rejection, source completion failure, persistence or receipt rejection, and validate/publish repository failures stop forward transitions immediately. The orchestrator:

- performs no internal retry;
- never validates or publishes further;
- only after proving exclusive ownership, attempts `failRefreshRun` exactly once with the same invocation UUID and fencing token plus the fixed public code `refresh_orchestration_failed` and message `Client health refresh failed.`;
- preserves the original exception only as the thrown `RefreshOrchestrationError.cause`, never as persisted text;
- best-effort closes still-running source rows with empty evidence and fixed public source failure fields; and
- never allows cleanup failure to replace the primary exception.

Publication has an additional response-loss rule. If publish throws or times out, the orchestrator reads the exact refresh ID: a proven `published` state returns the already-built successful result; a proven `validated` state permits the fixed failure transition; an unavailable, malformed, mismatched, or otherwise unknown state skips `failRefreshRun` so a publication that may have committed is never reversed.

Adapter-declared `partial` and `failed` results are data outcomes rather than orchestration failures. They must assemble and persist an incomplete snapshot, after which a fully successful lifecycle may still validate and publish the refresh.

## Activation prerequisites (not implemented)

Before any production allowlist or schedule can become non-empty, a separate approval must establish exact client/source mappings, least-privilege credentials, production adapters, database-backed atomic lease/fencing enforcement for every lifecycle and persistence mutation, atomic persistence implementation, lifecycle repository wiring, bounded-concurrency capacity, monitoring, rollback, raw-native reconciliation, and all gates in `qa-release-gates.md`.
