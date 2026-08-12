# ADR-002: Department Employee Model（部门员工模型）

- 状态：Superseded by ADR-005（团队来源改为 The Agency 目录）。

用户以产品经理（CPO）身份统管工作台；Agent 是全局部门员工，归属于产品、设计、工程、安全、QA 等部门，一个部门可有多个员工 Agent。Studio 按部门多选入席，替代原 PRD 的 CTO/CDO/CISO 虚拟高管层和按项目目录读取的 `AgentSpec` 席位，统一接入 Rust 侧已有的 `departments` / `agents` 表。

**Considered Options**: 保留高管层模型（CTO/CDO/CISO 平级）；部门下再挂高管角色（两套并存）。前者不符合“部门员工”愿景，后者模型最重；故选部门员工模型。
