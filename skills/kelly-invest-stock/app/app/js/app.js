import { appConfig } from "./config.js?v=0.6.0";
import { getProvider } from "./providers/index.js?v=0.6.0";
import { createRegressionSnapshot, createStrategyDesk } from "./strategy-model.js?v=0.6.0";

const root = document.querySelector("#app");
const money = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const price = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const viewMeta = {
  strategies: { label: "策略", noun: "个策略", eyebrow: "STRATEGY DESK" },
  l1: { label: "L1 基础观察", noun: "个策略", eyebrow: "VIRTUAL LEDGER" },
  l2: { label: "L2 进阶观察", noun: "个策略", eyebrow: "MANUAL STAGE" },
  l3: { label: "L3 高置信观察", noun: "个策略", eyebrow: "MANUAL STAGE" },
  regression: { label: "回归", noun: "个策略", eyebrow: "BACKTEST SNAPSHOT" },
};

let currentState;
let activeProvider;
let desk;
let contentRoute = { view: "strategies", id: null };
let lastContentHash = "#/strategies";
let sidebarCollapsed = false;
let helpTab = "guide";
let authStatus = null;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatPercent = (value, signed = true) =>
  value === null || !Number.isFinite(value) ? "--" : `${signed && value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

const tone = (value) => {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
};

const parseHash = () => {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "settings") {
    return { view: "settings", tab: ["guide", "resources", "connection"].includes(parts[1]) ? parts[1] : "guide" };
  }
  const view = viewMeta[parts[0]] ? parts[0] : "strategies";
  return {
    view,
    id: view === parts[0] && parts[1] ? decodeURIComponent(parts[1]) : null,
  };
};

const routeHash = ({ view, id }) => `#/${view}${id ? `/${encodeURIComponent(id)}` : ""}`;

const navigate = (route, { replace = false } = {}) => {
  const next = routeHash(route);
  if (replace) window.history.replaceState(null, "", next);
  else window.location.hash = next;
  if (replace) applyRoute();
};

const isMobileLayout = () => window.matchMedia("(max-width: 720px)").matches;

const setMobileSidebarOpen = (open) => {
  document.body.classList.toggle("sidebar-open", Boolean(open));
  const scrim = document.querySelector("#sidebarScrim");
  if (scrim) scrim.hidden = !open;
};

const setMobileDetailOpen = (open) => {
  document.body.classList.toggle("mobile-detail-open", Boolean(open));
};

const showToast = (message) => {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => {
    toast.hidden = true;
  }, 2400);
};

const itemsForView = (view) => {
  if (["strategies", "regression"].includes(view)) return desk.strategies;
  if (view === "l1") return desk.levels.L1;
  if (view === "l2") return desk.levels.L2;
  if (view === "l3") return desk.levels.L3;
  return [];
};

const stageBadge = (stage) => `<span class="stage-badge stage-${stage.toLowerCase()}">${stage}</span>`;

const strategyStageSummary = (strategy) =>
  `<div class="strategy-stage-cell">${stageBadge(strategy.stage)}<strong>${escapeHtml(strategy.stageLabel)}</strong></div>`;

const strategyPositionSummary = (strategy) => {
  if (!strategy.account) return '<span class="ledger-cell-missing">账户待补齐</span>';
  if (!strategy.positions.length)
    return `<strong>现金</strong><small>${formatPercent(strategy.account.cashRate, false)}</small>`;
  return `<strong>${strategy.positions
    .slice(0, 3)
    .map((position) => escapeHtml(position.code))
    .join(
      " · ",
    )}</strong><small>${strategy.positions.length} 个持仓 · 现金 ${formatPercent(strategy.account.cashRate, false)}</small>`;
};

