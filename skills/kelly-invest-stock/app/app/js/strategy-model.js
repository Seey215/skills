const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const fieldsOf = (record) => record.fields || record;
const recordsFor = (records, key) => records.filter((record) => record.baseKey === key);
const STAGES = ["L1", "L2", "L3"];
const stageLabels = {
  L1: "基础观察",
  L2: "进阶观察",
  L3: "高置信观察",
};

const normalizeStrategy = (record) => {
  const fields = fieldsOf(record);
  const requestedStage = fields.stage || fields.status;
  const stage = STAGES.includes(requestedStage) ? requestedStage : "L1";
  return {
    id: record.id || fields.key,
    baseCommitId: record.headCommit?.id || record.headCommitId || null,
    key: String(fields.key || record.id || ""),
    name: String(fields.name || "未命名策略"),
    family: String(fields.family || "独立策略"),
    stage,
    stageLabel: stageLabels[stage],
    thesis: String(fields.thesis || "尚未记录核心假设。"),
    selectionRule: String(fields.selection_rule || "尚未记录选股规则。"),
    invalidationRule: String(fields.invalidation_rule || "尚未记录失效条件。"),
    rebalance: String(fields.rebalance || "按需复核"),
    benchmark: String(fields.benchmark || "--"),
    confidence: toNumber(fields.confidence),
  };
};

const normalizeAccount = (record) => {
  const fields = fieldsOf(record);
  const nominalCapital = toNumber(fields.nominal_capital);
  const nav = toNumber(fields.nav, nominalCapital);
  const returnRate = nominalCapital > 0 ? nav / nominalCapital - 1 : null;
  const benchmarkReturn = toNumber(fields.benchmark_return, null);
  return {
    id: record.id || fields.strategy_key,
    name: String(fields.name || "虚拟账户"),
    strategyKey: String(fields.strategy_key || ""),
    nominalCapital,
    nav,
    cash: toNumber(fields.cash),
    pnl: nav - nominalCapital,
    returnRate,
    benchmarkReturn,
    excessReturn: returnRate === null || benchmarkReturn === null ? null : returnRate - benchmarkReturn,
    cashRate: nav > 0 ? toNumber(fields.cash) / nav : null,
    maxDrawdown: toNumber(fields.max_drawdown, null),
    updatedAt: String(fields.updated_at || "--"),
  };
};

const normalizePosition = (record) => {
  const fields = fieldsOf(record);
  const quantity = toNumber(fields.quantity);
  const entryPrice = toNumber(fields.entry_price, null);
  const latestPrice = toNumber(fields.latest_price, null);
  return {
    id: record.id || `${fields.strategy_key || ""}:${fields.code || ""}`,
    name: String(fields.name || "未命名证券"),
    strategyKey: String(fields.strategy_key || ""),
    code: String(fields.code || ""),
    quantity,
    entryPrice,
    latestPrice,
    marketValue: toNumber(fields.market_value, latestPrice === null ? 0 : quantity * latestPrice),
    weight: toNumber(fields.weight, null),
    pnl: entryPrice === null || latestPrice === null ? null : quantity * (latestPrice - entryPrice),
  };
};

