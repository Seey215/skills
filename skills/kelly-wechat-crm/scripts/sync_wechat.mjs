#!/usr/bin/env node
// Trusted local process. This is the ONLY thing in this skill allowed to touch the
// user's local WeChat data — it shells out to the `wechat-cli-rs` binary (free,
// read-only commands only: `contacts` and `sessions`) and upserts the result into
// Busabase. The AirApp itself never runs wechat-cli-rs and never could: that binary
// only works on the operator's own machine, against WeChat logged in on that machine.
//
// It never sends a WeChat message and never mutates WeChat data — wechat-cli-rs has
// no send/write capability at all, by design (see https://wechat-cli.com).
//
// Connects with the trusted process's own credentials (BUSABASE_BASE_URL,
// BUSABASE_API_KEY, BUSABASE_SPACE_ID), never the AirApp's ambient session.
import { execFileSync } from "node:child_process";
import { createBusabaseClient, getRecordByField } from "busabase-sdk";
import { appConfig } from "../content/kelly-wechat-crm-app/app/js/config.js";

const WECHAT_BIN = process.env.WECHAT_CLI_BIN || "wechat-cli-rs";
const DEFAULT_STALE_DAYS = 7;

function help() {
  console.log(`Usage: node scripts/sync_wechat.mjs [--apply]

Reads contacts and recent-session activity from the local WeChat install via
wechat-cli-rs (free commands only: \`contacts\`, \`sessions\`), upserts them into
the Busabase "contacts" Base, and flags stale conversations into the
"followups" review queue. Without --apply this is a dry run that only prints
what would change. Never sends a message; wechat-cli-rs cannot send one.

Install wechat-cli-rs first if it isn't on PATH:
  curl -fsSL https://wechat-cli.com/install.sh | sh
`);
}

function runWechatCli(args) {
  try {
    const out = execFileSync(WECHAT_BIN, [...args, "--format", "json"], {
      encoding: "utf8",
    });
    return JSON.parse(out);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `"${WECHAT_BIN}" isn't on PATH. Install it: curl -fsSL https://wechat-cli.com/install.sh | sh`,
      );
    }
    const stderr = (err.stderr || "").toString().trim();
    if (err.status === 1 && /请先运行.*init/.test(stderr)) {
      throw new Error(
        `wechat-cli-rs isn't initialized on this machine yet. Ask the operator to run: sudo ${WECHAT_BIN} init`,
      );
    }
    throw new Error(`${WECHAT_BIN} ${args.join(" ")} failed (exit ${err.status}): ${stderr || err.message}`);
  }
}

const isGroup = (username) => username.includes("@chatroom");
const daysSince = (isoDate) => {
  if (!isoDate) return Infinity;
  return (Date.now() - new Date(isoDate).getTime()) / 86_400_000;
};

function baseIdFor(key) {
  const base = appConfig.schema.bases.find((entry) => entry.key === key);
  if (!base?.baseId) throw new Error(`Base "${key}" has no materialized baseId in config.js`);
  return base.baseId;
}

async function listAll(client, baseId) {
  const records = [];
  let cursor;
  do {
    const page = await client.records.list({ baseId, limit: 100, ...(cursor ? { cursor } : {}) });
    records.push(...(page.records || (Array.isArray(page) ? page : [])));
    cursor = page.nextCursor;
  } while (cursor);
  return records;
}

