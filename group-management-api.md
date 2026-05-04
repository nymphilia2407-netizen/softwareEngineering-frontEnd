# 群管理相关 API 约定

本文档描述当前 Django `chat` 应用下、挂载在 **`/api/groups/`** 的群聊管理能力

**鉴权**：除特别说明外，均需请求头 `Authorization: Bearer <JWT>`。

**路径参数**：下文 `{group_id}` 为群的 **`Conversation.id`**

---

## 0. 通用约定

| 项 | 约定 |
|----|------|
| 成功 | 多数接口返回 JSON，`code === 0` 表示业务成功（与 `request_success` 一致） |
| 成员角色 `role` | `owner`（群主）、`admin`（管理员）、`member`（普通成员） |
| Content-Type | 带 body 的请求使用 `application/json` |
---

## 1. 转让群聊

**实现方式**：通过变更成员角色，把 **`owner`** 转给另一名已在群内的成员；原群主降为 **`member`**。

| 项 | 值 |
|----|-----|
| **方法** | `PUT` |
| **路径** | `/api/groups/{group_id}/members` |
| **权限** | 仅 **群主**（`owner`）可调用 |

**请求体**

```json
{
  "user_id": 123,
  "role": "owner"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_id` | int | 是 | 新群主的用户 id（须已是群成员） |
| `role` | string | 是 | 转让时固定为 `"owner"` |

**行为（后端实现摘要）**

- 将目标成员的 `role` 设为 `owner`。
- 将当前操作者（原群主）的 `role` 设为 `admin`。

**成功响应** `200`

```json
{
  "code": 0,
  "info": "Role updated",
  "data": {}
}
```

**失败示例**

| HTTP | 说明 |
|------|------|
| `403` | 非群主调用（`Only owner can change roles.`） |
| `404` | 目标用户不是群成员（`Member not found`） |
| `400` | `role` 非法（须为 `owner` / `admin` / `member` 之一） |

---

## 2. 退出群聊

| 项 | 值 |
|----|-----|
| **方法** | `DELETE` |
| **路径** | `/api/groups/{group_id}/members/me` |
| **权限** | 群内 **`admin`** 或 **`member`**（**群主 `owner` 不可** 通过本接口退群） |

**请求体**：无。

**行为**

- **`admin` / `member`**：删除当前用户的 `ConversationParticipant`，即退群。
- **`owner`（群主）**：**不允许** 调用本接口退群。群主离开群的 **唯一方式** 为使用 **第 7 节「解散群聊」**；若群主希望本人离开而 **群继续存在**，须先 **转让群主**（第 1 节）使自身角色变为`admin`，再使用本接口退群。

**成功响应** 
**成功响应** `200`

