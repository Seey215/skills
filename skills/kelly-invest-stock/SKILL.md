---
name: kelly-invest-stock
description: Design and operate a Busabase-only, read-only China stock portfolio and research workspace using the no-key, pure-JavaScript stock-sdk market-data adapter. Use when the user invokes $kelly-invest-stock or /kelly-invest-stock, wants to monitor Shanghai, Shenzhen, or Beijing A-share holdings or watchlists, track related mainland indices or exchange-traded stock ETFs, refresh quotes and K-lines, or review portfolio value, cost basis, unrealized P/L, concentration, drawdown, market moves, research hypotheses, and recurring China stock reviews. It never connects to a brokerage, places orders, moves money, or presents generated analysis as personalized investment advice.
---

# Kelly Invest Stock

Create a focused China stock research desk and portfolio monitor on Busabase. Keep
personal holdings separate from public market data, preserve freshness and source
provenance, and turn findings into review items rather than trades.

## Mandatory Dependencies

Before designing, creating, or changing the app:

1. Read and follow `$kelly-app-skill-creator` for the Research, Plan, Action, and Retrospective product loop.
2. Read and follow `$busabase` for connection, target Space, API, ChangeRequest, review, and merge behavior.
3. Read and follow `$busabase-app-creator` for resource modeling, native Views, AirApp runtime limits, security, validation, and deployment.
4. Read `references/stock-sdk.md` before implementing or changing market-data ingestion.

If any required skill is unavailable, stop and report the missing dependency. Do
not replace Busabase with a local app, browser storage, or a file-backed provider.

## Product Boundary

- Treat this as read-only investment monitoring and research. Never place, modify,
  or cancel orders; never transfer money; never connect to a brokerage session.
- Limit the first version to mainland China A-shares on Shanghai, Shenzhen, and
  Beijing exchanges, related mainland indices, and exchange-traded stock ETFs.
  Exclude Hong Kong stocks, US stocks, futures, and options even when the data
  adapter supports them.
- Store holdings through Busabase manual entry or an approved broker-export import.
  Public market-data interfaces do not provide the user's brokerage positions.
- Use exact-pinned `stock-sdk@2.4.0` as the fixed no-key JavaScript adapter. Do not
  add API-key, token, licence, Vault, Python, native-binary, or subprocess setup.
- Run market refresh through a reviewed JavaScript Agent or trusted Workflow that
  writes normalized records to Busabase. The AirApp must read those records through
  Busabase RPC and must not call public market sites directly from browser code.
- Describe findings as evidence, scenarios, or review prompts. Do not claim
  suitability, guaranteed returns, or exchange-authoritative real-time data.

## Discovery

Use the one-question-at-a-time interview required by `$busabase-app-creator`.
Determine:

- whether the operator tracks held positions, a watchlist, or both;
- how positions enter the app: manual entry, broker CSV export, or an existing
  Busabase resource;
- the base portfolio, benchmark, review cadence, and `Asia/Shanghai` cutoff;
- which exceptions deserve attention, such as stale quotes, missing symbols,
  concentration, drawdown, unusual moves, or an expiring research thesis;
- which facts a research note must contain before it can create a review item;
- which review horizon and outcome signals make retrospective useful.

Do not ask about frameworks, schema mechanics, credentials, or provider choice.

## Operating Loop

### Research

Refresh the security master, market snapshot, K-lines, selected benchmarks, and
portfolio-derived metrics on schedule or on demand. Use the `Asia/Shanghai` trading
date plus run type (`preopen`, `intraday`, `close`, or `ondemand`) as the period key.
Update the same report and snapshot on repeated runs instead of creating duplicates.

Record adapter version, actual upstream source returned by the adapter, source time
when available, fetch time, coverage, failures, adjustment mode, and freshness.
Never substitute an upstream source silently or infer a missing price.

### Plan

Turn material findings into deduplicated review items linked to the report,
security, and evidence. Examples include concentration review, thesis check,
corporate-action reconciliation, missing-data follow-up, or a scenario to inspect.
Default items to `Needs review`, not `Ready to trade`. Let a human dismiss,
reprioritize, reschedule, or request deeper research.

### Action

Allow only safe, reviewable actions: refresh data, import a holdings file through a
ChangeRequest, recalculate portfolio metrics, create a cited research memo, or
update a review item's status and notes. Keep any buy, sell, target-weight, broker,
or order-ticket path outside this skill.