const renderStrategyTable = (strategies, title = "策略与虚拟账本") => `<section class="strategy-overview" aria-label="策略与虚拟账本总览">
  <div class="strategy-overview-head"><div><strong>${escapeHtml(title)}</strong><span>${strategies.length} 个策略 · 点击整行查看详情${currentState.provider.name === "demo" ? " · 大师风格复刻，不代表真实持仓" : ""}</span></div><span>按虚拟收益排序</span></div>
  <div class="strategy-table-wrap">
    <table class="strategy-table">
      <thead><tr><th class="rank-col">#</th><th class="strategy-col">策略</th><th class="thesis-col">策略简述</th><th>晋级阶段</th><th class="number-col">账本 NAV</th><th class="number-col">收益 / 基准</th><th class="number-col">超额</th><th class="number-col">最大回撤</th><th class="positions-col">账本持仓</th><th class="open-col"><span class="sr-only">打开</span></th></tr></thead>
      <tbody>${strategies
        .map((strategy, index) => {
          const account = strategy.account;
          const accountIssue = strategy.accountCount !== 1;
          return `<tr class="strategy-table-row ${accountIssue ? "account-issue" : ""}" data-select-id="${escapeHtml(strategy.id)}" tabindex="0" role="link" aria-label="打开策略 ${escapeHtml(strategy.name)}">
            <td class="rank-col">${String(index + 1).padStart(2, "0")}</td>
            <td class="strategy-col"><strong>${escapeHtml(strategy.name)}</strong><span>${escapeHtml(strategy.family)}</span></td>
            <td class="thesis-col"><p>${escapeHtml(strategy.thesis)}</p><span>${escapeHtml(strategy.rebalance)} · ${escapeHtml(strategy.benchmark)}</span></td>
            <td>${strategyStageSummary(strategy)}</td>
            <td class="number-col"><strong>${account ? money.format(account.nav) : "--"}</strong><span>本金 ${account ? money.format(account.nominalCapital) : "--"}</span></td>
            <td class="number-col"><strong class="${tone(account?.returnRate ?? null)}">${formatPercent(account?.returnRate ?? null)}</strong><span>基准 ${formatPercent(account?.benchmarkReturn ?? null)}</span></td>
            <td class="number-col"><strong class="${tone(account?.excessReturn ?? null)}">${formatPercent(account?.excessReturn ?? null)}</strong></td>
            <td class="number-col"><strong class="negative">${formatPercent(account?.maxDrawdown ?? null, false)}</strong></td>
            <td class="positions-col">${strategyPositionSummary(strategy)}</td>
            <td class="open-col" aria-hidden="true">›</td>
          </tr>`;
        })
        .join("")}</tbody>
    </table>
  </div>
</section>`;

const fact = (label, value, extraClass = "") =>
  `<div class="detail-fact ${extraClass}"><span>${label}</span><strong>${value}</strong></div>`;

const renderStageLanes = (strategy) =>
  `<div class="stage-lanes">${["L1", "L2", "L3"]
    .map(
      (stage) =>
        `<div class="stage-lane ${strategy.stage === stage ? "current" : ""}"><span>${stageBadge(stage)}<small>${{ L1: "默认 · 基础观察", L2: "手工标记 · 进阶观察", L3: "手工标记 · 高置信观察" }[stage]}</small></span><div>${strategy.stage === stage ? "<b>当前标记</b>" : "<em>--</em>"}</div></div>`,
    )
    .join("")}</div>`;

const renderStageControl = (strategy) => `<div class="stage-control-row"><span>手工标记</span><div class="stage-control" role="group" aria-label="手工标记策略阶段">${["L1", "L2", "L3"]
  .map(
    (stage) =>
      `<button type="button" data-stage-value="${stage}" aria-pressed="${strategy.stage === stage}" class="${strategy.stage === stage ? "active" : ""}">${stage}</button>`,
  )
  .join("")}</div></div>`;

const renderStrategyPositions = (strategy) =>
  `<div class="position-table"><div class="position-table-head"><span>标的</span><span>权重</span><span>盈亏</span></div>${
    strategy.positions
      .map(
        (position) =>
          `<div class="position-table-row"><span><strong>${escapeHtml(position.code)}</strong><small>数量 ${position.quantity} · 成本 ${position.entryPrice === null ? "--" : `$${price.format(position.entryPrice)}`} · 参考 ${position.latestPrice === null ? "--" : `$${price.format(position.latestPrice)}`}</small><i><b style="width:${Math.max(0, Math.min(100, (position.weight || 0) * 100))}%"></b></i></span><span>${formatPercent(position.weight, false)}</span><span class="${tone(position.pnl)}">${position.pnl === null ? "--" : money.format(position.pnl)}</span></div>`,
      )
      .join("") || '<div class="empty-state">暂无虚拟持仓。</div>'
  }</div>`;

