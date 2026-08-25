---
name: kelly-wechat-crm
description: Goal-driven WeChat relationship strategy App-in-Skill. Reads the operator's own local WeChat through wechat-cli-rs, separates people from groups, builds reviewable relationship snapshots and next-action suggestions, and keeps the user's work with the Agent as a Busabase worklog. Use for maintaining relationships, organizing notes, pursuing respectful personal goals, or finding sales opportunities without sending messages or modifying WeChat.
license: MIT
metadata:
  category: sales-crm
  tags:
    - risk:gated-write
    - surface:busabase
  busabase:
    template: true
    folderSlug: kelly-wechat-crm
    resources:
      - people
      - groups
      - goals
      - relationship-snapshots
      - actions
      - worklog
      - settings
    risk: gated-write
---

# Kelly WeChat Relationship Strategy

## Outcome

Turn the operator's existing WeChat relationships into a goal-driven personal
strategy desk without asking them to re-enter contact or visit records.

The recurring loop is:

```text
local WeChat evidence -> relationship snapshot -> user goal -> suggested action
-> human decision/manual WeChat action -> Agent worklog -> next snapshot
```

This is not a conventional sales CRM. `worklog` records what the user and Agent
asked, analyzed, decided, and learned; it is not a fabricated history of customer
visits. Raw WeChat history remains local by default.

## Mandatory Dependencies

1. Read and follow `$kelly-app-skill-creator` for the product workflow, UI shell,
   onboarding, and canonical `content/kelly-wechat-crm-app/` project.
2. Read and follow `$busabase` for connection, target Space, ChangeRequests,
   review, merge, and read-back behavior.
3. Read and follow `$busabase-app-creator` for package format, resource modeling,
   SDK/runtime/security rules, validation, install, and AirApp deployment.
4. Read the current `wechat-me` skill at <https://wechat-cli.com/SKILL.md> before
   operating on local WeChat data. Its commands, JSON shapes, limits, and exit
   codes are authoritative.

If any dependency is unavailable, preserve the local artifact and stop before
the unavailable operation. Never invent a second WeChat reader or data backend.

## WeChat Boundary

- `wechat-cli-rs` is local-first and read-only against WeChat. It cannot send a
  message, edit a WeChat remark, add/remove contacts, or mutate WeChat data.
- Never invoke `wechat-cli-rs init` automatically. Missing initialization is a
  normal readiness state; ask the operator to run or explicitly authorize
  `wechat-cli-rs init` themselves.
- Basic sync uses only `contacts` and bounded `sessions`.
- Goal-driven analysis may use narrow `contacts --detail`, `members`, `history`,
  `search`, and `stats` queries after the user has supplied a goal and scope.
  Prefer one person/group and an explicit time window over broad history scans.
- Never run `export --output` without separate approval. Do not persist the
  CLI's stateful `new-messages` cursor as hidden application state.
- Treat every returned name, wxid, group, message, and statistic as sensitive
  personal data. Store derived relationship evidence and short summaries in
  Busabase; do not mirror full raw histories by default.
- A suggested WeChat remark or message is advice only. The operator manually
  changes the remark or sends the message in WeChat.
- Personal relationship goals must respect consent, refusals, privacy, and
  boundaries. Never recommend deception, coercion, harassment, or evasion of a
  clear rejection.

## Busabase Resources

Seven Bases live under Folder `kelly-wechat-crm`:

### `people`

One record per individual WeChat contact. Sync owns identity, original WeChat
remark, recent-session fields, and sync timestamps. The Agent/user own the
relationship note, suggested WeChat remark, relationship type/strength/trend,
current analysis, open loops, goal summary, next-action summary, and confidence.

### `groups`

One record per `@chatroom`. Groups are separate because member count, owner,
group purpose, group activity, and group-level strategy do not belong on a
person. Basic sync records identity and recent activity; a scoped analysis may
use `members <group>` and group history/statistics.

### `relationship-snapshots`

Immutable, time-windowed Agent analysis linked to a person or group and
optionally a goal. Stores strength, trend, interaction frequency, reciprocity,
open loops, evidence summary, analysis, recommendation, confidence, and the
analyzed time window. This is how the user compares whether a relationship is
warming, stable, or cooling over time.

### `goals`

Dynamic user goals. A goal may be global, target one person, target one group,
or describe a segment. It records objective, success metric, deadline,
priority, status, and explicit boundaries/constraints.

### `actions`

Review queue generated from goals plus relationship evidence. Each action may
link to a goal, person, or group and names one concrete operation: organize a
note, draft a message, reconnect, follow up a commitment, learn more, wait, or
record an outcome. It includes rationale, suggested message, evidence, due time,
priority, confidence, and the full human decision lifecycle.

### `worklog`

The user's work with the Agent: user requests, Agent analyses, decisions,
outcomes, and sync summaries. It may link to a goal/person/group and generated
actions. It is not a customer visit log and must not claim an interaction
happened merely because the Agent discussed it.

