# Kelly Insure Data UI Schema

This schema powers the local UI for insurance data entry and governance.

## Snapshot

`app/.data/insure_snapshot.json`:

```json
{
  "schema_version": "1",
  "generated_at": "ISO timestamp",
  "source": "local|busabase",
  "drive": {
    "node_id": "Busabase Drive node id",
    "name": "文件盘",
    "slug": "optional slug",
    "metadata": {},
    "metadata_fields": [{ "key": "owner", "value": "Kelly" }]
  },
  "bases": {
    "qa": {
      "base_id": "bse_...",
      "name": "问答",
      "slug": "insurance-qa",
      "fields": [{ "key": "question", "value": "Question (text)" }]
    },
    "news": {
      "base_id": "bse_...",
      "name": "新闻资讯",
      "slug": "insurance-news",
      "fields": [{ "key": "title", "value": "Title (text)" }]
    },
    "feedback": {
      "base_id": "bse_...",
      "name": "用户反馈",
      "slug": "user-feedback",
      "fields": [{ "key": "content", "value": "反馈内容 (longtext)" }]
    },
    "prompts": {
      "base_id": "bse_...",
      "name": "预置提示词",
      "slug": "insurance-prompts",
      "fields": [{ "key": "title", "value": "短标题 (text)" }]
    }
  },
  "metrics": {
    "file_count": 0,
    "metadata_field_count": 0,
    "qa_count": 0,
    "news_count": 0,
    "feedback_count": 0,
    "total_records": 0,
    "data_quality_score": 0,
    "needs_governance": 0
  },
  "files": [],
  "qa_pairs": [],
  "news_items": [],
  "feedback_items": [],
  "warnings": []
}
```

## File Item

Required:

- `id`
- `name`
- `path`
- `size`
- `mime_type`
- `updated_at`
- `metadata`
- `governance.completeness_pct`
- `governance.missing_fields`
- `governance.status`

The file item corresponds to a file under one Busabase Drive node. `metadata` should carry insurance governance fields such as `policy_type`, `carrier`, `region`, `effective_date`, `status`, `tags`, and source/ownership fields when available.

## QA Pair

Required:

- `id`
- `question`
- `answer`
- `category`
- `source`
- `tags`
- `updated_at`
- `status`
- `fields`
- `governance`

The QA pair corresponds to one record in the configured QA Base.

## News Item

Required:

- `id`
- `title`
- `summary`
- `url`
- `source`
- `published_at`
- `category`
- `tags`
- `status`
- `fields`
- `governance`

The news item corresponds to one record in the configured news Base.

## Feedback Item

Required:

- `id`
- `title`
- `content`
- `source`
- `user_name`
- `contact`
- `rating`
- `category`
- `tags`
- `created_at`
- `status`
- `fields`
- `governance`

The feedback item corresponds to one record in the configured user feedback Base. It should preserve the user-visible feedback text, source context, status, and any contact/rating fields that are safe to store.

## Preset Prompt Item

The preset prompt Base (`insurance-prompts`, 预置提示词) holds the prompts the
insure miniapp offers on its home screen. It is a **canonical Base in the same
folder as the other ones**, so an agent rebuilding this workspace must create it.

Canonical fields:

| Field slug | Type | Required | Meaning |
| --- | --- | --- | --- |
| `title` | text | yes | Short home-row label. Keep to 14 characters or fewer, or the miniapp row overflows. |
| `prompt` | longtext | yes | Full question inserted into the composer. Never equal to `title`. |
| `category` | text | no | One of `查资料` / `答异议` / `做计划书`. These are the three home slots; a row with any other value is not shown. |
| `expected_result` | longtext | no | What a good answer should contain. Reference material for AI retrieval — never rendered to the end user. |
| `status` | text | no | `active` shows the row. Any other non-empty value hides it. |

Consumer contract: the miniapp reads this Base read-only through the insure
knowledge proxy and rotates one prompt per category per day. Prompt content is
insurance sales copy, so it must avoid guarantees, absolute claims, and promised
outcomes.

This Base is **not yet surfaced in the skill UI or the snapshot** — there is no
`prompt_items` array, and `scripts/export_busabase_snapshot.ts` resolves Bases by
configured slug, so a restore manifest currently omits it. Wiring the provider,
snapshot, and export is separate work.

## Governance

Every record-like item should carry:

```json
{
  "governance": {
    "completeness_pct": 100,
    "missing_fields": [],
    "status": "active"
  }
}
```

Use `missing_fields` to drive UI attention. Use `status` values such as `active`, `draft`, `review`, `needs_metadata`, `needs_review`, or a source-specific status string.