const renderStrategyDetail = (strategy) => {
  const account = strategy.account;
  const investedRate = account?.cashRate === null || account?.cashRate === undefined ? null : 1 - account.cashRate;
  const accountWarning = !account
    ? `<section class="ledger-missing"><strong>该策略没有独立虚拟账户</strong><p>缺少 strategy_key 为 <code>${escapeHtml(strategy.key)}</code> 的 ledger-accounts 记录，因此不计入组合 NAV、收益或现金比例。</p></section>`
    : strategy.accountCount > 1
      ? `<section class="ledger-integrity-detail"><strong>检测到 ${strategy.accountCount} 个同策略账户</strong><span>当前仅采用第一条记录参与汇总，需合并为一个独立账本。</span></section>`
      : "";
  const ledgerSections = account
    ? `<section class="detail-section"><div class="section-head-inline"><h3>虚拟账户</h3><span>${escapeHtml(account.name)}</span></div><div class="fact-grid">${fact("当前净值", money.format(account.nav))}${fact("名义本金", money.format(account.nominalCapital))}${fact("虚拟盈亏", money.format(account.pnl), tone(account.pnl))}${fact("现金", money.format(account.cash))}</div></section>
      <section class="detail-section"><h3>虚拟持仓</h3>${renderStrategyPositions(strategy)}</section>
      <p class="ledger-stamp">账本更新于 ${escapeHtml(account.updatedAt)} · 不连接券商，不产生真实订单</p>`
    : '<section class="detail-section"><h3>账本边界</h3><p class="detail-copy">每个策略必须恰好对应一个虚拟账户，持仓使用相同 strategy_key；修复通过受信任的 Busabase 工作流完成。</p></section>';
  return `<div class="detail-scroll">
    <button class="strategy-detail-back back-to-list" type="button" data-back-to-list>&larr; 返回策略总览</button>
    <div class="detail-heading"><div><p class="eyebrow">${escapeHtml(strategy.family)}</p><h2>${escapeHtml(strategy.name)}</h2></div>${stageBadge(strategy.stage)}</div>
    ${renderStageControl(strategy)}
    ${accountWarning}
    <div class="strategy-performance">
      <div class="confidence-dial" style="--score:${strategy.confidence}"><span><strong>${strategy.confidence}</strong><small>置信度</small></span></div>
      <div><span>虚拟收益</span><strong class="${tone(account?.returnRate ?? null)}">${formatPercent(account?.returnRate ?? null)}</strong><small>基准 ${formatPercent(account?.benchmarkReturn ?? null)}</small></div>
      <div><span>超额收益</span><strong class="${tone(account?.excessReturn ?? null)}">${formatPercent(account?.excessReturn ?? null)}</strong><small>vs ${escapeHtml(strategy.benchmark)}</small></div>
      <div><span>最大回撤</span><strong class="negative">${formatPercent(account?.maxDrawdown ?? null, false)}</strong><small>${escapeHtml(strategy.rebalance)}</small></div>
    </div>
    <div class="capital-allocation"><div><span>虚拟资金使用</span><strong>${formatPercent(investedRate, false)}</strong></div><div><i style="width:${Math.max(0, Math.min(100, (investedRate || 0) * 100))}%"></i></div><small>持仓 ${money.format((account?.nav || 0) - (account?.cash || 0))} · 现金 ${money.format(account?.cash || 0)}</small></div>
    <div class="strategy-detail-columns"><div>
      <section class="detail-section"><h3>核心假设</h3><p class="detail-copy">${escapeHtml(strategy.thesis)}</p></section>
      <section class="detail-section"><h3>选股与失效</h3><dl class="detail-list"><div><dt>入选规则</dt><dd>${escapeHtml(strategy.selectionRule)}</dd></div><div><dt>失效条件</dt><dd>${escapeHtml(strategy.invalidationRule)}</dd></div><div><dt>复核频率</dt><dd>${escapeHtml(strategy.rebalance)}</dd></div></dl></section>
      <section class="detail-section"><h3>策略阶段</h3>${renderStageLanes(strategy)}<p class="detail-note">标记对象是整套策略，不是持仓个股。三个阶段都只使用当前虚拟账本；L2/L3 不连接富途、不接券商 API，也不产生真实订单。</p></section>
    </div><div class="strategy-ledger-column">${ledgerSections}</div></div>
  </div>`;
};

const renderFunnel = () => `<section class="workflow-band"><div class="funnel" aria-label="策略晋级漏斗">
  ${[
    ["l1", "L1", "基础观察", desk.levels.L1.length],
    ["l2", "L2", "进阶观察", desk.levels.L2.length],
    ["l3", "L3", "高置信观察", desk.levels.L3.length],
  ]
    .map(
      ([view, level, label, count], index) =>
        `<button class="funnel-step ${contentRoute.view === view ? "active" : ""}" type="button" data-view="${view}">${stageBadge(level)}<span><strong>${label}</strong><small>${count} 个策略</small></span>${index < 2 ? '<i aria-hidden="true">›</i>' : ""}</button>`,
    )
    .join("")}
</div><div class="workflow-pulse"><span><strong>${desk.strategies.length}</strong> 策略在赛马</span><span class="${tone(desk.ledger.excessReturn)}"><strong>${formatPercent(desk.ledger.excessReturn)}</strong> 组合超额</span></div></section>`;