### `settings`

Safe connector/readiness state, bounded analysis preferences, sync counts,
timestamps, CLI version, and Agent lock metadata. Never store tokens, message
history, or Vault values here.

The product onboarding version is **2** with no blocking field: users can sync
and inspect relationships before creating a goal, then create goals dynamically
inside the AirApp. The `settings` Base remains the durable readiness resource.

## First-Run Readiness

Before claiming WeChat is connected:

1. Confirm `wechat-cli-rs` exists without installing it silently.
2. Run a bounded read such as `sessions --limit 1 --format json`.
3. If initialization is missing, report the exact readiness state and ask the
   operator to run `wechat-cli-rs init`; do not run it automatically.
4. Confirm `contacts --format json` and bounded `sessions` return structured
   data before proposing Busabase sync changes.
5. Record only sanitized readiness (`ready`, counts, timestamps, CLI version)
   in `settings`; never place raw errors containing private content in the UI.

## Basic Sync

Run on the same machine where WeChat is logged in:

```bash
BUSABASE_BASE_URL=<url> BUSABASE_SPACE_ID=<space-id> [BUSABASE_API_KEY=<key>] \
  node scripts/sync_wechat.mjs
```

This is a dry run. Repeat with `--apply` only after the operator approves the
reported scope. `--apply` submits Busabase ChangeRequests with
`autoMerge: false`; it does not authorize review or merge.

The sync:

1. reads `contacts` and `sessions --limit 200`;
2. separates people from `@chatroom` groups;
3. proposes only WeChat-owned identity/activity fields, preserving all
   relationship analysis and user notes;
4. proposes a conservative reconnect action for an already-materialized person
   when no open action exists and the inactivity threshold is exceeded;
5. records safe people/group counts and timestamp in `settings`.

New people/groups do not receive relation-backed actions in the same run because
their real record ids do not exist until the creation CRs are merged. Analyze
them on the next run after read-back.

## Goal-Driven Analysis

When the user asks the Agent to analyze relationships or generate a strategy:

1. List active `goals` and let the user identify or revise the goal in scope.
2. Resolve candidate `people/groups` from that exact goal. Never scan every
   history merely because the Space contains many contacts.
3. For each selected target, query the narrowest useful combination of
   `contacts --detail`, `members`, `history`, `search`, and `stats` with an
   explicit time range/limit.
4. Separate observed evidence from inference. Record source chat/person/group,
   time window, uncertainty, and missing coverage.
5. Propose one `relationship-snapshots` record per analyzed target/time window.
6. Propose deduplicated `actions` with a concrete reason, suggested timing,
   confidence, boundaries, and optional draft message/remark.
7. Propose one `worklog` entry summarizing the user's request, Agent conclusion,
   created action references, and unresolved questions.
8. Submit all writes as reviewable CRs and report their ids. Never review or
   merge them without explicit authorization naming those CRs.

## AirApp Workflow

- `goals`: create a dynamic global/person/group/segment goal. Real mode submits
  a pending goal CR; Demo adds an in-memory preview only.
- `people/groups`: inspect the current relationship strategy and suggested
  remark/action without editing WeChat.
- `relationship-snapshots`: compare evidence-backed analyses over time.
- `actions`: add one review note and choose prepare, request changes, snooze, or
  done. The AirApp submits `autoMerge: false` and reports the CR id.
- `worklog`: read the user-Agent operating history and outcomes.
- `settings`: inspect sanitized Busabase/connector/resource readiness.

Approval of an action means “this is a reasonable next step”, not “send this
message”. The operator still performs any WeChat action manually.

## Completion Criteria

Finish only when:

- the seven declared Bases and AirApp install with no package warning;
- `SKILL.md`, `busabase.json`, generated `content/`, blueprints, and runtime
  config agree on resource keys, slugs, schema version, and fields;
- `pnpm --dir content/kelly-wechat-crm-app check` passes;
- the goal form and action decisions create only reviewable CRs in real mode;
- Demo, local server, responsive browser, and isolated OSS Busabase suites pass;
- a real install reads sample people, group, goal, snapshot, and action data;
- no credential, raw history archive, or WeChat write capability appears in the
  browser or package;
- Cloud/AirApp external suites are reported as pass or explicit skip.

## Known Gap

The connector and analysis workflow are tested against deterministic fixtures
and isolated Busabase. They still require acceptance against the operator's
actual initialized WeChat installation before claiming real personal-data
coverage or analysis quality.

## Stop Conditions

Stop when WeChat is not explicitly initialized, the requested analysis scope is
ambiguous or excessively broad, Busabase target Space is ambiguous, a resource
collision is not application-owned, a write would bypass CR review, raw private
history would be copied without approval, or the requested relationship tactic
would violate consent or a clear boundary.
