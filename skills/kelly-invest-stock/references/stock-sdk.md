# No-Key China Stock Data

Use this reference when implementing, debugging, or changing market-data ingestion.
The details were checked on 2026-07-28. Re-check the package and its upstream
behavior before upgrading because public market-site interfaces change frequently.

## Fixed Adapter

Use `stock-sdk@2.4.0` exactly. It is a community JavaScript/TypeScript adapter that
wraps public market-data interfaces and requires no API key, token, licence, Python,
native binary, or runtime dependency.

Primary references:

- Package: https://www.npmjs.com/package/stock-sdk
- Source: https://github.com/chengzuopeng/stock-sdk
- Documentation: https://stock-sdk.linkdiary.cn

The package supports more markets and asset types than this skill. Use only
mainland A-shares, relevant mainland indices, and exchange-traded stock ETFs. Do
not enable Hong Kong stocks, US stocks, futures, or options without a separately
approved product-scope change.

## Approved Capabilities

| Need | Interface | Notes |
| --- | --- | --- |
| One or several current quotes | `sdk.quotes.cnSimple(symbols)` | Normalize results and retain each row's actual `source`. |
| Full A-share quote refresh | `sdk.batch.cn({ concurrency })` | Run as a bounded background refresh, never an interactive cursor loop. |
| Daily/weekly/monthly K-lines | `sdk.kline.cn(symbol, options)` | Store period, date window, and adjustment mode. |
| K-lines with local indicators | `sdk.kline.withIndicators(symbol, options)` | Treat derived indicators as calculations, not provider facts. |
| Security search | `sdk.search(keyword)` | Confirm exchange and code before creating a canonical security. |

The package may use Tencent Finance, Eastmoney, or another public upstream source
depending on the method and version. These are not exchange-authoritative APIs and
do not provide a service-level agreement. Record the source returned by the SDK;
do not label every row simply as `stock-sdk`.

## Execution Pattern

Run the adapter from reviewed JavaScript Agent or trusted Workflow execution that
can write normalized records to Busabase. Keep it out of AirApp browser code so the
UI remains deterministic, avoids CORS and public-site coupling, and reads only
bounded Busabase resources.

Install or execute the exact version only:

```bash
npm install --save-exact stock-sdk@2.4.0
npx -y stock-sdk@2.4.0 quote 600519 --format json
```

Minimal module usage:

```js
import { StockSDK } from "stock-sdk";

const sdk = new StockSDK({
  retry: { maxRetries: 2, baseDelay: 500 },
  providerPolicies: {
    eastmoney: { timeout: 12000, rateLimit: { requestsPerSecond: 1, maxBurst: 1 } },
  },
});

const rows = await sdk.quotes.cnSimple(["sh600519", "sz000001"]);
```

Do not load the package from a third-party CDN. Do not install or build packages at
AirApp runtime. If a trusted Workflow requires a reviewed bundle, create it during
scaffolding, commit the exact generated JavaScript, and validate it under the target
runtime before deployment.

## Normalization And Quality Contract

- Canonical identity: source-confirmed exchange plus six-digit code. Keep the raw
  SDK symbol alongside the canonical value.
- Times: store source time when present, `fetched_at` in UTC, and the corresponding
  `Asia/Shanghai` trading date.
- Units: normalize price and value to CNY; retain whether volume is shares or lots.
- Adjustments: record unadjusted, forward-adjusted, or backward-adjusted on every
  series. Do not compare adjusted history directly with raw user cost basis.
- Suspensions and gaps: distinguish suspended, not yet published, unsupported,
  unmapped, and upstream error. Do not coerce any of these to zero.
- Provenance: store `adapter=stock-sdk`, exact adapter version, actual upstream
  source, method, request window, coverage count, and error summary for every run.
- Reconciliation: reject duplicate exchange/code/date rows and flag price changes
  that imply an unresolved corporate action or adjustment mismatch.

## Failure Behavior

Use bounded concurrency and the adapter's retry, rate-limit, and circuit-breaker
controls. Avoid a request per position when a batch method exists. On exhaustion,
preserve the last good snapshot, mark it stale, create one deduplicated attention
item, and show which positions and totals are partial. Never relabel cached data as
fresh and never invent a quote.

Because the upstream interfaces are public website endpoints, stop and reassess if
their terms, response shape, availability, or access controls change. Do not bypass
access controls or increase request rates to work around blocking.
