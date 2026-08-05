const record = (id, baseKey, fields) => ({ id, baseKey, fields });

const SNAPSHOT_AT = "2026-08-05 14:31 CST";
const SPY_RETURN = 0.037;
const stageOverrides = new Map();

const strategySeeds = [
  {
    id: "strategy-buffett",
    key: "buffett-quality-value",
    name: "巴菲特式·优质价值",
    family: "价值 / 护城河",
    stage: "L3",
    confidence: 84,
    nav: 114800,
    cash: 22300,
    drawdown: -0.082,
    thesis: "用合理价格持有现金流稳定、资本回报率高且护城河可解释的企业。",
    selection: "优先品牌、成本或网络优势明确的公司；要求自由现金流可持续，避免依赖短期估值扩张。",
    invalidation: "护城河被削弱、资本配置持续恶化，或盈利质量无法支持长期复利假设。",
    rebalance: "半年",
    positions: [
      ["AAPL", "Apple", 100, 205, 250],
      ["AXP", "American Express", 100, 265, 300],
      ["KO", "Coca-Cola", 300, 62, 65],
      ["OXY", "Occidental Petroleum", 400, 49, 45],
    ],
  },
  {
    id: "strategy-munger",
    key: "munger-great-business",
    name: "查理·芒格式·伟大公司",
    family: "集中 / 商业质量",
    stage: "L2",
    confidence: 80,
    nav: 110500,
    cash: 1000,
    drawdown: -0.096,
    thesis: "少而精地持有商业模式简单、议价能力强、可长期再投资的伟大公司。",
    selection: "组合保持集中；要求管理层理性、单位经济清晰、长期增长不依赖高杠杆。",
    invalidation: "商业质量判断错误，或买入价格使未来十年回报显著低于基准。",
    rebalance: "年度",
    positions: [
      ["COST", "Costco", 50, 870, 950],
      ["GOOGL", "Alphabet", 160, 176, 200],
      ["BRK.B", "Berkshire Hathaway", 60, 455, 500],
    ],
  },
  {
    id: "strategy-duan",
    key: "duan-business-model",
    name: "段永平式·商业模式",
    family: "本分 / 长坡厚雪",
    stage: "L2",
    confidence: 77,
    nav: 108200,
    cash: 18800,
    drawdown: -0.103,
    thesis: "先看懂生意如何长期赚钱，再用足够安全的价格等待价值兑现。",
    selection: "关注用户价值、竞争格局和企业文化；只纳入能用朴素语言解释盈利来源的公司。",
    invalidation: "核心用户价值下降、竞争优势不可持续，或管理层长期偏离股东价值。",
    rebalance: "半年",
    positions: [
      ["AAPL", "Apple", 180, 210, 250],
      ["BABA", "Alibaba", 250, 103, 120],
      ["PDD", "PDD Holdings", 120, 108, 120],
    ],
  },
  {
    id: "strategy-lynch",
    key: "lynch-growth-at-price",
    name: "彼得·林奇式·成长合理价",
    family: "成长 / GARP",
    stage: "L1",
    confidence: 72,
    nav: 105600,
    cash: 21100,
    drawdown: -0.121,
    thesis: "从日常可观察的业务变化中寻找盈利增长尚未被充分定价的公司。",
    selection: "增长必须能落到门店、用户或利润；PEG 与资产负债表共同约束买入价格。",
    invalidation: "增长只剩叙事、利润兑现持续落后，或估值已透支多年正常增长。",
    rebalance: "季度",
    positions: [
      ["SBUX", "Starbucks", 300, 82, 95],
      ["MELI", "MercadoLibre", 20, 1920, 2150],
      ["NVO", "Novo Nordisk", 130, 92, 100],
    ],
  },
  {
    id: "strategy-marks",
    key: "marks-cycle-contrarian",
    name: "霍华德·马克斯式·周期逆向",
    family: "周期 / 风险控制",
    stage: "L1",
    confidence: 68,
    nav: 102400,
    cash: 15400,
    drawdown: -0.074,
    thesis: "在市场情绪和风险溢价极端时逆向配置，把避免永久损失放在追逐涨幅之前。",
    selection: "跟踪信用利差、估值分位和市场共识；仓位随赔率而不是情绪变化。",
    invalidation: "周期判断没有估值保护，或下行风险被错误归类为短期波动。",
    rebalance: "月度",
    positions: [
      ["TLT", "20+ Year Treasury ETF", 500, 88, 92],
      ["BAC", "Bank of America", 500, 41, 46],
      ["KR", "Kroger", 300, 61, 60],
    ],
  },
  {
    id: "strategy-fisher",
    key: "fisher-long-growth",
    name: "菲利普·费雪式·长期成长",
    family: "成长 / 深度调研",
    stage: "L3",
    confidence: 75,
    nav: 107900,
    cash: 14900,
    drawdown: -0.134,
    thesis: "持有研发能力、销售组织和长期成长空间同时优秀的公司，减少无效换手。",
    selection: "验证产品壁垒、研发效率与管理层诚信；增长空间需显著大于当前收入体量。",
    invalidation: "研发投入不能转化为产品优势，或组织能力无法支撑下一阶段增长。",
    rebalance: "半年",
    positions: [
      ["MSFT", "Microsoft", 80, 470, 510],
      ["NVDA", "NVIDIA", 150, 168, 200],
      ["TSM", "Taiwan Semiconductor", 80, 250, 278],
    ],
  },
  {
    id: "strategy-graham",
    key: "graham-margin-safety",
    name: "格雷厄姆式·安全边际",
    family: "深度价值 / 分散",
    stage: "L1",
    confidence: 61,
    nav: 98500,
    cash: 19500,
    drawdown: -0.158,
    thesis: "用可量化的资产与盈利保护构建分散组合，让价格折扣承担主要安全垫。",
    selection: "低估值必须有资产负债表支撑；分散持有，避免把便宜误判为质量。",
    invalidation: "账面价值持续缩水、债务侵蚀安全边际，或价值陷阱比例长期过高。",
    rebalance: "季度",
    positions: [
      ["GM", "General Motors", 500, 49, 55],
      ["CVS", "CVS Health", 500, 63, 70],
      ["INTC", "Intel", 500, 30, 33],
    ],
  },
  {
    id: "strategy-lilu",
    key: "lilu-owner-mindset",
    name: "李录式·所有者思维",
    family: "价值 / 长期持有",
    stage: "L1",
    confidence: 79,
    nav: 112300,
    cash: 14800,
    drawdown: -0.088,
    thesis: "把股票当作企业所有权，在可理解、可预测且资本配置优秀的生意上集中下注。",
    selection: "要求长期竞争优势、保守财务结构和可信管理层；只在明显低于内在价值时建仓。",
    invalidation: "企业经济特征发生结构性变化，或所有者收益长期偏离原始假设。",
    rebalance: "年度",
    positions: [
      ["BRK.B", "Berkshire Hathaway", 70, 460, 500],
      ["GOOGL", "Alphabet", 150, 178, 200],
      ["BAC", "Bank of America", 500, 40, 45],
    ],
  },
];

