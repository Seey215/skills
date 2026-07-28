# Kelly App Skill Creator

Kelly App Skill Creator 用来设计运行在 Busabase 上、由人类与 Agent 协作的日常工作应用。它负责产品工作流，不再维护第二套应用框架。

它强制依赖：

- `$busabase`：连接、目标 Space、工作区操作、ChangeRequest 与审批；
- `$busabase-app-creator`：Busabase 资源、Vault 安全边界、AirApp 工程、验证与部署。

默认流程是 Research -> Plan -> Action -> Retrospective。Kelly App Skill Creator 沉淀应用类型、人的注意力与退出规则、Agent 职责、审批节点和复盘反馈，不支持 Local Provider，也不自定义运行时或数据层。

适用于研究台、审批队列、计划看板、行动控制台、运营概览、控制面板和协作工作区。