const renderSidebar = () => {
  const hasLedgerIssues = desk.integrity.issueCount > 0;
  const counts = {
    strategies: desk.strategies.length,
    l1: desk.levels.L1.length,
    l2: desk.levels.L2.length,
    l3: desk.levels.L3.length,
    regression: "分析",
  };
  return `<aside class="sidebar ${sidebarCollapsed ? "collapsed" : ""}" id="appSidebar">
    <div class="brand"><div class="brand-icon" aria-hidden="true">KS</div><div class="brand-copy"><div class="brand-title">Kelly Invest Stock</div><div class="brand-subtitle">策略实验台</div></div><button class="sidebar-toggle" type="button" data-sidebar-toggle aria-controls="appSidebar" aria-expanded="${!sidebarCollapsed}" aria-label="切换侧栏" title="切换侧栏"><span class="sidebar-toggle-icon" aria-hidden="true"></span></button></div>
    <section class="human-work" aria-labelledby="humanWorkTitle"><div class="human-work-eyebrow">需要你</div><div id="humanWorkTitle" class="human-work-title">${hasLedgerIssues ? "账本完整性" : "策略标记"}</div><button class="human-work-primary" type="button" data-view="${hasLedgerIssues ? "strategies" : "l1"}"><span><strong>${hasLedgerIssues ? desk.integrity.issueCount : desk.attention.l1}</strong><span>${hasLedgerIssues ? "项策略账本待处理" : "L1 策略待观察"}</span></span></button><div class="human-work-secondary"><button type="button" data-view="l2"><strong>${desk.attention.l2}</strong><span>L2 标记</span></button><button type="button" data-view="l3"><strong>${desk.attention.l3}</strong><span>L3 标记</span></button></div></section>
    <div class="sidebar-separator"></div>
    <nav class="filters" aria-label="工作流导航">${Object.entries(viewMeta)
      .map(
        ([key, meta]) =>
          `<button class="${contentRoute.view === key ? "active" : ""}" type="button" data-view="${key}" aria-label="打开${meta.label}" title="打开${meta.label}"><span>${meta.label}</span><span>${counts[key]}</span></button>`,
      )
      .join("")}</nav>
    <div class="help-box"><div class="virtual-only"><span></span>全程虚拟 · 阶段可手工标记</div><button class="help-button" type="button" data-open-help>帮助与设置</button></div>
  </aside>`;
};

const renderSummaryStrip = () => `${
  desk.integrity.isComplete
    ? ""
    : `<section class="ledger-integrity-band" role="status"><strong>账本数据不完整</strong><span>${desk.integrity.missingAccountStrategyKeys.length} 个策略缺账户 · ${desk.integrity.duplicateAccountStrategyKeys.length} 个策略账户重复 · ${desk.integrity.orphanAccountIds.length + desk.integrity.orphanPositionIds.length} 条孤立记录</span></section>`
}<section class="summary-strip" aria-label="策略账本组合摘要">
  <div><span>名义本金</span><strong>${money.format(desk.ledger.nominalCapital)}</strong></div>
  <div><span>当前净值</span><strong>${money.format(desk.ledger.nav)}</strong></div>
  <div><span>虚拟盈亏</span><strong class="${tone(desk.ledger.pnl)}">${money.format(desk.ledger.pnl)}</strong></div>
  <div><span>累计收益</span><strong class="${tone(desk.ledger.returnRate)}">${formatPercent(desk.ledger.returnRate)}</strong></div>
  <div><span>组合超额</span><strong class="${tone(desk.ledger.excessReturn)}">${formatPercent(desk.ledger.excessReturn)}</strong></div>
  <div><span>现金比例</span><strong>${formatPercent(desk.ledger.cashRate, false)}</strong></div>
</section>`;

