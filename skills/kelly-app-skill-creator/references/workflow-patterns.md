# Busabase Workflow Patterns

Use these product patterns to make Research, Plan, Action, and Retrospective understandable and auditable.

## Period-Keyed Research

- Define the period key, such as calendar date in an explicit timezone.
- Repeated runs update the same report instead of creating duplicates.
- Store run time, source cutoff, coverage, freshness, uncertainty, and meaningful deltas.
- Preserve links to evidence and generated Plan items.
- Mark partial research without turning missing source data into a performance conclusion.

## Evidence-To-Plan Traceability

Every recommendation or issue should answer:

- Which report/evidence created it?
- What problem or opportunity was observed?
- What outcome is expected?
- Why is this priority appropriate?
- How will duplication be detected?
- What would make a human opt out?

## Default-Ready With Opt-Out

Use when the user says recommendations normally should run:

- new eligible work defaults to Ready;
- a clear attention queue surfaces exceptions;
- humans may mark Do not do, Blocked, revise priority, or reschedule;
- Action claims only work still eligible after the opt-out window;
- high-consequence work may still require explicit approval.

Do not mislabel this as a mandatory approval queue. The interface should say what actually happens.

## Agent Claim And Recovery

- Claim one eligible item atomically or through an equivalent idempotent contract.
- Record started time, Agent/run identity, attempt, and heartbeat when work is long-running.
- Move to In review when a deliverable exists; move to Blocked with a specific recovery request when it cannot proceed.
- Do not mark Done until the defined outcome exists.
- Retrying must not duplicate records, files, publishing, messages, or other side effects.

## Reviewable Deliverables

Action should usually create a draft, ChangeRequest, branch/PR, document, asset, or other reviewable artifact. Store its canonical reference on the work item. Publishing or sending is a separate trusted operation unless the user explicitly designed and authorized otherwise.

## Retrospective Feedback

For each review period, capture:

- useful findings and completed outcomes;
- false positives, duplicate work, and ignored items;
- blockers and slow handoffs;
- metric movement and confounding factors;
- changes proposed to prompts, skills, thresholds, sources, schedules, or UI;
- owner and next validation date for each improvement.

Retrospective recommendations enter the same Plan discipline as other work. Do not silently rewrite a production skill from one anomalous run.

## Attention Design

The overview should prioritize exceptions such as partial research, stale sources, opt-out deadline, high-risk Ready work, blocked execution, failed retries, review waiting, and overdue retrospective. Routine healthy rows belong in native Views.

## Plain-Language Guide

Explain the daily loop as:

1. Research gathers and updates evidence.
2. Plan turns evidence into work; people remove or adjust what should not run.
3. Action executes eligible work and leaves reviewable results.
4. Retrospective checks outcomes and improves the workflow.

Avoid provider, schema, RPC, framework, or repository terminology in operator-facing guidance.