```json
{
  "code": 0,
  "info": "Success",
  "data": {}
}

**失败示例**

| HTTP | 说明 |
|------|------|
| `400` | 当前用户为 **群主**，禁止退群（须 **第 7 节解散** 或 **第 1 节转让** 后以非群主身份退群） |
| `404` | 当前用户不在群内（`You are not in this group.`） |

---

## 3. 设置管理员

**实现方式**：群主对指定成员执行 **`PUT`**，将其 `role` 设为 **`admin`**；也可将管理员改回 **`member`**。

| 项 | 值 |
|----|-----|
| **方法** | `PUT` |
| **路径** | `/api/groups/{group_id}/members` |
| **权限** | 仅 **群主** |

**请求体示例（设为管理员）**

```json
{
  "user_id": 456,
  "role": "admin"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_id` | int | 是 | 目标成员用户 id |
| `role` | string | 是 | `admin` 或 `member`（降权）；仅 **`owner`** 可通过本接口把他人设为 `owner`（即转让，见第 1 节） |

**管理员限制（移除成员时）**

- `DELETE` 移除成员时：若操作者为 **`admin`**，只能移除 **`member`**，不能移除其他 `admin` 或 `owner`（后端返回 `403`）。

**成功 / 失败**：同第 1 节风格（`200` + `Role updated` 或相应错误码）。

---

## 4. 邀请新成员

按操作者角色分为两种：

| 操作者 | 行为 |
|--------|------|
| **`owner` / `admin`** | **`POST .../members`**：**直邀入群**，无需审核，被邀请人 **立即** 成为成员（见 4.1）。 |
| **`member`**（普通成员） | **`POST .../members`**：**发起加群请求**，生成 **待审核** 记录；须由 **群主或管理员** 审核通过后，被邀请人才入群（见 4.2、4.3）。 |

同一 **`POST /api/groups/{group_id}/members`** 路径，由后端根据当前用户角色分支处理。

---

### 4.1 发起邀请（直邀入群）

| 项 | 值 |
|----|-----|
| **方法** | `POST` |
| **路径** | `/api/groups/{group_id}/members` |
| **权限** | **`owner`** 或 **`admin`** |

**请求体**

```json
{
  "user_ids": [2, 3]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_ids` | int[] | 是 | 被邀请用户 id 列表；已是成员的 id 会被跳过；不存在的用户会被跳过 |

**行为摘要**

- 对不在群内的用户：**创建群成员关系**（如 `ConversationParticipant`），**立即生效**。
- 已为成员的 id **跳过**（幂等）。
- **不再**依赖「先 `pending` 再 `PUT .../invitations/...` 审核」的两步流程。

**成功响应** `200`

```json
{
  "code": 0,
  "info": "Users joined: bob, carol",
  "data": {}
}
```

**失败示例**

| HTTP | 说明 |
|------|------|
| `403` | 操作者不在群内等无权限场景 |
| `404` | 群不存在 |

---

### 4.2 普通成员发起邀请（待审核）

| 项 | 值 |
|----|-----|
| **方法** | `POST` |
| **路径** | `/api/groups/{group_id}/members`（与 4.1 相同） |
| **权限** | 群内 **`member`**（普通成员）；**`owner` / `admin` 调用本路径时走 4.1 直邀语义**，不进入本节待审流程 |

**请求体**（与 4.1 相同）

```json
{
  "user_ids": [2, 3]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_ids` | int[] | 是 | 拟拉入群的用户 id；已是群成员的 id 应跳过；不存在的用户应跳过或返回业务错误（与后端一致） |

**行为摘要**

- 为 **尚不在群内** 的用户创建 **`GroupInvitation`**，状态为 **`pending`**（或等价）；**不** 创建 `ConversationParticipant`，被邀请人 **未** 入群直至 4.3 接受。
- 邀请人记录为当前操作者（便于管理员查看「谁发起的」）；幂等策略与后端一致（例如同一 `(group, invitee, pending)` 不重复建多条）。
- 可为每名受邀者生成一条邀请，审核时逐条 **`invitation_id`** 处理（见 4.3）。

**成功响应** `200`（示例）

```json
{
  "code": 0,
  "info": "Invitations pending review",
  "data": {
    "invitation_ids": [10, 11]
  }
}
```

（`data.invitation_ids` 为可选；若无，管理员需通过 **`GET`** 待审列表或其它接口获取 `invitation_id`，见 4.3 前端说明。）

**失败示例**

| HTTP | 说明 |
|------|------|
| `403` | 非群成员调用 |
| `404` | 群不存在 |

---

### 4.3 审核邀请（接受 / 拒绝）

适用于 **4.2 产生的 `pending` 邀请**（及后端约定的其它待审来源）。**群主/管理员直邀（4.1）不要调用本接口。**

| 项 | 值 |
|----|-----|
| **方法** | `PUT` 或 `PATCH` |
| **路径** | `/api/groups/{group_id}/invitations/{invitation_id}` |
| **权限** | 群内 **`owner`** 或 **`admin`** |

**请求体**

```json
{
  "action": "accept"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `action` | string | 是 | `"accept"`：接受并入群（创建参与者等）；`"reject"`：拒绝，邀请关闭 |

**成功** `200`，`code: 0`，`info` 为说明字符串（如 `Invitation accepted, user joined group.`）。

**失败示例**

| HTTP | 说明 |
|------|------|
| `403` | 非群主/管理员，或不在群内 |
| `404` | 邀请不存在或已处理 |

**拉取待审列表**：管理员 UI 需要 **`GET /api/groups/{group_id}/invitations?status=pending`**（或等价路径/查询参数），返回含 `invitation_id`、被邀用户、`inviter` 等字段；若仓库尚未提供，需后端补充或通过 OpenAPI 约定。

---

## 5. 设置群公告

| 项 | 值 |
|----|-----|
| **方法** | `POST` |
| **路径** | `/api/groups/{group_id}/announcements` |
| **权限** | **`owner`** 或 **`admin`** |

**请求体**

```json
{
  "content": "本周例会改到周五 20:00"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | string | 是 | 公告正文 |

**成功响应** `201`

```json
{
  "code": 0,
  "info": "Announcement published"
}
```

（当前实现未带 `data` 字段；与 `request_success` 完全统一时可按需补充。）

**失败示例**

| HTTP | 说明 |
|------|------|
| `403` | 普通成员发帖（`Permission denied`）或不在群内 |

**查询公告**：通过 **`GET /api/groups/{group_id}`** 的 `data.announcements` 数组返回（含 `author_username`、`content`、`created_at` 等），见第 8 节「相关接口速查」。

---

## 6. 成员禁言

对群内指定成员设置或解除 **发言禁言**（被禁言用户仍可读消息、仍可见于成员列表；发消息接口 / WebSocket 发送侧应拒绝并返回明确错误码）。

| 项 | 值 |
|----|-----|
| **方法** | `PATCH`（推荐）或 `PUT` |
| **路径** | `/api/groups/{group_id}/members/{user_id}/mute` |
| **路径参数** | `{user_id}` 为被禁言 / 解禁的目标成员用户 id |
| **权限** | **`owner`** 或 **`admin`**；**`admin` 不得**对 **`owner`** 或其他 **`admin`** 禁言（返回 `403`） |

**请求体**

```json
{
  "muted_until": "2026-05-03T12:00:00+08:00"
}
```

或解除禁言：

```json
{
  "muted_until": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `muted_until` | string \| null | 是 | **ISO 8601** 时间戳：在该时刻之前禁止在群内发言；传 **`null`** 表示立即解除禁言。 |

**扩展**
- 与成员详情联动：`GET /api/groups/{group_id}` 的 `members[]` 中每项可增加 `muted_until: string \| null`（及可选 `is_muted: boolean` 由服务端根据当前时间与 `muted_until` 派生），便于群设置页展示状态。

**成功响应** `200`

```json
{
  "code": 0,
  "info": "Mute updated",
  "data": {
    "user_id": 456,
    "muted_until": "2026-05-03T12:00:00+08:00"
  }
}
```

**失败示例**

| HTTP | 说明 |
|------|------|
| `400` | body 缺 `muted_until` 或时间格式非法；或对 **`owner`** 自身调用禁言（若业务禁止） |
| `403` | 非群主/管理员、不在群内、或管理员尝试禁言群主/其他管理员 |
| `404` | 群不存在，或目标用户不是群成员 |

**发消息校验**：群内发送文本/媒体前，服务端应检查当前用户在该群的 `muted_until`（若 `now < muted_until` 则拒绝，`403` 或 `400`，`info` 建议含 `Muted` / `禁言中` 等便于前端提示）。

---

## 7. 解散群聊

**群主** 可主动解散整个群会话；解散后成员 **不可** 再在该会话发消息或拉取群详情。

**与第 2 节的关系**：**群主** 对 **`DELETE .../members/me` 一律拒绝**（见第 2 节），**不存在**「群主凭退群接口解散/离开」的路径；**整群结束仅允许通过本节 `DELETE /api/groups/{group_id}`**。转让群主后、原群主已成为 **`member`/`admin`** 时，方可使用第 2 节退群。

| 项 | 值 |
|----|-----|
| **方法** | `DELETE` |
| **路径** | `/api/groups/{group_id}` |
| **权限** | 仅 **群主**（`owner`）；须在群内且角色为 `owner` |

**请求体**：无。

**行为**

1. **校验**：`{group_id}` 对应会话存在且为群聊；当前用户为该群 `owner`。
2. **事务内**
   - 删除或软删除 **`Conversation`**（与项目「删会话」策略一致）；
   - 删除 **`ConversationParticipant`**（全体成员）；
   - 删除 **`GroupInvitation`**（含 `pending` / `accepted` 等）；
   - 删除群 **公告**、成员 **禁言** 等挂载在该群上的扩展数据；
   - 若消息正文挂在会话上，按既有私信/群聊删除策略级联或保留脱敏归档（不在此接口内展开）。
3. **幂等**：对 **已解散**（会话已不存在）再次 `DELETE`，可返回 **`404`**（`Group not found`）或 **`200`** + `code: 0` + `info` 表示已是终态（二选一，团队统一即可）。
4. **实时通知**：通过 WebSocket 向 **原群成员**（含离线用户由下次同步处理）推送事件，建议类型名与现有 `chat` 消费端对齐，例如 **`group_dissolved`** 或复用 **`group_sync`** / **`conversation_removed`**；payload 至少含 **`group_id`**（或 `conversation_id`，与客户端会话主键一致）。

**成功响应** `200`

```json
{
  "code": 0,
  "info": "Group dissolved",
  "data": {}
}
```

（`info` 文案以后端为准；若与 `request_success` 完全一致可无 `data`。）

**失败示例**

| HTTP | 说明 |
|------|------|
| `403` | 非群主（`admin` / `member` 调用）、或当前用户不在群内 / 非 `owner` |
| `404` | 群不存在或已解散（未采用幂等 `200` 时） |

**前端**：解散成功后从会话列表移除该群、关闭群聊页；订阅了上述 WS 的客户端应收包刷新列表。

**替代路径（不推荐作为主方案）**：不实现本节时，无法让群主在 **保留群** 的前提下「仅自己离开」——须先 **转让群主**（第 1 节）再退群；与「群主一键解散」**必须** 有本节（或等价接口）。**以后端是否提供 `DELETE /api/groups/{group_id}` 为准**。

---

## 8. 相关接口速查（群管理联动用）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/groups/` | 创建群聊（`group_name`、`member_ids`、`client_request_id` 可选） |
| `GET` | `/api/groups/{group_id}` | 群详情：`group_name`、`avatar`、`members`（含 `role`；禁言落地后可选含 `muted_until`）、`announcements` |
| `PUT` | `/api/groups/{group_id}/avatar` | 仅群主上传群头像 |
| `POST` | `/api/groups/{group_id}/members` | 群主/管理员直邀入群；普通成员发起待审邀请（见第 4 节） |
| `GET` | `/api/groups/{group_id}/invitations` | （建议）待审邀请列表，`?status=pending`（见第 4.3 节） |
| `PUT` / `PATCH` | `/api/groups/{group_id}/invitations/{invitation_id}` | 审核成员发起的邀请（见第 4.3 节） |
| `DELETE` | `/api/groups/{group_id}/members/me` | 管理员/成员退群；**群主不可调用**（见第 2 节） |
| `DELETE` | `/api/groups/{group_id}/members` | 群主/管理员踢人；body：`{"user_id": <int>}` |
| `PUT` | `/api/groups/{group_id}/members` | 转让群主、设/撤管理员（见上文） |
| `PATCH` | `/api/groups/{group_id}/members/{user_id}/mute` | 成员禁言 / 解禁（见第 6 节） |
| `DELETE` | `/api/groups/{group_id}` | 群主解散整群（见第 7 节） |

---

## 9. 角色与操作权限矩阵（实现摘要）

| 操作 | owner | admin | member |
|------|-------|-------|--------|
| 转让群主 | ✅ | ❌ | ❌ |
| 设置管理员 | ✅ | ❌ | ❌ |
| 直邀入群 `POST /members`（群主/管理员） | ✅ | ✅ | ❌ |
| 发起邀请 `POST /members`（普通成员，待审核） | ❌ | ❌ | ✅ |
| 审核待审邀请 `PUT .../invitations/{id}` | ✅ | ✅ | ❌ |
| 发布公告 | ✅ | ✅ | ❌ |
| 移除成员 | ✅ | ⚠️ 仅可移除 `member` | ❌ |
| 成员禁言（第 6 节） | ✅ | ✅（仅可对 `member`） | ❌ |
| 解散群聊 `DELETE /api/groups/{group_id}`（第 7 节） | ✅ | ❌ | ❌ |
| 退群 `DELETE .../members/me` | ❌ 群主不可退群（须解散第 7 节，或先转让为非群主） | ✅ | ✅ |

---