const renderRegression = () => {
  const selected =
    desk.strategies.find((strategy) => strategy.id === contentRoute.id) ||
    desk.strategies.find((strategy) => strategy.account) ||
    null;
  if (!selected) return '<section class="regression-view"><div class="empty-state">暂无可回归的策略账本。</div></section>';
  const snapshot = createRegressionSnapshot(desk, selected);
  return `<section class="regression-view" aria-label="策略回归体检">
    <div class="regression-head"><div><strong>策略回归体检</strong><span>固定账本快照 · 不伪造时间序列指标</span></div><div class="regression-total"><span>总盘收益</span><strong class="${tone(snapshot.totalReturn)}">${formatPercent(snapshot.totalReturn)}</strong></div></div>
    <div class="regression-layout">
      <div class="regression-strategies"><div class="regression-list-head">选择策略</div>${desk.strategies
        .map(
          (strategy) =>
            `<button type="button" data-regression-id="${escapeHtml(strategy.id)}" class="${strategy.id === selected.id ? "active" : ""}"><span>${stageBadge(strategy.stage)}<strong>${escapeHtml(strategy.name)}</strong></span><b class="${tone(strategy.account?.returnRate ?? null)}">${formatPercent(strategy.account?.returnRate ?? null)}</b></button>`,
        )
        .join("")}</div>
      <div class="regression-result">
        <div class="regression-title"><div><p class="eyebrow">${escapeHtml(selected.family)}</p><h2>${escapeHtml(selected.name)}</h2></div>${stageBadge(selected.stage)}</div>
        <div class="regression-metrics">
          ${fact("策略收益", formatPercent(snapshot.strategyReturn), tone(snapshot.strategyReturn))}
          ${fact("总盘收益", formatPercent(snapshot.totalReturn), tone(snapshot.totalReturn))}
          ${fact("收益贡献", formatPercent(snapshot.contribution), tone(snapshot.contribution))}
          ${fact("剔除后总盘", formatPercent(snapshot.returnWithoutStrategy), tone(snapshot.returnWithoutStrategy))}
        </div>
        <div class="regression-contribution"><div><span>名义本金占比</span><strong>${formatPercent(snapshot.capitalWeight, false)}</strong></div><div><i style="width:${Math.max(0, Math.min(100, (snapshot.capitalWeight || 0) * 100))}%"></i></div></div>
        <dl class="regression-notes"><div><dt>策略虚拟盈亏</dt><dd class="${tone(selected.account?.pnl ?? null)}">${selected.account ? money.format(selected.account.pnl) : "--"}</dd></div><div><dt>其余策略本金</dt><dd>${money.format(snapshot.remainderCapital)}</dd></div><div><dt>其余策略净值</dt><dd>${money.format(snapshot.remainderNav)}</dd></div><div><dt>口径</dt><dd>收益贡献 = 单策略虚拟盈亏 / 总名义本金；剔除后总盘按其余策略账本重算。</dd></div></dl>
      </div>
    </div>
  </section>`;
};

const renderHelp =
  () => `<div class="modal-backdrop" id="helpModal" aria-hidden="false"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
  <div class="modal-head"><div><div id="helpTitle" class="modal-title">帮助与设置</div><div class="modal-subtitle">Kelly Invest Stock · 策略实验台</div></div><button class="icon-button" type="button" data-close-help aria-label="关闭帮助">关闭</button></div>
  <nav class="modal-tabs" aria-label="帮助与设置标签"><button class="${helpTab === "guide" ? "active" : ""}" type="button" data-help-tab="guide">规则</button><button class="${helpTab === "resources" ? "active" : ""}" type="button" data-help-tab="resources">资源</button><button class="${helpTab === "connection" ? "active" : ""}" type="button" data-help-tab="connection">连接</button></nav>
  <div class="modal-body">
    <section class="help-tab-panel ${helpTab === "guide" ? "active" : ""}"><h2>策略阶段规则</h2><dl class="settings-list"><div><dt>L1 基础观察</dt><dd>每个新策略默认进入 L1，并拥有独立虚拟账本。</dd></div><div><dt>L2 进阶观察</dt><dd>由人手工标记整套策略，继续使用同一个虚拟账本。</dd></div><div><dt>L3 高置信观察</dt><dd>由人手工标记高成熟度策略；仍是虚拟研究标签，不接富途或真实交易 API。</dd></div><div><dt>回归</dt><dd>用当前账本快照查看单策略收益贡献与剔除后的总盘收益；没有历史净值序列时不计算 Sharpe、Alpha 或 R²。</dd></div></dl></section>
    <section class="help-tab-panel ${helpTab === "resources" ? "active" : ""}"><h2>Busabase 资源</h2><dl class="settings-list"><div><dt>应用根节点</dt><dd><code>${escapeHtml(appConfig.folder.slug)}</code></dd></div><div><dt>结构化数据</dt><dd>${appConfig.bases.map((base) => escapeHtml(base.name)).join("、")}</dd></div><div><dt>秘密数据</dt><dd>无 Vault 要求；本地 OAuth 凭证不进入业务 Base。</dd></div></dl></section>
    <section class="help-tab-panel ${helpTab === "connection" ? "active" : ""}"><h2>连接状态</h2><dl class="settings-list"><div><dt>数据提供方</dt><dd>${currentState.provider.name === "demo" ? "固定只读演示" : "Busabase SDK"}</dd></div><div><dt>Space</dt><dd>${currentState.provider.name === "demo" ? "演示中未连接" : "由当前 AirApp 会话确定"}</dd></div><div><dt>资源版本</dt><dd>Schema v${appConfig.schemaVersion}</dd></div><div><dt>运行边界</dt><dd>本地与 AirApp 使用同一份 Hono 应用源码。</dd></div></dl></section>
  </div>
</section></div>`;