const strategyRecords = strategySeeds.map((seed) =>
  record(seed.id, "strategies", {
    name: seed.name,
    key: seed.key,
    family: seed.family,
    status: seed.stage,
    thesis: seed.thesis,
    selection_rule: seed.selection,
    invalidation_rule: seed.invalidation,
    rebalance: seed.rebalance,
    benchmark: "SPY",
    confidence: seed.confidence,
  }),
);

const accountRecords = strategySeeds.map((seed) =>
  record(`account-${seed.key}`, "ledger-accounts", {
    name: `${seed.name}虚拟账本`,
    strategy_key: seed.key,
    nominal_capital: 100000,
    nav: seed.nav,
    cash: seed.cash,
    benchmark_return: SPY_RETURN,
    max_drawdown: seed.drawdown,
    updated_at: SNAPSHOT_AT,
  }),
);

const positionRecords = strategySeeds.flatMap((seed) =>
  seed.positions.map(([code, name, quantity, entryPrice, latestPrice]) => {
    const marketValue = Number((quantity * latestPrice).toFixed(2));
    return record(`position-${seed.key}-${code.toLowerCase().replaceAll(".", "-")}`, "ledger-positions", {
      name,
      strategy_key: seed.key,
      code,
      quantity,
      entry_price: entryPrice,
      latest_price: latestPrice,
      market_value: marketValue,
      weight: Number((marketValue / seed.nav).toFixed(4)),
    });
  }),
);

const recordsWithOverrides = () => [
  ...strategyRecords.map((strategy) => ({
    ...strategy,
    fields: {
      ...strategy.fields,
      status: stageOverrides.get(strategy.id) || strategy.fields.status,
    },
  })),
  ...accountRecords,
  ...positionRecords,
];

export const demoProvider = {
  name: "demo",
  async getState() {
    return {
      provider: {
        ok: true,
        name: "demo",
        mode: "deterministic_preview",
        readOnly: true,
        stageWritable: true,
        asOf: SNAPSHOT_AT,
      },
      records: recordsWithOverrides(),
      pageInfo: {},
    };
  },
  async updateStrategyStage(recordId, stage) {
    if (!strategyRecords.some((strategy) => strategy.id === recordId)) throw new Error("STRATEGY_NOT_FOUND");
    if (!["L1", "L2", "L3"].includes(stage)) throw new Error("INVALID_STAGE");
    stageOverrides.set(recordId, stage);
    return { persisted: true, transient: true };
  },
};
