# LIG-34 · 空间记忆、来源链与 V2 存档迁移

## 用户故事

作为玩家，我希望澄记得事情发生在哪个区域、经过哪条路线和处于哪个世界相位，并能从记忆结论回到原始事件，以便确认连续性来自真实空间经历。

## 验收标准

- 世界事件保存 `regionId`、`landmarkIds`、`routeId`、`phaseId`、`entityIds` 与不可变 eventId。
- 情景记忆保存 locationIds、landmarkIds、routeIds、phaseIds，并只通过 eventRefs 引用原始事件。
- 记忆检查器可返回去重后的空间来源链，不把推断当作已验证世界事实。
- V2 `version: 2` 存档可迁移为 V2.1，补齐空间状态和新字段，同时保留角色、事件、技能、关系、作品和承诺。
- V2.1 导出包声明 simulation、scene、content、event、memory、skill 和 model policy 版本。
- 无效或未知版本仍安全回退到新旅程。