export function createStrategyDesk(records) {
  const accounts = recordsFor(records, "ledger-accounts").map(normalizeAccount);
  const positions = recordsFor(records, "ledger-positions").map(normalizePosition);
  const accountsByStrategy = new Map();
  for (const account of accounts) {
    const strategyAccounts = accountsByStrategy.get(account.strategyKey) || [];
    strategyAccounts.push(account);
    accountsByStrategy.set(account.strategyKey, strategyAccounts);
  }

  const strategies = recordsFor(records, "strategies")
    .map(normalizeStrategy)
    .map((strategy) => {
      const strategyAccounts = accountsByStrategy.get(strategy.key) || [];
      return {
        ...strategy,
        positions: positions.filter((position) => position.strategyKey === strategy.key),
        account: strategyAccounts[0] || null,
        accountCount: strategyAccounts.length,
      };
    })
    .sort(
      (left, right) =>
        (right.account?.returnRate ?? Number.NEGATIVE_INFINITY) -
        (left.account?.returnRate ?? Number.NEGATIVE_INFINITY),
    );

  const strategyKeys = new Set(strategies.map((strategy) => strategy.key));
  const duplicateStrategyKeys = [...strategyKeys].filter(
    (key) => strategies.filter((strategy) => strategy.key === key).length > 1,
  );
  const missingAccountStrategyKeys = strategies
    .filter((strategy) => strategy.accountCount === 0)
    .map((strategy) => strategy.key);
  const duplicateAccountStrategyKeys = strategies
    .filter((strategy) => strategy.accountCount > 1)
    .map((strategy) => strategy.key);
  const orphanAccountIds = accounts
    .filter((account) => !strategyKeys.has(account.strategyKey))
    .map((account) => account.id);
  const orphanPositionIds = positions
    .filter((position) => !strategyKeys.has(position.strategyKey))
    .map((position) => position.id);
  const canonicalAccounts = [
    ...new Map(
      strategies.filter((strategy) => strategy.account).map((strategy) => [strategy.account.id, strategy.account]),
    ).values(),
  ];

  const levels = Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      strategies.filter((strategy) => strategy.stage === stage).sort((a, b) => b.confidence - a.confidence),
    ]),
  );
  const nominalCapital = canonicalAccounts.reduce((sum, account) => sum + account.nominalCapital, 0);
  const nav = canonicalAccounts.reduce((sum, account) => sum + account.nav, 0);
  const cash = canonicalAccounts.reduce((sum, account) => sum + account.cash, 0);
  const benchmarkValue = canonicalAccounts.reduce(
    (sum, account) => sum + account.nominalCapital * (account.benchmarkReturn || 0),
    0,
  );
  const returnRate = nominalCapital > 0 ? nav / nominalCapital - 1 : null;
  const benchmarkReturn = nominalCapital > 0 ? benchmarkValue / nominalCapital : null;
  const integrity = {
    missingAccountStrategyKeys,
    duplicateAccountStrategyKeys,
    duplicateStrategyKeys,
    orphanAccountIds,
    orphanPositionIds,
  };
  integrity.issueCount = Object.values(integrity).reduce((sum, issues) => sum + issues.length, 0);
  integrity.isComplete = integrity.issueCount === 0;

  return {
    strategies,
    accounts,
    positions,
    levels,
    integrity,
    ledger: {
      nominalCapital,
      nav,
      pnl: nav - nominalCapital,
      returnRate,
      benchmarkReturn,
      excessReturn: returnRate === null || benchmarkReturn === null ? null : returnRate - benchmarkReturn,
      cash,
      invested: nav - cash,
      cashRate: nav > 0 ? cash / nav : null,
    },
    attention: {
      l1: levels.L1.length,
      l2: levels.L2.length,
      l3: levels.L3.length,
    },
  };
}

export function createRegressionSnapshot(desk, strategy) {
  const account = strategy?.account || null;
  const totalCapital = desk.ledger.nominalCapital;
  const totalNav = desk.ledger.nav;
  const strategyCapital = account?.nominalCapital || 0;
  const strategyNav = account?.nav || 0;
  const strategyPnl = account?.pnl || 0;
  const remainderCapital = totalCapital - strategyCapital;
  const remainderNav = totalNav - strategyNav;

  return {
    strategy,
    totalReturn: desk.ledger.returnRate,
    strategyReturn: account?.returnRate ?? null,
    contribution: totalCapital > 0 ? strategyPnl / totalCapital : null,
    capitalWeight: totalCapital > 0 ? strategyCapital / totalCapital : null,
    returnWithoutStrategy: remainderCapital > 0 ? remainderNav / remainderCapital - 1 : null,
    remainderCapital,
    remainderNav,
  };
}
