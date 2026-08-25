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
  settingsTab: "guide",
  notice: "",
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
    people: "人",
    groups: "群",
    "relationship-snapshots": "析",
    goals: "标",
    actions: "行",
    worklog: "志",
    settings: "设",
  };
  byId("baseNav").innerHTML = appConfig.bases
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

function renderList() {
  const base = baseConfig();
  const records = filteredRecords();
  setText("listTitle", base?.name || messages.records);
  setText("recordCount", loadedCount(records.length, pageInfoForBase().nextCursor));
  setText("mobileTitle", base?.name || appConfig.appName);
  byId("loadMore").hidden = !pageInfoForBase().nextCursor || Boolean(state.query);
  byId("goalOpen").hidden = base?.key !== "goals";
  setText("loadMore", messages.loadMore);
  if (!records.length) {
    byId("recordList").innerHTML =
      `<div class="empty-list">${escapeHtml(state.query ? messages.noMatches : messages.noRecords)}</div>`;
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
        <p>本应用把微信中的人和群整理成目标、关系快照、下一步行动与 Agent 工作日志。微信数据由本机只读工具分析，应用不会代发消息或修改微信备注。</p>
        <h3>处理方式</h3>
        <p>先在目标视图设置想实现的结果；Agent 再按需读取本机微信证据并提出行动。所有目标和决定在真实环境只提交 Busabase ChangeRequest。</p>
      </section>`;
    return;
  }
  const rows = [
    [messages.provider, provider.name || state.provider.name],
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
    state.provider = await getProvider();
    state.payload = await state.provider.getState();
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
    state.notice = result?.id ? `${messages.changeRequestCreated} ${result.id}` : messages.decisionRecorded;
  } catch (error) {
    state.notice = `${messages.decisionFailed} ${error instanceof Error ? error.message : error}`;
  }
  render();
}

function goalTargets(scope) {
  const baseKey = scope === "person" ? "people" : scope === "group" ? "groups" : "";
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
    ...(scope === "group" && target ? { groups: [target] } : {}),
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
      state.activeBase = "goals";
      state.selectedRecordId = id;
      byId("goalForm").reset();
      setGoalModal(false);
      window.location.hash = `#/goals/${id}`;
      render();
    } else {
      setText("goalFormStatus", `${messages.goalChangeRequestCreated} ${result.id}`);
    }
  } catch (error) {
    setText("goalFormStatus", `${messages.goalFailed} ${error instanceof Error ? error.message : error}`);
  } finally {
    submit.disabled = false;
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