const renderApp = () => {
  const items = itemsForView(contentRoute.view);
  const selected = contentRoute.id ? desk.strategies.find((item) => item.id === contentRoute.id) || null : null;
  const regressionView = contentRoute.view === "regression";
  const strategyDetail = Boolean(selected) && !regressionView;
  const meta = viewMeta[contentRoute.view];
  const workspaceTitle = strategyDetail ? "策略详情" : meta.label;
  const mainContent = regressionView
    ? `${renderSummaryStrip()}${renderRegression()}`
    : strategyDetail
    ? `<section class="strategy-detail-view detail-panel">${renderStrategyDetail(selected)}</section>`
    : `${contentRoute.view === "strategies" ? "" : renderFunnel()}${renderSummaryStrip()}${
        items.length
          ? renderStrategyTable(items, contentRoute.view === "strategies" ? "策略与虚拟账本" : meta.label)
          : '<section class="strategy-overview"><div class="empty-state">当前阶段没有策略。</div></section>'
      }`;
  root.innerHTML = `<div class="app-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}">${renderSidebar()}<main class="main strategy-main ${strategyDetail ? "strategy-detail-mode" : ""}">
    <div class="mobile-topbar"><button class="mobile-sidebar-toggle" type="button" data-mobile-sidebar aria-controls="appSidebar" aria-label="打开侧栏"><span class="sidebar-toggle-icon" aria-hidden="true"></span></button><div class="mobile-topbar-copy"><div class="mobile-view-title">${workspaceTitle}</div><div class="mobile-view-meta">${strategyDetail ? escapeHtml(selected.name) : `${items.length} ${meta.noun}`}</div></div><button class="mobile-help-button" type="button" data-open-help aria-label="帮助与设置">帮助</button></div>
    <header class="workspace-head"><div><p class="eyebrow">${meta.eyebrow}</p><h1>${workspaceTitle}</h1></div><div class="workspace-status">${currentState.provider.name === "demo" ? '<span class="snapshot-badge">DEMO</span>' : '<span class="status-dot"></span>'}<span>${escapeHtml(currentState.provider.asOf || "Busabase 当前数据")}</span><span class="read-only">虚拟模式</span><button type="button" data-refresh>刷新</button></div></header>
    ${mainContent}
  </main></div><div id="sidebarScrim" class="sidebar-scrim" hidden></div>${parseHash().view === "settings" ? renderHelp() : ""}<div class="toast" role="status" aria-live="polite" hidden></div>`;
  bindEvents();
};

const renderSetup = (error) => {
  const raw = String(error?.message || error || "SETUP_REQUIRED");
  const [code] = raw.split(":", 1);
  const reason = raw.replace(/^[A-Z_]+:\s*/, "");
  const pending = code === "SETUP_PENDING";
  const retryOnly = ["SETUP_PENDING", "SCHEMA_INCOMPLETE"].includes(code);
  const canProvision = code === "SETUP_REQUIRED";
  const title = pending ? "等待工作区审批" : canProvision ? "初始化 Busabase 工作区" : "工作区暂未就绪";
  const resources = appConfig.bases.map((base) => base.name).join("、");
  const body = canProvision
    ? `<p>将在当前 Space 的应用 Folder 下创建 ${escapeHtml(resources)} 三个 Base。</p><p class="detail-note">结构通过一个 Busabase ChangeRequest 幂等提交；旧版资源不会被删除或继续读取。</p>`
    : `<p>${escapeHtml(reason)}</p><p class="detail-note">应用不会要求你手工创建 Node/Base 或复制 ID，也不会切换到本地数据。</p>`;
  const selectedSpace = authStatus?.space ? `${authStatus.space.name} (${authStatus.space.id})` : "当前 AirApp Space";
  root.innerHTML = `<div class="setup-shell"><section class="setup-modal" role="dialog" aria-labelledby="setupTitle"><div class="setup-head"><div class="brand-icon" aria-hidden="true">KS</div><div><p class="eyebrow">WORKSPACE SETUP</p><h1 id="setupTitle">${title}</h1></div></div><div class="setup-body"><p><strong>${escapeHtml(authStatus?.baseUrl || "Busabase")}</strong> 鉴权已就绪。</p><p>目标 Space：<strong>${escapeHtml(selectedSpace)}</strong></p>${body}<div class="setup-notice" data-setup-status hidden></div></div><div class="setup-footer setup-footer-split">${canProvision ? '<button class="connect-button" type="button" data-provision>初始化工作区</button>' : retryOnly ? '<button class="connect-button" type="button" data-retry-setup>重新检查</button>' : ""}<a class="text-link" href="?demo=1#/strategies">进入只读 Demo</a></div></section></div>`;
  root.querySelector("[data-retry-setup]")?.addEventListener("click", load);
  root.querySelector("[data-provision]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const status = root.querySelector("[data-setup-status]");
    button.disabled = true;
    status.hidden = false;
    status.textContent = "正在提交工作区结构...";
    try {
      const provider = await getProvider();
      await provider.provisionResources();
      await load();
    } catch (provisionError) {
      renderSetup(provisionError);
    }
  });
};

