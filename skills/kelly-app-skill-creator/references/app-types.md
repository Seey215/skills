# Busabase App Types

Choose the smallest product shape that supports the recurring operation. `$busabase-app-creator` decides the technical resource and UI implementation.

## Research Desk

Use when Agents periodically collect evidence and humans need a durable report plus source freshness and uncertainty.

Core product behavior:

- one idempotent report per period key;
- evidence and source coverage remain inspectable;
- findings link to generated Plan items;
- stale, partial, or failed sources are visible;
- retrospective compares findings with later outcomes.

## Review And Approval Queue

Use when most proposed work may proceed but humans need an attention-focused opt-out/revision window.

Core product behavior:

- default eligibility is explicit;
- attention states emphasize risky, blocked, low-confidence, or expiring work;
- humans can opt out, block, reprioritize, reschedule, or request revision;
- actions and reasons are auditable;
- no approval vocabulary is used when the real model is simply opt-out.

## Planner

Use when work needs sequencing across backlog, schedule, owner, or dependencies.

Prefer native kanban, calendar, and gantt Views. Add an AirApp screen only for cross-project prioritization, capacity synthesis, or a focused planning command.

## Action Console

Use when an Agent claims eligible work and produces reviewable deliverables.

Core product behavior:

- eligibility and claim rules prevent duplicate execution;
- progress, retries, blockers, result references, and comments are visible;
- external side effects are separated from draft creation;
- downstream review location is explicit;
- operators can recover or requeue failed work.

## Retrospective Dashboard

Use when the team needs to improve workflow rules, prompts, skills, thresholds, or data sources.

Show outcomes tied to original evidence and decisions, not decorative aggregate metrics. Record proposed improvements with an owner, expected signal, and next review date.

## Operating Dashboard

Use for a compact cross-stage overview: freshness, attention, planned work, action progress, and recent outcomes. It should link into native Views and details rather than duplicate all rows.

## Control Panel

Use when a small set of high-consequence controls changes scheduling, thresholds, feature behavior, or trusted integrations. Every control needs scope, current value/status, consequence, authorization, and recovery. Secret values never appear in the AirApp.

## Collaboration Workspace

Use when multiple roles coordinate through reports, issues, comments, artifacts, and decisions. Model responsibility and handoff explicitly. Avoid showing repository skill nodes or technical resources that ordinary operators do not use.

## Combination Rule

A mature app may combine an operating dashboard, review queue, planner, action console, and retrospective. Keep one shared lifecycle and navigation model. Do not create a screen for a stage already served well by a native Busabase View.
