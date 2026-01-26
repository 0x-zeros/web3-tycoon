# Known Issues - tycoon_profiles

本文档记录代码审查中发现但暂不修复的问题，供后续版本参考。

---

## 1. "先到先得"占坑风险

**严重程度**: 高

**位置**:
- `game_profile.move:40` - `create_game_profile`
- `map_profile.move:46` - `create_map_profile`
- `registry.move:27` - `register`

**问题描述**:

Registry 禁止重复注册后，`create_game_profile` / `create_map_profile` 仍是任何人可调用的公开函数。攻击者可抢先为他人的 `game_id` / `map_id` 注册 Profile，永久阻断真实创建者。

**攻击场景**:
1. 用户 A 在 tycoon 合约创建了 Game，获得 `game_id`
2. 攻击者 B 监听链上事件，抢先调用 `create_game_profile(game_id, ...)`
3. 用户 A 再调用时，因 Registry 中已存在该 `game_id` 而失败
4. 攻击者 B 成为该 Profile 的 owner，可任意修改内容

**暂不修复原因**:
- 当前为测试阶段，Profile 系统尚未正式上线
- 修复需要跨合约协调，涉及 tycoon 主合约改动

**潜在改善方向**:
- Move 端校验 `game_id` / `map_id` 所属权（需 tycoon 合约暴露查询接口）
- 引入 Cap 授权机制，仅持有 GameCap / MapCap 者可创建对应 Profile
- 或改为由 tycoon 合约在创建 Game/Map 时自动调用 Profile 创建


先做一个msg（？） sign，用关联的方式来授权？  这个大约可以解决 by zeros？


---

## 更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-01-26 | 1.0 | 初始创建，记录代码审查发现的问题 |