const renderSpaceSetup = (status) => {
  const options = (status.spaces || [])
    .map(
      (space) => `<option value="${escapeHtml(space.id)}">${escapeHtml(space.name)} · ${escapeHtml(space.id)}</option>`,
    )
    .join("");
  root.innerHTML = `<div class="setup-shell"><section class="setup-modal setup-connect" aria-labelledby="setupTitle"><div class="setup-head"><div class="brand-icon" aria-hidden="true">KS</div><div><p class="eyebrow">KELLY INVEST STOCK</p><h1 id="setupTitle">选择 Busabase Space</h1></div></div><form class="setup-body connection-form" data-space-form><p><strong>${escapeHtml(status.baseUrl)}</strong> 鉴权已完成。选择数据与工作区要初始化到哪里。</p><label class="space-select"><span>Space</span><select name="space_id" required>${options}</select></label><div class="setup-error" data-space-error hidden></div><button class="connect-button" type="submit">使用此 Space</button></form><div class="setup-footer setup-footer-split"><span class="setup-security">确认后才会检查或初始化应用资源</span><a class="text-link" href="?demo=1#/strategies">进入只读 Demo</a></div></section></div>`;
  root.querySelector("[data-space-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const error = form.querySelector("[data-space-error]");
    button.disabled = true;
    error.hidden = true;
    const response = await fetch("/auth/space", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(new FormData(form)),
    });
    const result = await response.json();
    if (!response.ok) {
      error.textContent = result.error || "无法选择 Space。";
      error.hidden = false;
      button.disabled = false;
      return;
    }
    authStatus = { ...status, requiresSpace: false, space: result.space };
    await load();
  });
};

const renderConnectSetup = (status = {}) => {
  const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
  root.innerHTML = `<div class="setup-shell"><section class="setup-modal setup-connect" aria-labelledby="setupTitle"><div class="setup-head"><div class="brand-icon" aria-hidden="true">KS</div><div><p class="eyebrow">KELLY INVEST STOCK</p><h1 id="setupTitle">连接 Busabase</h1></div></div><form class="setup-body connection-form" method="post" action="/auth/start">${oauthError ? `<div class="setup-error" role="alert">${escapeHtml(oauthError)}</div>` : ""}${status.expired ? '<div class="setup-notice">登录已过期，请重新连接。</div>' : ""}<fieldset class="connection-options"><legend>服务器</legend><label class="connection-option active"><input type="radio" name="server_mode" value="cloud" checked /><span><strong>Busabase Cloud</strong><small>busabase.com</small></span></label><label class="connection-option"><input type="radio" name="server_mode" value="custom" /><span><strong>自定义服务器</strong><small>自托管或企业地址</small></span></label></fieldset><label class="custom-url" hidden><span>Busabase URL</span><input type="url" name="custom_base_url" inputmode="url" placeholder="https://busabase.example.com" autocomplete="url" /></label><input type="hidden" name="base_url" value="${escapeHtml(status.cloudBaseUrl || "https://busabase.com")}" /><button class="connect-button" type="submit">连接 Busabase</button></form><div class="setup-footer setup-footer-split"><span class="setup-security">OAuth 凭证仅保存在本机 ~/.busabase/airapps</span><a class="text-link" href="?demo=1#/strategies">进入只读 Demo</a></div></section></div>`;
  const form = root.querySelector(".connection-form");
  const hiddenBaseUrl = form?.querySelector('input[name="base_url"]');
  const customWrap = form?.querySelector(".custom-url");
  const customInput = form?.querySelector('input[name="custom_base_url"]');
  form?.querySelectorAll('input[name="server_mode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const custom = radio.checked && radio.value === "custom";
      form
        .querySelectorAll(".connection-option")
        .forEach((option) => option.classList.toggle("active", option.querySelector("input")?.checked));
      customWrap.hidden = !custom;
      customInput.required = custom;
      hiddenBaseUrl.value = custom ? customInput.value : status.cloudBaseUrl || "https://busabase.com";
      if (custom) customInput.focus();
    });
  });
  customInput?.addEventListener("input", () => {
    hiddenBaseUrl.value = customInput.value;
  });
};

