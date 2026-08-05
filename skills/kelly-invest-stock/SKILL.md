---
name: kelly-invest-stock
description: Build and operate a Busabase-backed stock-strategy experiment desk with a bundled local Hono App-in-Skill, strategy-level L1/L2/L3 manual maturity labels, one virtual ledger per strategy, and portfolio regression/backtest snapshots. Use when the user invokes $kelly-invest-stock or /kelly-invest-stock, wants to define or compare stock strategies, inspect a strategy and its virtual book, manually label strategy maturity, or review virtual performance, drawdown, and contribution to the total book. It never connects to a brokerage, places orders, moves money, or presents generated analysis as personalized investment advice.
---

# Kelly Invest Stock

Operate a compact strategy experiment desk. Keep the first screen centered on a
large strategy table: concise thesis, maturity label, account NAV, return,
benchmark, drawdown, cash, and virtual positions. Open a row for the complete
strategy and ledger detail.

## Mandatory Dependencies

Before changing the app:

1. Read and follow `$kelly-app-skill-creator` for product behavior, responsive UI,
   and the canonical local `app/` artifact.
2. Read and follow `$busabase` for connection, target Space, ChangeRequests,
   review, and merge behavior.
3. Read and follow `$busabase-app-creator` for resource modeling, AirApp runtime,
   security, validation, and deployment.
4. Read `references/stock-sdk.md` before changing market-data ingestion.

If a dependency is unavailable, continue safe local artifact work but stop before
the unavailable deployment or Busabase operation. Never create a second
persistent backend.

## Product Boundary

- Keep every account, position, return, stage, and regression result virtual.
  Never connect to Futu or another brokerage, create order UI, or call a trading
  API.
- Give every strategy exactly one virtual account and default every new strategy
  to `L1`.
- Treat `L1`, `L2`, and `L3` as manual labels on the whole strategy, never on an
  individual stock:
  - `L1`: default basic observation;
  - `L2`: manually marked advanced observation;
  - `L3`: manually marked high-confidence observation.
- Do not copy the live-trading meaning of L2/L3 from `invest-ui`. In this skill,
  changing a label never changes execution mode, account type, or capital.
- Keep thesis, evidence, assumptions, confidence, and invalidation separate. A
  label or score is not a recommendation.
- Use exact-pinned `stock-sdk@2.4.0` only in reviewed trusted execution. Browser
  code performs no public market fetch.

## Data And Modes

- Use Busabase as the persistent source by default. A normal invocation or URL
  must never silently switch to Demo.
- Enter Demo only when the user explicitly asks to open or update Demo. Demo data
  is deterministic, clearly labeled, and not persistent.
- Use recognizable investor-style Demo strategies such as Buffett, Munger, Duan
  Yongping, Peter Lynch, Howard Marks, Fisher, Graham, or Li Lu style examples.
  Label them as style reproductions; never imply actual holdings, endorsement, or
  current advice.
- Read and write persistent state through `busabase-sdk`. Stage changes use a
  reviewed `records.changeRequest` update to the strategy record's `status`
  field. Never persist stage changes in browser storage or local files.

## Core Resources

Keep three application-owned Bases under one application Folder:

- `strategies`: name, key, family, `status`, thesis, selection rule,
  invalidation rule, review cadence, benchmark, and confidence.
- `ledger-accounts`: one virtual account per strategy with nominal capital, NAV,
  cash, benchmark return, maximum drawdown, and update time.
- `ledger-positions`: virtual quantity, entry price, reference price, market
  value, weight, and strategy key.

Provision missing resources lazily through one Busabase ChangeRequest, re-read
the Folder, and use only validated materialized IDs. Ignore legacy app-owned
resources outside this declaration; never delete or adopt them implicitly.

## Operating Loop

### Research

Define a strategy's thesis, selection rule, invalidation rule, benchmark, review
cadence, and virtual account before evaluating it. Preserve source and freshness
for market observations.

### Plan

State the evidence needed for the next review. New strategies remain L1. Treat an
L2/L3 change as a human maturity judgment, not an automated promotion or trading
authorization.

### Action

Allow reviewed research updates, virtual-ledger records, and mouse-driven manual
stage marking. Send persistent stage changes through Busabase ChangeRequest and
reload the canonical record after materialization.

### Retrospective

Compare virtual return, benchmark, maximum drawdown, and contribution to the
whole book. Record whether thesis or process failed before changing a strategy's
rules.

## UI Contract

- Use a fixed desktop sidebar with Strategy, L1, L2, L3, Regression, and Help &
  Settings. Do not add a separate Virtual Ledger tab.
- Make the Strategy route a large full-width table that combines strategy summary
  and ledger reality. Clicking the entire row opens Strategy Detail.
- Put strategy rules, the manual L1/L2/L3 segmented control, account summary, and
  positions together in Strategy Detail.
- Make L1/L2/L3 routes filter strategies, not stocks.
- Make Regression a strategy-focused virtual-book retrospective. With only a
  current ledger snapshot, show strategy return, total-book return, contribution
  (`strategy P/L / total nominal capital`), and total-book return with the
  strategy removed. Do not invent Sharpe, Alpha, Beta, R², or a backtest without
  historical NAV observations.
- On mobile, use the shared off-canvas sidebar, a separate detail route, sticky
  back action, and no horizontal page overflow at 390px or 360px.
- Keep the virtual-only boundary visible. Do not describe L2 as Futu paper trading
  or L3 as real trading anywhere in this app.

## Metric Rules

- Calculate position P/L as `quantity * (latest reference price - virtual entry
  price)` and account return as `NAV / nominal capital - 1`.
- Calculate total-book return from summed account NAV and summed nominal capital.
- Calculate regression snapshot contribution as `strategy account P/L / total
  nominal capital`; calculate the removal case from the remaining accounts.
- Compare strategies on the same window and benchmark before ranking them.
- Keep Demo observations fixed and dated. Never present them as live data.

## Completion Criteria

Finish only when:

- `pnpm --dir app dev` remains supported and deterministic checks pass;
- Strategy overview/detail, L1/L2/L3 strategy filters, manual stage marking, and
  Regression work on desktop and mobile;
- every strategy has one virtual account plus explicit selection and invalidation
  rules;
- the three-resource declaration and lazy provisioning pass fixture tests;
- normal mode uses Busabase, while Demo is explicit, deterministic, and labeled;
- no brokerage path, real-money stage, trading action, or personalized investment
  claim exists; and
- available dependency-skill deployment and real-data checks pass.

## Stop Conditions

Stop before consequential Busabase mutation when the target Space is ambiguous,
the viewer lacks permission, ownership cannot be proven, a stale record would be
overwritten, or the request crosses into brokerage execution or money movement.