### Retrospective

At the chosen horizon, compare each reviewed hypothesis with subsequent price and
benchmark behavior, note confounders, and assess data quality. Propose changes to
thresholds, sources, schedules, or research prompts as new Plan items; do not
silently rewrite production rules from one outcome.

## Product Overlay

Adapt this overlay with the user's answers, then give it to
`$kelly-app-skill-creator` and `$busabase-app-creator`:

```markdown
# Product Overlay

User and outcome: Monitor held and watched mainland China stocks with source-aware market data and a durable review process.
App type: Research desk + operating dashboard.

Research: Asia/Shanghai trading-date/run-type period key; exact-pinned stock-sdk JavaScript adapter; no credentials; idempotent snapshots and reports; explicit upstream source, freshness, coverage, adjustment mode, and failures.
Plan: Evidence-linked review items for concentration, drawdown, unusual moves, thesis checks, corporate-action reconciliation, and data gaps; default Needs review; never executable trades.
Action: Refresh data through reviewed JavaScript execution, import holdings through reviewable mutation, recalculate metrics, create research memos, and resolve review items; no brokerage or money movement.
Retrospective: Compare hypotheses with later security and benchmark outcomes; review false positives, stale sources, and threshold quality.

Human attention states: Stale/partial/failed refresh, unmapped symbol, missing price, cost-basis mismatch, threshold exception, overdue review, and unresolved upstream-source change.
Agent responsibilities: Normalize symbols, gather public data, compute traceable metrics, flag uncertainty, draft research, deduplicate review items, and record outcomes.
Native Views needed: Portfolios, positions, watchlist, securities, market snapshots, K-lines, research reports, review items, and retrospectives.
AirApp screens and focused actions: Portfolio overview, attention queue, security detail, research report, and retrospective; Refresh, Analyze, Create review item, Dismiss, and Resolve.
Guide copy in plain language: Update market data, review exceptions, inspect evidence, record a decision, then compare the outcome later.
Explicit exclusions: Trading, order tickets, broker login, transfers, API keys, tokens, secret-entry UI, Python runtime, personalized suitability claims, and unlabeled upstream data.
```

Prefer native table Views for positions and snapshots. Use the AirApp for
cross-resource totals, concentration, performance versus benchmark, attention
prioritization, and evidence-linked review.

## Metric Rules

- Use CNY as the default currency and preserve the six-digit security code plus
  source-confirmed exchange. Resolve ambiguous symbols through the current security
  master rather than relying only on prefix heuristics.
- Calculate market value as `quantity * latest usable price` and unrealized P/L as
  `market value - cost basis`. Mark totals partial when any held position lacks a
  usable price.
- Use unadjusted prices for current market value and user cost-basis comparisons.
  Label the adjustment mode used for return charts; never mix adjusted history with
  raw cost basis.
- Keep `source_as_of`, `fetched_at`, `freshness_status`, `coverage_status`,
  `adapter_version`, and `upstream_source` visible. Say "latest available" unless
  the source supplies a trustworthy timestamp and latency contract.
- Compute portfolio weights only over priced positions and disclose excluded
  positions. Do not make partial coverage look complete.

## Completion Criteria

Finish only when:

- the Busabase connection and target Space are explicit;
- the approved Product Overlay has been translated and validated by
  `$busabase-app-creator`;
- holdings and public market data have separate provenance;
- `stock-sdk` is pinned exactly and every refresh records adapter version, actual
  upstream source, timestamps, freshness, coverage, and failures;
- no API key, token, licence, Vault requirement, Python runtime, native binary, or
  subprocess is required;
- metrics pass fixture checks for missing prices, suspended securities, zero cost,
  duplicate symbols, partial refreshes, and upstream-source changes;
- the user can review attention items and trace every finding to evidence;
- no browser-side market fetch, brokerage path, trading action, or personalized
  investment claim exists;
- deployment and real-data checks required by the dependency skills pass.

## Stop Conditions

Stop when a dependency is unavailable, the target Space is ambiguous, public-source
terms do not permit the intended use, symbol identity cannot be resolved, freshness
is unknown for a consequential calculation, or the requested workflow crosses into
brokerage execution or money movement.
