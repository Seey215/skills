---
name: kelly-wechat-crm
description: Busabase-backed App-in-Skill for a personal WeChat relationship desk — syncs contacts and recent activity from the operator's own machine via wechat-cli-rs (https://wechat-cli.com), flags stale conversations into a reviewable follow-up queue, and lets the operator tag/annotate contacts. Use when the user invokes $kelly-wechat-crm or /kelly-wechat-crm, mentions WeChat CRM, 微信关系管理, tracking WeChat contacts, flagging who to follow up with on WeChat, or wants to review WeChat-sourced follow-up suggestions. Never sends a WeChat message and never modifies WeChat data — wechat-cli-rs is read-only by design, so this skill has no send capability at all, only local read + Busabase annotation.
metadata:
  category: sales-crm
  tags:
    - risk:gated-write
    - surface:busabase
  busabase:
    template: true
    folderSlug: kelly-wechat-crm
    resources:
      - contacts
      - followups
      - settings
    risk: gated-write
---

# Kelly WeChat CRM

## Overview

A personal, single-operator relationship desk over the operator's own WeChat contacts.
Data originates from **wechat-cli-rs** (https://wechat-cli.com, SKILL.md at
https://wechat-cli.com/SKILL.md) — a free, read-only, local-first CLI that queries the
operator's own WeChat installation on their own machine. This skill's only job is to
turn that local signal (who exists, who's gone quiet) into a Busabase-backed desk with
tags, notes, and a reviewable follow-up queue.

**This is not a general CRM.** It doesn't track companies or deals, and it never sends
a message: wechat-cli-rs literally has no send/write capability against WeChat, by
product design, so there is nothing here for an "approved send" step to hand off to.
The only writes are Busabase annotations the operator makes themselves (a tag, a note,
marking a follow-up done because they reached out through WeChat directly).

## Mandatory Dependencies

1. Read and follow `$kelly-app-skill-creator` for product behavior, visual quality,
   responsive layout, and the complete canonical `content/kelly-wechat-crm-app/` artifact.
2. Read and follow `$busabase` for connection, target Space, node discovery,
   ChangeRequests, review, and merge behavior.
3. Read and follow `$busabase-app-creator` for resource modeling, AirApp runtime limits,
   security, validation, and deployment.
4. Read `docs/skills/wechat-me/SKILL.md` from the `wechat-cli-rs` project, or fetch it
   live from https://wechat-cli.com/SKILL.md, for the exact `wechat-cli-rs` command
   surface, JSON output shapes, and exit codes this skill's sync script depends on.

If a dependency is unavailable, preserve this skill's local artifact and product
contracts, stop before the unavailable operation, and report the exact missing
dependency. Do not invent a second data backend, and do not reimplement WeChat data
extraction here — that belongs entirely to wechat-cli-rs.

## Boundary

- The only thing in this skill that touches WeChat data is `scripts/sync_wechat.mjs`,
  a **trusted local process** that shells out to the `wechat-cli-rs` binary on the
  operator's own machine. It calls exactly two commands — `contacts` and `sessions`,
  both free and read-only — and never `init`, `history`, `search`, `export`, or anything
  that reads full message content or writes local WeChat state.
- The AirApp itself never runs wechat-cli-rs and structurally cannot: that binary only
  works against a WeChat client logged in on the same machine it runs on. The AirApp
  only reads/reviews what the sync script already wrote to Busabase.
- No component in this skill ever sends a WeChat message, adds/removes a contact, or
  modifies any WeChat data. There is no "approved send" step anywhere in this skill,
  unlike `kelly-crm`/`kelly-email` — wechat-cli-rs has no send capability to hand off to.
- Treat all contact data as sensitive personal information belonging to the operator.
  Never commit real contact names, wxids, or message summaries.

## Busabase Resources

Three Bases under one Folder (`kelly-wechat-crm`):

- `contacts`: `display-name`, `username` (wxid, stable sync key), `remark`, `kind`
  (`person`/`group`, derived from whether the wxid contains `@chatroom`), `tag`
  (`vip`/`watch`/`normal`/`muted` — **operator-owned, the sync script never sets or
  clears this**), `relationship-note` (**operator-owned**), `last-message-at`,
  `last-message-summary`, `unread-count` (all three **sync-owned**, refreshed every
  run), `follow-up-status` (`none`/`needs-followup`/`snoozed`/`done` — sync sets
  `needs-followup` when it opens a new followup; every other transition is a human
  decision), `last-synced-at`.
- `followups`: the review queue — `summary`, `contact` (relation to `contacts`),
  `reason` (`stale-conversation`/`manual-flag`/`vip-no-contact`), `days-silent`,
  `suggested-note` (a plain templated conversation opener, not an AI draft — there is
  no send action for it to feed), `status`
  (`needs-review`/`snoozed`/`done`/`dismissed`), `decision-comment`, `decided-at`,
  `decided-by`.
- `settings`: one row per `kind` — `followup-rules` (`stale-threshold-days`, default 7;
  a contact tagged `vip` uses half that threshold), `sync-state` (`last-sync-at`,
  `last-sync-contact-count`), `agent-lock`.

Resources provision lazily through an idempotent Busabase ChangeRequest the first time
the app runs in a Space; see `blueprint.json` for the exact field shapes and
`content/kelly-wechat-crm-app/app/js/config.js` for the materialized ids once created.

## Sync Workflow

`scripts/sync_wechat.mjs` is the entire Research+Plan stage. Run it on the operator's
own machine (the same one WeChat is logged into):

```bash
cd kelly-wechat-crm
npm install                     # once, installs busabase-sdk for this script
BUSABASE_BASE_URL=<url> BUSABASE_SPACE_ID=<space-id> [BUSABASE_API_KEY=<key>] \
  node scripts/sync_wechat.mjs            # dry run — prints what would change
  node scripts/sync_wechat.mjs --apply    # writes the changes to Busabase
```

1. Calls `wechat-cli-rs contacts` and `wechat-cli-rs sessions --limit 200` (installs
   wechat-cli-rs itself if it's missing — see the Install section of
   https://wechat-cli.com/SKILL.md — and reports plainly if WeChat hasn't been
   `init`-ed yet rather than guessing).
2. Upserts every contact by `username`: sync-owned fields are refreshed, operator-owned
   fields (`tag`, `relationship-note`, and any follow-up-status the operator has already
   set to something other than the sync's own default) are never touched.
3. For each `person` contact (never a `group`) that isn't `muted`, doesn't already have
   an open followup, and whose `follow-up-status` isn't already
   `needs-followup`/`snoozed`/`done`: if it's been silent at least
   `stale-threshold-days` (half that if tagged `vip`), open a `needs-review` followup
   with a plain templated note and flip the contact to `needs-followup`.
4. Updates the `sync-state` settings row with the run's timestamp and contact count.

Idempotent by design: re-running without new WeChat activity creates nothing new and
updates only the refreshed activity fields — verified by running it twice in a row
against the same data and confirming record counts don't change.

## Review Workflow

A followup stays `needs-review` until the operator (a human, not this skill) decides
what to do — after actually reaching out via WeChat themselves, or after deciding not
to. Recording that decision (`done`/`dismissed`/`snoozed` plus a comment) is a
Busabase write like any other CRM annotation; the generated AirApp's current shell is
read/browse-only (list, detail, search, pending-change-request count) — it does not
yet have a dedicated decision UI the way `kelly-crm`'s does. Record a decision directly
through `busabase-sdk`/`busabase-cli` (`records update-change-request`) or through
Busabase's own generic Base view until a dedicated Follow-ups screen is built as a
follow-up to this skill.

## Demo Mode

`?demo=1` opens the scaffold's deterministic, read-only mock data for documentation and
screenshots. It never reads or writes Busabase and never claims a real connection.

## Completion Criteria

Finish only when:

- the skill contains the complete canonical `content/kelly-wechat-crm-app/` project and
  `node server.js` remains supported for local preview;
- `scripts/sync_wechat.mjs` upserts contacts and opens followups using only
  wechat-cli-rs's free, read-only commands, never touches operator-owned fields, and is
  idempotent on repeated runs;
- all persistent state (tags, notes, follow-up decisions, sync state) lives in Busabase
  through `busabase-sdk` — no local JSON, browser storage, or second data provider;
- Vault values and API credentials never reach browser-visible surfaces;
- `npm --prefix content/kelly-wechat-crm-app run check` passes.

## Known Gaps (v1)

- The AirApp UI is the generic scaffolded list/detail/search shell, not a custom
  Overview/Contacts/Follow-ups experience with inline decision actions the way
  `kelly-crm` has. Recording a followup decision currently requires a direct Busabase
  write (see Review Workflow) rather than a button in the app.
- `scripts/sync_wechat.mjs` has been verified end-to-end against a local Busabase
  instance and a `wechat-cli-rs` test fixture, not yet against a real personal WeChat
  account.

## Stop Conditions

Stop before consequential Busabase mutation when the target Space is ambiguous, the
current user lacks permission, or a same-slug resource is not application-owned. Never
call any wechat-cli-rs command other than `contacts` and `sessions` from an automated
sync, and never invoke `wechat-cli-rs init` automatically — that's an explicit,
user-approved action only (per https://wechat-cli.com/SKILL.md's own Agent Workflow).