function fieldValue(record, slug) {
  return record?.headCommit?.payload?.[slug] ?? record?.headCommit?.fields?.[slug] ?? record?.fields?.[slug];
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has("--help") || args.has("-h")) return help();
  const apply = args.has("--apply");

  const baseUrl = process.env.BUSABASE_BASE_URL;
  if (!baseUrl) throw new Error("BUSABASE_BASE_URL is required");
  const client = createBusabaseClient({
    baseUrl,
    ...(process.env.BUSABASE_API_KEY ? { apiKey: process.env.BUSABASE_API_KEY } : {}),
    ...(process.env.BUSABASE_SPACE_ID ? { spaceId: process.env.BUSABASE_SPACE_ID } : {}),
  });

  const contactsBaseId = baseIdFor("contacts");
  const followupsBaseId = baseIdFor("followups");
  const settingsBaseId = baseIdFor("settings");

  console.log(`Reading local WeChat data via ${WECHAT_BIN}...`);
  const contacts = runWechatCli(["contacts"]);
  const sessions = runWechatCli(["sessions", "--limit", "200"]);
  const sessionByUsername = new Map(sessions.map((session) => [session.username, session]));
  console.log(`  ${contacts.length} contacts, ${sessions.length} recent sessions`);

  const settingsRows = await listAll(client, settingsBaseId);
  const rulesRow = settingsRows.find((record) => fieldValue(record, "kind") === "followup-rules");
  const staleThresholdDays = Number(fieldValue(rulesRow, "stale-threshold-days")) || DEFAULT_STALE_DAYS;

  const openFollowups = (await listAll(client, followupsBaseId)).filter((record) =>
    ["needs-review", "snoozed"].includes(fieldValue(record, "status")),
  );
  const contactHasOpenFollowup = (contactRecordId) =>
    openFollowups.some((record) => {
      const contactRef = fieldValue(record, "contact");
      const refId = Array.isArray(contactRef) ? contactRef[0]?.id ?? contactRef[0] : contactRef?.id ?? contactRef;
      return refId === contactRecordId;
    });

  const nowIso = new Date().toISOString();
  let created = 0;
  let updated = 0;
  const flaggedForFollowup = [];

  for (const contact of contacts) {
    const session = sessionByUsername.get(contact.username);
    const syncedFields = {
      "display-name": contact.nick_name || contact.username,
      remark: contact.remark || "",
      kind: isGroup(contact.username) ? "group" : "person",
      ...(session
        ? {
            "last-message-at": new Date(session.timestamp * 1000).toISOString(),
            "last-message-summary": session.last_message,
            "unread-count": session.unread,
          }
        : {}),
      "last-synced-at": nowIso,
    };

    const existing = await getRecordByField(client, {
      baseId: contactsBaseId,
      fieldSlug: "username",
      valueText: contact.username,
    });

    let recordId;
    let tag;
    let followUpStatus;

    if (existing) {
      updated += 1;
      if (apply) {
        await client.records.changeRequest({
          recordId: existing.id,
          operation: "update",
          fields: syncedFields,
          message: `wechat sync: refresh ${syncedFields["display-name"]}`,
          autoMerge: true,
        });
      }
      recordId = existing.id;
      tag = fieldValue(existing, "tag");
      followUpStatus = fieldValue(existing, "follow-up-status");
    } else {
      created += 1;
      tag = "";
      followUpStatus = "none";
      if (apply) {
        const result = await client.bases.createBulkChangeRequest({
          baseId: contactsBaseId,
          records: [{ username: contact.username, "follow-up-status": "none", ...syncedFields }],
          message: `wechat sync: new contact ${syncedFields["display-name"]}`,
          autoMerge: true,
        });
        recordId = result.mergeSummary?.recordIds?.[0] ?? null;
      }
    }

    // Eligibility never depends on having a real recordId yet — a dry run must be able to
    // preview a follow-up candidate for a contact that would be newly created this run.
    // Only the actual write (further down) needs a real recordId, and only under --apply.
    if (
      !isGroup(contact.username) &&
      tag !== "muted" &&
      followUpStatus !== "needs-followup" &&
      followUpStatus !== "snoozed" &&
      followUpStatus !== "done" &&
      !(recordId && contactHasOpenFollowup(recordId))
    ) {
      const lastMessageAt = session ? new Date(session.timestamp * 1000).toISOString() : null;
      const silentDays = Math.floor(daysSince(lastMessageAt));
      const isVip = tag === "vip";
      const effectiveThreshold = isVip ? Math.max(1, Math.floor(staleThresholdDays / 2)) : staleThresholdDays;
      if (silentDays >= effectiveThreshold) {
        flaggedForFollowup.push({
          contactRecordId: recordId ?? null,
          displayName: syncedFields["display-name"],
          isVip,
          silentDays: Number.isFinite(silentDays) ? silentDays : null,
        });
      }
    }
  }

  console.log(`Contacts: ${created} to create, ${updated} to update${apply ? "" : " (dry run, nothing written)"}`);
  console.log(`Follow-up candidates: ${flaggedForFollowup.length}`);
  for (const candidate of flaggedForFollowup) {
    const reason = candidate.isVip ? "vip-no-contact" : "stale-conversation";
    const suggestedNote = candidate.isVip
      ? "好久没聊了，最近怎么样？"
      : "在的话，最近忙吗？";
    const silentLabel = candidate.silentDays === null ? "从未联系" : `${candidate.silentDays} 天未联系`;
    console.log(`  - ${candidate.displayName}: ${silentLabel}`);
    if (apply && candidate.contactRecordId) {
      await client.bases.createBulkChangeRequest({
        baseId: followupsBaseId,
        records: [
          {
            summary: `${candidate.displayName}：${silentLabel}`,
            contact: candidate.contactRecordId,
            reason,
            "days-silent": candidate.silentDays,
            "suggested-note": suggestedNote,
            status: "needs-review",
          },
        ],
        message: `wechat sync: flag ${candidate.displayName} for follow-up`,
        autoMerge: true,
      });
      await client.records.changeRequest({
        recordId: candidate.contactRecordId,
        operation: "update",
        fields: { "follow-up-status": "needs-followup" },
        message: `wechat sync: mark ${candidate.displayName} needing follow-up`,
        autoMerge: true,
      });
    }
  }

  if (apply) {
    const syncStateRow = settingsRows.find((record) => fieldValue(record, "kind") === "sync-state");
    const syncStateFields = { "last-sync-at": nowIso, "last-sync-contact-count": contacts.length };
    if (syncStateRow) {
      await client.records.changeRequest({
        recordId: syncStateRow.id,
        operation: "update",
        fields: syncStateFields,
        message: "wechat sync: update sync state",
        autoMerge: true,
      });
    } else {
      await client.bases.createBulkChangeRequest({
        baseId: settingsBaseId,
        records: [{ kind: "sync-state", ...syncStateFields }],
        message: "wechat sync: create sync state",
        autoMerge: true,
      });
    }
  }

  console.log(apply ? "Done." : "Dry run complete — pass --apply to write these changes to Busabase.");
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
});