const bindEvents = () => {
  root.querySelectorAll("[data-view]").forEach((button) =>
    button.addEventListener("click", () => {
      setMobileSidebarOpen(false);
      setMobileDetailOpen(false);
      navigate({ view: button.dataset.view, id: null });
    }),
  );
  root.querySelectorAll("[data-select-id]").forEach((button) =>
    button.addEventListener("click", () => {
      if (isMobileLayout()) setMobileDetailOpen(true);
      navigate({ view: contentRoute.view, id: button.dataset.selectId });
    }),
  );
  root.querySelectorAll(".strategy-table-row[data-select-id]").forEach((row) =>
    row.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      row.click();
    }),
  );
  root.querySelectorAll("[data-regression-id]").forEach((button) =>
    button.addEventListener("click", () => {
      navigate({ view: "regression", id: button.dataset.regressionId });
    }),
  );
  root.querySelectorAll("[data-stage-value]").forEach((button) =>
    button.addEventListener("click", async () => {
      const strategy = desk.strategies.find((item) => item.id === contentRoute.id);
      const stage = button.dataset.stageValue;
      if (!strategy || strategy.stage === stage) return;
      root.querySelectorAll("[data-stage-value]").forEach((control) => {
        control.disabled = true;
      });
      try {
        const result = await activeProvider.updateStrategyStage(strategy.id, stage);
        if (!result.persisted) {
          showToast(`已提交 ${stage} 标记，等待 Busabase 审批。`);
          return;
        }
        await load();
        showToast(result.transient ? `已标记为 ${stage}，仅当前 Demo 会话有效。` : `已标记为 ${stage}。`);
      } catch (error) {
        showToast(`标记失败：${String(error?.message || error)}`);
        root.querySelectorAll("[data-stage-value]").forEach((control) => {
          control.disabled = false;
        });
      }
    }),
  );
  root.querySelector("[data-sidebar-toggle]")?.addEventListener("click", () => {
    if (isMobileLayout()) setMobileSidebarOpen(false);
    else {
      sidebarCollapsed = !sidebarCollapsed;
      renderApp();
    }
  });
  root.querySelector("[data-mobile-sidebar]")?.addEventListener("click", () => setMobileSidebarOpen(true));
  root.querySelector("#sidebarScrim")?.addEventListener("click", () => setMobileSidebarOpen(false));
  root.querySelector("[data-back-to-list]")?.addEventListener("click", () => {
    setMobileDetailOpen(false);
    navigate({ view: contentRoute.view, id: null }, { replace: true });
  });
  root.querySelectorAll("[data-open-help]").forEach((button) =>
    button.addEventListener("click", () => {
      lastContentHash = routeHash(contentRoute);
      window.location.hash = "#/settings/guide";
    }),
  );
  root.querySelector("[data-close-help]")?.addEventListener("click", () => {
    window.location.hash = lastContentHash;
  });
  root.querySelector("#helpModal")?.addEventListener("click", (event) => {
    if (event.target.id === "helpModal") window.location.hash = lastContentHash;
  });
  root.querySelectorAll("[data-help-tab]").forEach((button) =>
    button.addEventListener("click", () => {
      window.location.hash = `#/settings/${button.dataset.helpTab}`;
    }),
  );
  root.querySelector("[data-refresh]")?.addEventListener("click", async () => {
    if (currentState.provider.name === "demo") showToast("演示数据为 2026-08-05 固定快照。");
    else await load();
  });
};

const applyRoute = () => {
  const route = parseHash();
  if (route.view === "settings") helpTab = route.tab;
  else {
    contentRoute = route;
    lastContentHash = routeHash(route);
    if (isMobileLayout()) setMobileDetailOpen(Boolean(route.id) && route.view !== "regression");
  }
  if (currentState) renderApp();
};

const load = async () => {
  root.innerHTML = '<div class="boot-state">正在读取策略实验台...</div>';
  try {
    const demo = new URLSearchParams(window.location.search).get("demo") === "1";
    const loopbackHost =
      ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) ||
      window.location.hostname.endsWith(".localhost");
    const busabaseHosted = window.self !== window.top || window.location.pathname.startsWith("/api/airapp-preview/");
    const standaloneLocalRuntime = loopbackHost && !busabaseHosted;
    if (!demo && standaloneLocalRuntime) {
      authStatus = await fetch("/auth/status", { headers: { accept: "application/json" } }).then((response) =>
        response.json(),
      );
      if (!authStatus.connected) {
        renderConnectSetup(authStatus);
        return;
      }
      if (authStatus.requiresSpace) {
        renderSpaceSetup(authStatus);
        return;
      }
    }
    activeProvider = await getProvider();
    currentState = await activeProvider.getState();
    desk = createStrategyDesk(currentState.records);
    if (!window.location.hash) window.history.replaceState(null, "", "#/strategies");
    applyRoute();
  } catch (error) {
    if (String(error?.message || error).startsWith("SETUP_")) console.info("Busabase workspace setup is not complete");
    else console.error("Provider failed", error);
    renderSetup(error);
  }
};

window.addEventListener("hashchange", applyRoute);
window.addEventListener("resize", () => {
  if (!isMobileLayout()) {
    setMobileSidebarOpen(false);
    setMobileDetailOpen(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && parseHash().view === "settings") window.location.hash = lastContentHash;
  if (event.key === "Escape") setMobileSidebarOpen(false);
});

load();
