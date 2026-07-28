---
name: kelly-app-skill-creator
description: Design human-and-Agent operating apps on Busabase using Research, Plan, Action, and Retrospective workflows. Use when a user wants an approval queue, research desk, planner, action console, operating dashboard, control panel, or collaboration workspace. This skill is Busabase-only and must use both `$busabase` and `$busabase-app-creator`; it does not define a local provider, runtime, data layer, or deployment path of its own.
---

# Kelly App Skill Creator

Turn a recurring human-and-Agent operating process into a focused Busabase app. Own the product workflow and delegation contract, not the Busabase implementation.

## Mandatory Dependencies

Before designing or creating anything:

1. Read and follow `$busabase` for connection, target Space, API, ChangeRequest, review, and merge behavior.
2. Read and follow `$busabase-app-creator` for discovery, resource modeling, native Views, Vault requirements, security, AirApp engineering, scaffolding, validation, and deployment.

If either skill is unavailable, stop and report the missing dependency. Do not recreate its behavior inside this skill.

## Busabase-Only Contract

- Every app is a new Busabase Folder with native resources and an AirApp created by `$busabase-app-creator`.
- There is no provider choice during onboarding. Do not offer local files, a local provider, browser storage, or a generic data-provider abstraction.
- Never ask users to paste API keys or secrets into the app, source files, chat, or setup form. `$busabase` owns connection readiness; `$busabase-app-creator` owns non-secret Vault requirement modeling and trusted execution boundaries.
- Use native Base Views for routine table, gallery, kanban, calendar, and gantt work. Use the AirApp for cross-resource synthesis, prioritization, guidance, and focused commands.
- Preserve reviewability. The app may propose work through ChangeRequests or a modeled approval/opt-out queue; it does not hide canonical mutation or external side effects.

## Product Loop

Default to this four-stage operating loop:

### 1. Research

An Agent collects evidence on a schedule or on demand, updates an idempotent report for the relevant period, and records source freshness, coverage, uncertainty, and findings.

### 2. Plan

Research becomes concrete, deduplicated work items linked back to its evidence. Humans review an attention queue, change priority or timing, and opt out of work that should not proceed. If the product normally executes recommendations, new items may default to Ready with a clear opt-out window.

### 3. Action

An Agent claims eligible work, creates reviewable deliverables or technical changes, updates status, and leaves progress/result comments. External side effects use the trusted execution path designed by `$busabase-app-creator`.

### 4. Retrospective

Humans and Agents compare outcomes with the original evidence: what shipped, what was blocked, what changed the metric, what created noise, and whether prompts, skills, thresholds, data sources, or workflow rules should change.

Not every app needs every stage as a separate screen. Every blueprint must state where each stage happens or why it is intentionally omitted.

## Human And Agent Responsibilities

Agents should:

- gather and normalize evidence;
- update period-based reports idempotently;
- create deduplicated recommendations or issues with traceability;
- execute only eligible work;
- record progress, outcomes, failures, and evidence;
- propose workflow or skill improvements during retrospective.

Humans should:

- see what needs attention without reading every record;
- opt out, block, reprioritize, reschedule, or request revision;
- approve consequential external side effects when the workflow requires it;
- judge whether results were useful and whether operating rules should change.

Design for ordinary operators. Repository skill nodes and implementation details do not belong in the user-facing Folder unless they are genuinely part of daily work.

## App Types

Read `references/app-types.md` and `references/workflow-patterns.md`, then select the smallest fitting type:

- Research desk;
- review and approval queue;
- planner with kanban/calendar;
- action console;
- retrospective dashboard;
- operating dashboard;
- control panel;
- collaboration workspace.

Combine types only when the recurring workflow needs them. Avoid a dashboard that merely repeats native Base Views.

## Discovery

Use the one-question-at-a-time interaction required by `$busabase-app-creator`. Learn enough to answer:

- Who operates this app, how often, and what outcome do they own?
- What triggers Research and what defines one reporting period?
- How does evidence become a Plan item, and how is duplication prevented?
- What defaults to eligible, what can a human opt out of, and how long is the window?
- What does Action produce, where is it reviewed, and which side effects are external?
- What signals make Retrospective useful?
- Which states require human attention?
- Which recurring operations are better served by native Views than an AirApp screen?

Do not ask the user to choose providers, frameworks, schema mechanics, or credential storage.

## Product Overlay Spec

Before invoking creation, produce this concise overlay for `$busabase-app-creator`:

```markdown
# Product Overlay

User and outcome: ...
App type: ...

Research: trigger, period key, evidence, freshness, idempotency
Plan: recommendation/issue rule, traceability, default eligibility, opt-out
Action: claim rule, deliverable, review point, external side effects
Retrospective: outcome signals, review cadence, skill/process feedback

Human attention states: ...
Agent responsibilities: ...
Native Views needed: ...
AirApp screens and focused actions: ...
Guide copy in plain language: ...
Explicit exclusions: ...
```

This overlay describes product behavior only. `$busabase-app-creator` translates it into the full Busabase blueprint, resource graph, capability matrix, data budgets, security model, implementation, and deployment plan.

## Onboarding

On first use:

1. Invoke `$busabase` to establish Cloud/Desktop connection and target workspace safely.
2. Invoke `$busabase-app-creator` to run its deployment/source/product interview.
3. Supply the approved Product Overlay Spec as product context.
4. Let `$busabase-app-creator` present and validate the complete blueprint.
5. Follow its separate structure, Demo UI, AirApp CR, seed, and target-run approval gates.

The operator should experience one coherent onboarding flow. Do not show dependency handoffs as competing setup systems.

## Daily UX

The app's Help/Guide copy should explain the real operating loop in plain language:

1. Run or wait for Research.
2. Review Plan items and opt out of work that should not run.
3. Run Action for eligible items and review its deliverables.
4. Use Retrospective to improve the workflow and its skills.

Page-level guides explain only the current operation and recovery path. Do not expose provider jargon or implementation instructions to ordinary users.

## Completion Criteria

Finish only when:

- `$busabase` connection and target are explicit;
- `$busabase-app-creator` owns and validates the complete technical blueprint;
- Research, Plan, Action, and Retrospective are represented or intentionally omitted;
- human attention, opt-out, review, and Agent claim rules are unambiguous;
- the user-facing Folder contains only useful daily resources;
- no local/provider alternative or secret-entry UI exists;
- all approvals, validation, deployment, and real-data checks required by the dependency skills pass.

## Stop Conditions

Stop when a dependency is unavailable, the target Space is ambiguous, a side effect lacks an approval/trusted-execution model, or the workflow cannot define who may opt out or authorize work.
