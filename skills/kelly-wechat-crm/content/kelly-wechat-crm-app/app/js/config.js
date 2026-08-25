export const appConfig = {
  "appName": "微信关系管理",
  "appSlug": "kelly-wechat-crm",
  "description": "个人微信关系管理台：从本机微信同步联系人和近期活跃度，标注关系与备注，把该跟进的联系人排进可审核的跟进队列——只读微信数据，从不代发消息。",
  "locale": "zh",
  "deployment": "desktop",
  "spaceId": "local",
  "readOnly": false,
  "onboarding": {
    "version": 1,
    "required_fields": [
      {
        "key": "stale-threshold-days",
        "resource": "settings",
        "validation": "positive integer, defaults to 7",
        "unlocks": [
          "follow-up flagging in the sync task"
        ]
      }
    ],
    "completion_resource": "settings",
    "rationale": "Only one tunable threshold; shipped pre-seeded via seed_records so onboarding completes on first sync without a setup wizard."
  },
  "brand": {
    "mode": "inferred",
    "accent": "#07C160",
    "logo_path": ""
  },
  "schema": {
    "folder": {
      "name": "微信关系管理",
      "slug": "kelly-wechat-crm",
      "nodeId": "nodmt8fp0yjcw9s6yk"
    },
    "bases": [
      {
        "key": "contacts",
        "name": "联系人",
        "slug": "contacts",
        "nodeId": "nodmt8fpbg4mx3mffa",
        "baseId": "bsemt8fpbg4gejagat",
        "readLimit": 50,
        "description": "从本机微信同步的联系人/群聊，附加关系标签、备注和跟进状态。",
        "fields": [
          {
            "slug": "display-name",
            "name": "昵称",
            "type": "text",
            "required": true
          },
          {
            "slug": "username",
            "name": "微信 ID (wxid)",
            "type": "text",
            "required": true
          },
          {
            "slug": "remark",
            "name": "备注",
            "type": "text",
            "required": false
          },
          {
            "slug": "kind",
            "name": "类型",
            "type": "select",
            "required": true,
            "options": {
              "choices": [
                {
                  "id": "person",
                  "name": "个人"
                },
                {
                  "id": "group",
                  "name": "群聊"
                }
              ]
            }
          },
          {
            "slug": "tag",
            "name": "关系标签",
            "type": "select",
            "required": false,
            "options": {
              "choices": [
                {
                  "id": "vip",
                  "name": "重要"
                },
                {
                  "id": "watch",
                  "name": "关注"
                },
                {
                  "id": "normal",
                  "name": "普通"
                },
                {
                  "id": "muted",
                  "name": "免打扰"
                }
              ]
            }
          },
          {
            "slug": "relationship-note",
            "name": "关系备注",
            "type": "text",
            "required": false
          },
          {
            "slug": "last-message-at",
            "name": "最近消息时间",
            "type": "date",
            "required": false
          },
          {
            "slug": "last-message-summary",
            "name": "最近消息摘要",
            "type": "text",
            "required": false
          },
          {
            "slug": "unread-count",
            "name": "未读数",
            "type": "number",
            "required": false
          },
          {
            "slug": "follow-up-status",
            "name": "跟进状态",
            "type": "select",
            "required": true,
            "options": {
              "choices": [
                {
                  "id": "none",
                  "name": "无需跟进"
                },
                {
                  "id": "needs-followup",
                  "name": "待跟进"
                },
                {
                  "id": "snoozed",
                  "name": "已延后"
                },
                {
                  "id": "done",
                  "name": "已跟进"
                }
              ]
            }
          },
          {
            "slug": "last-synced-at",
            "name": "上次同步时间",
            "type": "date",
            "required": false
          }
        ],
        "views": []
      },
      {
        "key": "followups",
        "name": "跟进队列",
        "slug": "followups",
        "nodeId": "nodmt8fpld3gmloy1f",
        "baseId": "bsemt8fpld3jrv0yjc",
        "readLimit": 50,
        "description": "同步任务生成的待跟进建议，人工审核后标记处理结果；本应用从不代为发送消息。",
        "fields": [
          {
            "slug": "summary",
            "name": "摘要",
            "type": "text",
            "required": true
          },
          {
            "slug": "contact",
            "name": "联系人",
            "type": "relation",
            "required": true
          },
          {
            "slug": "reason",
            "name": "触发原因",
            "type": "select",
            "required": true,
            "options": {
              "choices": [
                {
                  "id": "stale-conversation",
                  "name": "长时间未联系"
                },
                {
                  "id": "manual-flag",
                  "name": "手动标记"
                },
                {
                  "id": "vip-no-contact",
                  "name": "重要联系人无近期互动"
                }
              ]
            }
          },
          {
            "slug": "days-silent",
            "name": "沉默天数",
            "type": "number",
            "required": false
          },
          {
            "slug": "suggested-note",
            "name": "建议开场白",
            "type": "text",
            "required": false
          },
          {
            "slug": "status",
            "name": "状态",
            "type": "select",
            "required": true,
            "options": {
              "choices": [
                {
                  "id": "needs-review",
                  "name": "待审核"
                },
                {
                  "id": "snoozed",
                  "name": "已延后"
                },
                {
                  "id": "done",
                  "name": "已处理"
                },
                {
                  "id": "dismissed",
                  "name": "已忽略"
                }
              ]
            }
          },
          {
            "slug": "decision-comment",
            "name": "处理备注",
            "type": "text",
            "required": false
          },
          {
            "slug": "decided-at",
            "name": "处理时间",
            "type": "date",
            "required": false
          },
          {
            "slug": "decided-by",
            "name": "处理人",
            "type": "text",
            "required": false
          }
        ],
        "views": []
      },
      {
        "key": "settings",
        "name": "设置",
        "slug": "settings",
        "nodeId": "nodmt8fq20tmjamd1l",
        "baseId": "bsemt8fq20tjsd6v31",
        "readLimit": 20,
        "description": "跟进规则、同步状态与 Agent 锁，每种 kind 一行。",
        "fields": [
          {
            "slug": "kind",
            "name": "配置项",
            "type": "text",
            "required": true
          },
          {
            "slug": "stale-threshold-days",
            "name": "跟进阈值（天）",
            "type": "number",
            "required": false
          },
          {
            "slug": "last-sync-at",
            "name": "上次同步时间",
            "type": "date",
            "required": false
          },
          {
            "slug": "last-sync-contact-count",
            "name": "上次同步联系人数",
            "type": "number",
            "required": false
          },
          {
            "slug": "locked-by",
            "name": "锁定人",
            "type": "text",
            "required": false
          },
          {
            "slug": "locked-at",
            "name": "锁定时间",
            "type": "date",
            "required": false
          }
        ],
        "views": []
      }
    ],
    "relations": [
      {
        "source_base": "followups",
        "field_slug": "contact",
        "field_name": "联系人",
        "target_base": "contacts",
        "required": true,
        "multiple": false
      }
    ],
    "docs": [],
    "drives": [],
    "whiteboards": [],
    "forms": [],
    "workflows": [],
    "html": [],
    "vaultRequirements": [],
    "integrations": []
  },
  "ui": {
    "primary_base": "contacts",
    "summary": "本机微信同步来的联系人和活跃度一览，待跟进的人排成一个审核队列。",
    "screens": [
      {
        "id": "overview",
        "name": "总览",
        "purpose": "同步状态、待跟进数量、关系标签分布",
        "data_sources": [
          "contacts",
          "followups",
          "settings"
        ]
      },
      {
        "id": "contacts",
        "name": "联系人",
        "purpose": "联系人列表/详情，查看和编辑标签、备注",
        "data_sources": [
          "contacts"
        ]
      },
      {
        "id": "followups",
        "name": "跟进队列",
        "purpose": "待审核的跟进建议，人工标记处理结果",
        "data_sources": [
          "followups",
          "contacts"
        ]
      }
    ],
    "attention_states": [
      "needs-followup",
      "needs-review"
    ],
    "actions": [
      {
        "id": "update-contact",
        "label": "更新联系人标签/备注",
        "kind": "change_request",
        "base": "contacts",
        "fields": [
          "tag",
          "relationship-note",
          "follow-up-status"
        ]
      },
      {
        "id": "decide-followup",
        "label": "处理跟进建议",
        "kind": "change_request",
        "base": "followups",
        "fields": [
          "status",
          "decision-comment",
          "decided-at",
          "decided-by"
        ]
      }
    ]
  },
  "permissions": {
    "read_procedures": [
      "records.list",
      "records.get",
      "changeRequests.list"
    ],
    "change_request_procedures": [
      "records.update"
    ]
  },
  "demoRecords": [
    {
      "id": "demo-contacts-1",
      "baseKey": "contacts",
      "fields": {
        "display-name": "张三",
        "username": "wxid_demo_zhangsan",
        "kind": "person",
        "tag": "vip",
        "follow-up-status": "needs-followup",
        "last-message-summary": "（示例数据）好久没聊了，最近怎么样？"
      }
    },
    {
      "id": "demo-followups-1",
      "baseKey": "followups",
      "fields": {
        "summary": "张三：9 天未联系，标记为重要",
        "reason": "vip-no-contact",
        "days-silent": 9,
        "suggested-note": "（示例数据）好久没聊了，最近怎么样？",
        "status": "needs-review"
      }
    },
    {
      "id": "demo-settings-1",
      "baseKey": "settings",
      "fields": {
        "kind": "followup-rules",
        "stale-threshold-days": 7
      }
    },
    {
      "id": "demo-settings-2",
      "baseKey": "settings",
      "fields": {
        "kind": "sync-state"
      }
    },
    {
      "id": "demo-settings-3",
      "baseKey": "settings",
      "fields": {
        "kind": "agent-lock"
      }
    }
  ]
};
