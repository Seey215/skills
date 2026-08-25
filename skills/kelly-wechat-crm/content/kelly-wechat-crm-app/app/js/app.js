import { createAirAppConnectGate } from "../vendor/busabase-airapp-gate.js";
import { appConfig } from "./config.js";
import { messages } from "./messages.js";
import { getProvider } from "./providers/index.js";
import { connectionHintKey, getRuntime, runtimeLabel } from "./runtime.js";

const state = {
  provider: null,
  payload: null,
  runtime: null,
  activeBase: appConfig.ui.primaryBase,
  selectedRecordId: null,
  query: "",
  authStatus: null,
  wechatStatus: null,
  settingsTab: "guide",
  notice: "",
  candidateResults: [],
  selectedCandidates: new Set(),
};

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const recordLabel = (id) => {
  const record = (state.payload?.records || []).find((item) => item.id === id);
  if (!record) return id;
  const base = appConfig.bases.find((item) => item.key === record.baseKey);
  return record.fields?.[base?.fields?.[0]?.slug] || id;
};

const displayValue = (value) => {
  if (value == null || value === "") return "-";
  if (Array.isArray(value))
    return value.map((item) => (typeof item === "string" ? recordLabel(item) : displayValue(item))).join(", ");
  if (typeof value === "object") return value.name || value.title || value.id || JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const baseConfig = () => appConfig.bases.find((base) => base.key === state.activeBase) || appConfig.bases[0];
const recordsForBase = () => (state.payload?.records || []).filter((record) => record.baseKey === baseConfig()?.key);
const pageInfoForBase = () => state.payload?.pageInfo?.[baseConfig()?.key] || {};
const loadedCount = (count, hasMore) => `${count}${hasMore ? "+" : ""}`;
const primaryField = () => baseConfig()?.fields?.[0]?.slug || "name";
const filteredRecords = () => {
  const query = state.query.trim().toLowerCase();
  return query
    ? recordsForBase().filter((record) => JSON.stringify(record.fields).toLowerCase().includes(query))
    : recordsForBase();
};
const activeGoals = () =>
  (state.payload?.records || []).filter((record) => record.baseKey === "goals" && record.fields?.status === "active");

const setMobileSidebar = (open) => {
  document.body.classList.toggle("sidebar-open", open);
  byId("sidebarScrim").hidden = !open;
};
const setMobileDetail = (open) => document.body.classList.toggle("mobile-detail-open", open);
const setText = (id, value) => {
  const element = byId(id);
  if (element) element.textContent = value;
};

function renderNavigation() {
  const icons = {
    people: "重",
    "relationship-snapshots": "析",
    goals: "标",
    actions: "行",
    worklog: "志",
    settings: "设",
  };
  const navigationOrder = appConfig.ui.navigationOrder || appConfig.bases.map((base) => base.key);
  byId("baseNav").innerHTML = [...appConfig.bases]
    .sort((left, right) => navigationOrder.indexOf(left.key) - navigationOrder.indexOf(right.key))
    .map(
      (base) => `
    <button class="nav-item ${base.key === state.activeBase ? "active" : ""}" type="button" data-base="${escapeHtml(base.key)}">
      <span class="nav-icon" aria-hidden="true">${icons[base.key] || "·"}</span>
      <span class="nav-label">${escapeHtml(base.name)}</span>
      <span class="nav-count">${loadedCount((state.payload?.records || []).filter((record) => record.baseKey === base.key).length, state.payload?.pageInfo?.[base.key]?.nextCursor)}</span>
    </button>
  `,
    )
    .join("");
}

function renderMetrics() {
  const pending = (state.payload?.records || []).filter(
    (record) => record.baseKey === "actions" && record.fields?.status === "needs-review",
  ).length;
  const metrics = [
    [
      messages.totalRecords,
      loadedCount(
        state.payload?.records?.length || 0,
        Object.values(state.payload?.pageInfo || {}).some((page) => page.nextCursor),
      ),
    ],
    [messages.bases, state.payload?.bases?.length || 0],
    [messages.pending, pending],
  ];
  byId("metrics").innerHTML = metrics
    .map(
      ([label, value]) => `
    <div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `,
    )
    .join("");
  setText("attentionValue", pending);
  setText("attentionCopy", pending ? messages.attentionPending : messages.attentionEmpty);
}

const wechatStatusCopy = (status) => {
  if (!status || status.state === "checking") {
    return { title: "正在检测 WeChat CLI", summary: "检查安装、初始化和本机数据读取状态。" };
  }
  if (status.ready) {
    return {
      title: `WeChat CLI ${status.version || ""} 已连接`.trim(),
      summary: `已读取 ${status.contactsCount} 位联系人；最近会话可正常读取。`,
    };
  }
  if (status.state === "missing") {
    return { title: "尚未安装 WeChat CLI", summary: "从官网安装后返回这里重新检测。" };
  }
  if (status.state === "not_initialized") {
    return { title: "WeChat CLI 尚未初始化", summary: "微信保持登录，在终端完成本机初始化后重新检测。" };
  }
  if (status.state === "timed_out") {
    return { title: "WeChat CLI 检测超时", summary: "确认微信正在运行，再重新检测。" };
  }
  if (status.state === "unavailable") {
    return { title: "WeChat CLI 检测服务不可用", summary: "确认本地应用仍在运行，再重新检测。" };
  }
  return { title: "WeChat CLI 无法读取数据", summary: "检查微信登录和本机数据库权限后重新检测。" };
};

function renderWechatStatus() {
  const status = state.wechatStatus;
  const ready = Boolean(status?.ready) || isDemo();
  const copy = wechatStatusCopy(status);
  byId("wechatConnector").hidden = isDemo() || !status;
  byId("wechatConnector").classList.toggle("is-ready", ready);
  byId("wechatConnector").classList.toggle("is-blocking", Boolean(status) && !ready);
  setText("wechatStatusTitle", copy.title);
  setText("wechatStatusSummary", copy.summary);
  byId("wechatInitCommand").hidden = status?.state !== "not_initialized";
  byId("wechatInstallLink").hidden = status?.state !== "missing";
  byId("wechatRecheck").disabled = status?.state === "checking";
  byId("metrics").hidden = !ready;
  byId("contentSplit").hidden = !ready;
}

async function readWechatStatus() {
  const response = await fetch("__wechat/status", { headers: { accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error("WECHAT_STATUS_UNAVAILABLE");
  return response.json();
}

function renderList() {
  const base = baseConfig();
  const records = filteredRecords();
  setText("listTitle", base?.name || messages.records);
  setText("recordCount", loadedCount(records.length, pageInfoForBase().nextCursor));
  setText("mobileTitle", base?.name || appConfig.appName);
  byId("loadMore").hidden = !pageInfoForBase().nextCursor || Boolean(state.query);
  byId("goalOpen").hidden = base?.key !== "goals";
  byId("discoverOpen").hidden = base?.key !== "people" || !activeGoals().length;
  setText("loadMore", messages.loadMore);
  if (!records.length) {
    if (state.query) {
      byId("recordList").innerHTML = `<div class="empty-list">${escapeHtml(messages.noMatches)}</div>`;
    } else if (base?.key === "goals") {
      byId("recordList").innerHTML = `
        <div class="empty-workflow">
          <strong>先创建一个目标</strong>
          <p>目标决定 Agent 应该寻找谁、读取多大范围，以及哪些边界不能越过。</p>
          <button class="primary-action" type="button" data-empty-action="new-goal">创建目标</button>
        </div>`;
    } else if (base?.key === "people") {
      byId("recordList").innerHTML = `
        <div class="empty-workflow">
          <strong>${activeGoals().length ? "还没有重点联系人" : "需要先创建目标"}</strong>
          <p>${activeGoals().length ? "从本机通讯录搜索候选人，只有你勾选的人才会进入 People。" : "联系人晋升必须服务于一个明确目标。"}</p>
          <button class="primary-action" type="button" data-empty-action="${activeGoals().length ? "discover" : "new-goal"}">${activeGoals().length ? "选择联系人" : "创建目标"}</button>
        </div>`;
    } else {
      byId("recordList").innerHTML = `<div class="empty-list">${escapeHtml(messages.noRecords)}</div>`;
    }
    return;
  }
  const secondaryFields = (base?.fields || []).slice(1, 4);
  byId("recordList").innerHTML = records
    .map(
      (record) => `
    <button class="record-row ${record.id === state.selectedRecordId ? "selected" : ""}" type="button" data-record="${escapeHtml(record.id)}">
      <strong>${escapeHtml(displayValue(record.fields?.[primaryField()]))}</strong>
      <span>${secondaryFields.map((field) => escapeHtml(displayValue(record.fields?.[field.slug]))).join(" / ")}</span>
    </button>
  `,
    )
    .join("");
}

function renderDetail() {
  const record = recordsForBase().find((item) => item.id === state.selectedRecordId);
  byId("detailEmpty").hidden = Boolean(record);
  byId("detailContent").hidden = !record;
  if (!record) {
    setText("detailEmpty", messages.selectRecord);
    return;
  }
  const base = baseConfig();
  setText("detailEyebrow", base?.name || messages.record);
  setText("detailTitle", displayValue(record.fields?.[primaryField()]));
  byId("detailFields").innerHTML = (base?.fields || [])
    .slice(1)
    .map(
      (field) => `
    <div class="field-row"><span>${escapeHtml(field.name)}</span><strong>${escapeHtml(displayValue(record.fields?.[field.slug]))}</strong></div>
  `,
    )
    .join("");
  const actions = byId("detailActions");
  actions.hidden = base?.key !== "actions";
  if (base?.key === "actions") {
    actions.innerHTML = `
      <div class="action-notice" role="status">${escapeHtml(state.notice)}</div>
      <label class="review-note"><span>${escapeHtml(messages.reviewNote)}</span><textarea id="reviewNote" rows="3" placeholder="${escapeHtml(messages.reviewNotePlaceholder)}">${escapeHtml(record.fields?.["decision-comment"] || "")}</textarea></label>
      <div class="decision-buttons">
        <button class="primary-action" type="button" data-action-status="approved">${escapeHtml(messages.approveAction)}</button>
        <button type="button" data-action-status="changes-requested">${escapeHtml(messages.requestChanges)}</button>
        <button type="button" data-action-status="snoozed">${escapeHtml(messages.snooze)}</button>
        <button type="button" data-action-status="done">${escapeHtml(messages.markDone)}</button>
      </div>`;
  }
}

function renderSettings() {
  const provider = state.payload?.provider || {};
  const recordBudgets = appConfig.bases.map((base) => `${base.name}: ${base.readLimit}`).join("; ");
  if (state.settingsTab === "guide") {
    byId("settingsGrid").innerHTML = `
      <section class="settings-guide">
        <h3>工作边界</h3>
        <p>本应用先要求一个明确目标，再从本机通讯录晋升少量重点联系人。完整通讯录和原始聊天记录留在本机，应用不会代发消息或修改微信备注。</p>
        <h3>处理方式</h3>
        <p>目标、联系人晋升和人工决定由用户在界面中明确提交后直接保存到本应用的 Busabase Bases；Agent 建议本身不会自动写入或执行。</p>
      </section>`;
    return;
  }
  const rows = [
    [messages.provider, provider.name || state.provider?.name || messages.notSet],
    [messages.mode, provider.mode || messages.notSet],
    [messages.runtime, state.runtime ? runtimeLabel(state.runtime) : messages.notSet],
    [messages.deployment, appConfig.deployment],
    [
      messages.space,
      state.authStatus?.selectedSpace
        ? `${state.authStatus.selectedSpace.name} (${state.authStatus.selectedSpace.id})`
        : appConfig.spaceId || messages.notSet,
    ],
    [messages.folder, state.payload?.resources?.folder?.nodeId || appConfig.folder.slug],
    [messages.configuredBases, appConfig.bases.map((base) => base.slug).join(", ")],
    [messages.initialWindow, recordBudgets],
    [messages.schemaVersion, appConfig.schemaVersion],
    [
      "WeChat CLI",
      state.wechatStatus?.ready
        ? `ready (${state.wechatStatus.version})`
        : state.wechatStatus?.state || messages.notSet,
    ],
    [
      "本机微信",
      state.wechatStatus?.ready ? `${state.wechatStatus.contactsCount} contacts; sessions readable` : messages.notSet,
    ],
  ];
  byId("settingsGrid").innerHTML = rows
    .map(
      ([label, value]) => `
    <div class="settings-row"><span>${escapeHtml(label)}</span><code>${escapeHtml(value)}</code></div>
  `,
    )
    .join("");
}

// Connection UX Contract gate — `busabase-sdk/airapp-gate`, configured. The
// three screens (connect / choose a Space / initialize the workspace), the
// state machine behind them, and their stylesheet all live in the SDK; only
// this app's name and demo escape hatch are its own. `shouldGate` is passed
// explicitly rather than letting the SDK infer it from a status probe: where
// this app runs is a fact its host states (`BUSABASE_AIRAPP_RUNTIME`,
// surfaced through runtime.js's `getRuntime()`), never something to guess
// from the hostname — see runtime.js for why both directions of that guess
// are wrong.
const isDemo = () => new URLSearchParams(window.location.search).get("demo") === "1";

const gate = createAirAppConnectGate({
  appName: appConfig.appName,
  demoHref: "?demo=1",
  shouldGate: () => !isDemo() && !state.runtime?.hosted,
  onProvision: () => {
    return getProvider().then((provider) => provider.provisionResources());
  },
});

function render() {
  document.documentElement.lang = appConfig.locale;
  document.documentElement.style.setProperty("--accent", appConfig.brand?.accent || "#176B5B");
  document.title = appConfig.appName;
  setText("brandName", appConfig.appName);
  setText("brandDescription", appConfig.description);
  setText("viewEyebrow", messages.overview);
  setText("viewTitle", appConfig.appName);
  setText("viewSummary", appConfig.ui.summary);
  setText("attentionTitle", messages.attentionTitle);
  setText("listEyebrow", messages.records);
  setText("searchLabel", messages.search);
  byId("searchInput").placeholder = messages.searchPlaceholder;
  setText("settingsOpen", messages.settings);
  setText("settingsEyebrow", messages.settingsEyebrow);
  setText("settingsTitle", messages.settingsTitle);
  setText("backButton", messages.back);
  renderNavigation();
  renderMetrics();
  renderWechatStatus();
  renderList();
  renderDetail();
  renderSettings();
}

async function load() {
  setText("loadingState", messages.loading);
  byId("errorState").hidden = true;
  // Resolved before the first data call so a failure can be explained in terms
  // of where this app actually runs. It must never gate the call itself: the
  // runtime decides what to TELL the user, the API decides what is possible.
  state.runtime = await getRuntime();
  try {
    const ready = await gate.pass({ onReady: load });
    if (!ready) {
      setText("loadingState", "");
      return;
    }
    state.authStatus = state.runtime.hosted ? null : await gate.status();
    state.wechatStatus = isDemo()
      ? { ready: true, state: "demo", version: "demo", contactsCount: 0, sessionsReadable: true }
      : { ready: false, state: "checking" };
    render();
    if (!isDemo()) {
      try {
        state.wechatStatus = await readWechatStatus();
      } catch {
        state.wechatStatus = { ready: false, state: "unavailable" };
      }
    }
    if (!state.wechatStatus.ready) {
      setText("loadingState", "");
      render();
      return;
    }
    state.provider = await getProvider();
    state.payload = await state.provider.getState();
    if (!activeGoals().length) {
      state.activeBase = "goals";
      state.selectedRecordId = null;
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/goals`);
    }
    setText("loadingState", "");
    render();
    if (window.location.hash === "#/goals/new") setGoalModal(true);
  } catch (error) {
    if (String(error?.message || error).startsWith("SETUP_")) {
      gate.renderSetupRequired(error, load);
      return;
    }
    setText("loadingState", "");
    byId("errorState").hidden = false;
    const reason = error instanceof Error ? error.message : String(error);
    setText("errorState", `${reason} ${messages[connectionHintKey(state.runtime)]}`);
  }
}

async function submitActionDecision(status) {
  const record = recordsForBase().find((item) => item.id === state.selectedRecordId);
  if (!record || state.activeBase !== "actions") return;
  const comment = byId("reviewNote")?.value.trim() || "";
  const buttons = [...byId("detailActions").querySelectorAll("button")];
  buttons.forEach((button) => {
    button.disabled = true;
  });
  state.notice = messages.submittingDecision;
  renderDetail();
  try {
    const fields = {
      status,
      "decision-comment": comment,
      "decided-at": new Date().toISOString(),
      "decided-by": "operator",
    };
    const result = await state.provider.updateRecord({
      baseKey: "actions",
      recordId: record.id,
      headCommitId: record.headCommitId,
      fields,
      message: `Review relationship action ${record.fields?.title || record.id}: ${status}`,
    });
    if (state.provider.name === "demo") Object.assign(record.fields, fields);
    else state.payload = await state.provider.getState();
    state.notice = result?.id ? `${messages.saved} ${result.id}` : messages.decisionRecorded;
  } catch (error) {
    state.notice = `${messages.decisionFailed} ${error instanceof Error ? error.message : error}`;
  }
  render();
}

function goalTargets(scope) {
  const baseKey = scope === "person" ? "people" : "";
  if (!baseKey) return [];
  const base = appConfig.bases.find((item) => item.key === baseKey);
  return (state.payload?.records || [])
    .filter((record) => record.baseKey === baseKey)
    .map((record) => ({ id: record.id, label: record.fields?.[base.fields[0].slug] || record.id }));
}

function updateGoalTarget() {
  const scope = byId("goalScope").value;
  const targets = goalTargets(scope);
  byId("goalTargetWrap").hidden = !targets.length;
  byId("goalTarget").innerHTML = targets
    .map((target) => `<option value="${escapeHtml(target.id)}">${escapeHtml(target.label)}</option>`)
    .join("");
}

function setGoalModal(open) {
  byId("goalModal").hidden = !open;
  if (open) {
    setText("goalFormStatus", "");
    updateGoalTarget();
    byId("goalForm").querySelector('input[name="title"]').focus();
  }
}

function closeGoalModal() {
  setGoalModal(false);
  if (window.location.hash === "#/goals/new") window.location.hash = "#/goals";
}

async function submitGoal(event) {
  event.preventDefault();
  const form = new FormData(byId("goalForm"));
  const title = String(form.get("title") || "").trim();
  const objective = String(form.get("objective") || "").trim();
  if (!title || !objective) return;
  const scope = String(form.get("scope") || "global");
  const target = String(form.get("target") || "");
  const deadline = String(form.get("deadline") || "");
  const fields = {
    title,
    objective,
    scope,
    "success-metric": String(form.get("success_metric") || "").trim(),
    ...(deadline ? { deadline: `${deadline}T00:00:00.000Z` } : {}),
    priority: String(form.get("priority") || "medium"),
    status: String(form.get("status") || "active"),
    constraints: String(form.get("constraints") || "").trim(),
    "created-at": new Date().toISOString(),
    ...(scope === "person" && target ? { people: [target] } : {}),
  };
  const submit = byId("goalForm").querySelector('button[type="submit"]');
  submit.disabled = true;
  setText("goalFormStatus", messages.submittingGoal);
  try {
    const result = await state.provider.createRecord({
      baseKey: "goals",
      fields,
      message: `Create relationship goal: ${title}`,
      idempotencyKey: `goal:${title}:${deadline || "open"}`,
    });
    if (state.provider.name === "demo") {
      const id = result.id;
      state.payload.records.push({ id, headCommitId: `demo-head-${id}`, baseKey: "goals", fields });
      state.activeBase = "people";
      state.selectedRecordId = id;
      byId("goalForm").reset();
      setGoalModal(false);
      window.location.hash = "#/people";
      render();
    } else {
      state.payload = await state.provider.getState();
      state.activeBase = "people";
      state.selectedRecordId = null;
      byId("goalForm").reset();
      setGoalModal(false);
      window.location.hash = "#/people";
      state.notice = result?.id ? `${messages.goalSaved} ${result.id}` : messages.goalSaved;
      render();
    }
  } catch (error) {
    setText("goalFormStatus", `${messages.goalFailed} ${error instanceof Error ? error.message : error}`);
  } finally {
    submit.disabled = false;
  }
}

const demoCandidates = [
  { username: "wxid_demo_lina", displayName: "Lina", remark: "餐饮品牌顾问" },
  { username: "wxid_demo_zhou", displayName: "周凯", remark: "连锁餐饮运营" },
];

function setCandidateModal(open) {
  byId("candidateModal").hidden = !open;
  if (!open) return;
  const goals = activeGoals();
  if (!goals.length) {
    setCandidateModal(false);
    window.location.hash = "#/goals/new";
    setGoalModal(true);
    return;
  }
  byId("candidateGoal").innerHTML = goals
    .map((goal) => `<option value="${escapeHtml(goal.id)}">${escapeHtml(goal.fields?.title || goal.id)}</option>`)
    .join("");
  state.candidateResults = [];
  state.selectedCandidates.clear();
  byId("candidateResults").innerHTML = "<p>搜索结果只在本页临时显示，不会自动写入 Busabase。</p>";
  setText("candidateStatus", "");
  byId("candidatePromote").disabled = true;
  byId("candidateQuery").focus();
}

function renderCandidates() {
  const tracked = new Set(
    (state.payload?.records || [])
      .filter((record) => record.baseKey === "people")
      .map((record) => record.fields?.username),
  );
  const candidates = state.candidateResults.filter((candidate) => !tracked.has(candidate.username));
  if (!candidates.length) {
    byId("candidateResults").innerHTML = "<p>没有找到尚未加入的联系人。</p>";
    byId("candidatePromote").disabled = true;
    return;
  }
  byId("candidateResults").innerHTML = candidates
    .map(
      (candidate) => `
        <label class="candidate-row">
          <input type="checkbox" value="${escapeHtml(candidate.username)}">
          <span><strong>${escapeHtml(candidate.displayName)}</strong><small>${escapeHtml(candidate.remark || candidate.username)}</small></span>
        </label>`,
    )
    .join("");
  byId("candidatePromote").disabled = true;
}

async function searchCandidates(event) {
  event.preventDefault();
  const query = byId("candidateQuery").value.trim();
  if (!query) return;
  setText("candidateStatus", "正在搜索本机通讯录…");
  try {
    if (isDemo()) {
      state.candidateResults = demoCandidates.filter((candidate) =>
        `${candidate.displayName} ${candidate.remark} ${candidate.username}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      );
    } else {
      const response = await fetch(`__wechat/contacts?q=${encodeURIComponent(query)}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("CONTACT_SEARCH_FAILED");
      state.candidateResults = (await response.json()).results || [];
    }
    state.selectedCandidates.clear();
    renderCandidates();
    setText("candidateStatus", `找到 ${state.candidateResults.length} 位匹配联系人。`);
  } catch {
    state.candidateResults = [];
    renderCandidates();
    setText("candidateStatus", "本机通讯录搜索失败，请检查 WeChat CLI 后重试。");
  }
}

async function promoteCandidates() {
  const selected = state.candidateResults.filter((candidate) => state.selectedCandidates.has(candidate.username));
  const goal = activeGoals().find((item) => item.id === byId("candidateGoal").value);
  if (!selected.length || !goal) return;
  const button = byId("candidatePromote");
  button.disabled = true;
  setText("candidateStatus", `正在加入 ${selected.length} 位重点联系人…`);
  try {
    const created = await Promise.all(
      selected.map((candidate) =>
        state.provider.createRecord({
          baseKey: "people",
          fields: {
            "display-name": candidate.displayName,
            username: candidate.username,
            "wechat-remark": candidate.remark,
            "current-goal-summary": goal.fields?.title || "",
            "last-synced-at": new Date().toISOString(),
          },
          message: `Add focused WeChat contact: ${candidate.displayName}`,
          idempotencyKey: `focused-person:${candidate.username}`,
        }),
      ),
    );
    if (state.provider.name === "demo") {
      for (const [index, candidate] of selected.entries()) {
        const id = created[index]?.id || `demo-people-${candidate.username}`;
        state.payload.records.push({
          id,
          headCommitId: `demo-head-${id}`,
          baseKey: "people",
          fields: {
            "display-name": candidate.displayName,
            username: candidate.username,
            "wechat-remark": candidate.remark,
            "current-goal-summary": goal.fields?.title || "",
            "last-synced-at": new Date().toISOString(),
          },
        });
      }
    } else {
      state.payload = await state.provider.getState();
    }
    setCandidateModal(false);
    state.activeBase = "people";
    window.location.hash = "#/people";
    render();
  } catch (error) {
    setText("candidateStatus", `加入失败：${error instanceof Error ? error.message : error}`);
    button.disabled = false;
  }
}

async function loadMore() {
  const baseKey = baseConfig()?.key;
  const cursor = pageInfoForBase().nextCursor;
  if (!baseKey || !cursor || typeof state.provider?.loadMore !== "function") return;
  byId("loadMore").disabled = true;
  setText("loadMore", messages.loadingMore);
  try {
    const page = await state.provider.loadMore(baseKey, cursor);
    const known = new Set((state.payload.records || []).map((record) => record.id));
    state.payload.records.push(...page.records.filter((record) => !known.has(record.id)));
    state.payload.pageInfo[baseKey].nextCursor = page.nextCursor;
    render();
  } catch {
    setText("loadMore", messages.loadMoreFailed);
  } finally {
    byId("loadMore").disabled = false;
  }
}

byId("baseNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-base]");
  if (!button) return;
  state.activeBase = button.dataset.base;
  state.selectedRecordId = null;
  state.query = "";
  byId("searchInput").value = "";
  window.location.hash = `#/${state.activeBase}`;
  setMobileSidebar(false);
  setMobileDetail(false);
  render();
});

byId("recordList").addEventListener("click", (event) => {
  const emptyAction = event.target.closest("[data-empty-action]");
  if (emptyAction) {
    if (emptyAction.dataset.emptyAction === "discover") setCandidateModal(true);
    else {
      window.location.hash = "#/goals/new";
      setGoalModal(true);
    }
    return;
  }
  const button = event.target.closest("[data-record]");
  if (!button) return;
  state.selectedRecordId = button.dataset.record;
  window.location.hash = `#/${state.activeBase}/${state.selectedRecordId}`;
  setMobileDetail(true);
  renderList();
  renderDetail();
});

byId("searchInput").addEventListener("input", (event) => {
  state.query = event.target.value;
  renderList();
});
byId("loadMore").addEventListener("click", loadMore);
byId("wechatRecheck").addEventListener("click", load);
byId("discoverOpen").addEventListener("click", () => setCandidateModal(true));
byId("candidateClose").addEventListener("click", () => setCandidateModal(false));
byId("candidateSearchForm").addEventListener("submit", searchCandidates);
byId("candidateResults").addEventListener("change", (event) => {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  if (checkbox.checked) state.selectedCandidates.add(checkbox.value);
  else state.selectedCandidates.delete(checkbox.value);
  byId("candidatePromote").disabled = state.selectedCandidates.size === 0;
  setText("candidateStatus", `已选择 ${state.selectedCandidates.size} 位联系人。`);
});
byId("candidatePromote").addEventListener("click", promoteCandidates);
byId("candidateModal").addEventListener("click", (event) => {
  if (event.target === byId("candidateModal")) setCandidateModal(false);
});
byId("detailPanel").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action-status]");
  if (button) submitActionDecision(button.dataset.actionStatus);
});
byId("goalOpen").addEventListener("click", () => {
  window.location.hash = "#/goals/new";
  setGoalModal(true);
});
byId("goalScope").addEventListener("change", updateGoalTarget);
byId("goalForm").addEventListener("submit", submitGoal);
byId("goalClose").addEventListener("click", closeGoalModal);
byId("goalCancel").addEventListener("click", closeGoalModal);
byId("goalModal").addEventListener("click", (event) => {
  if (event.target === byId("goalModal")) closeGoalModal();
});
byId("sidebarOpen").addEventListener("click", () => setMobileSidebar(true));
byId("sidebarClose").addEventListener("click", () => {
  if (window.matchMedia("(max-width: 720px)").matches) setMobileSidebar(false);
  else document.body.classList.toggle("sidebar-collapsed");
});
byId("sidebarScrim").addEventListener("click", () => setMobileSidebar(false));
byId("backButton").addEventListener("click", () => {
  state.selectedRecordId = null;
  window.location.hash = `#/${state.activeBase}`;
  setMobileDetail(false);
  renderList();
  renderDetail();
});

const setSettings = (open) => {
  byId("settingsModal").hidden = !open;
  if (open) renderSettings();
};
const openSettings = () => {
  window.location.hash = "#/settings";
  setSettings(true);
};
const closeSettings = () => {
  setSettings(false);
  window.location.hash = `#/${state.activeBase}${state.selectedRecordId ? `/${state.selectedRecordId}` : ""}`;
};
byId("settingsOpen").addEventListener("click", openSettings);
byId("mobileSettings").addEventListener("click", openSettings);
byId("settingsClose").addEventListener("click", closeSettings);
byId("settingsModal").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-settings-tab]");
  if (tab) {
    state.settingsTab = tab.dataset.settingsTab;
    byId("settingsModal")
      .querySelectorAll("[data-settings-tab]")
      .forEach((button) => {
        const active = button === tab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
    renderSettings();
  }
});
byId("settingsModal").addEventListener("click", (event) => {
  if (event.target === byId("settingsModal")) closeSettings();
});
function applyHashRoute() {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "settings") {
    setSettings(true);
    return;
  }
  if (parts[0] === "goals" && parts[1] === "new") {
    state.activeBase = "goals";
    state.selectedRecordId = null;
    if (state.payload) {
      render();
      setGoalModal(true);
    }
    return;
  }
  const key = parts[0] === "base" ? parts[1] : parts[0];
  const id = parts[0] === "base" ? parts[2] : parts[1];
  if (appConfig.bases.some((base) => base.key === key)) state.activeBase = key;
  state.selectedRecordId = id || null;
  setSettings(false);
  setGoalModal(false);
  setMobileDetail(Boolean(id));
  if (state.payload) render();
}
window.addEventListener("hashchange", applyHashRoute);
window.addEventListener("resize", () => {
  if (!window.matchMedia("(max-width: 720px)").matches) {
    setMobileSidebar(false);
    setMobileDetail(false);
  }
});

applyHashRoute();
load();
