# 四栏目数据模型设计：拆 4 表 + 爬虫字段预留

> 日期：2026-09-21
> 状态：Draft（待用户审）
> 范围：skillpulse-api 后端表结构 + skillpulse-crawler 接入字段约定

## 1. 背景与目标

### 1.1 当前状况

首页四栏目（news/paper/project/community）当前共用一张表 `weekly_digest_items`，通过 `section` 字段区分。已有约 14 条测试数据入库（news 5 / paper 5 / project 4，全部 issue 108），community（10 条 Skills）只是前端 mock 数据未入库。

爬虫侧：skillpulse-crawler 已存在骨架（P0-P4 任务完成），通过 admin 鉴权 API 调用 `batchUpsert` / `check-existence` 入库；natural key = (section, source, sourceId) 做幂等去重。

### 1.2 设计目标

1. **物理拆分**：4 个栏目各自独立表，演化互不影响
2. **公开 API 兼容**：前端 + 爬虫无感改造（UNION 后端做）
3. **爬虫可观测**：每条数据有 fetch_status / batch_id / raw_url 字段支持排障与重试
4. **Skills 真实入库**：community 移除前端 mock，10 条 Skills 数据迁移入库
5. **不破坏历史数据**：现有 ~14 条按 section 拆分导入新表

### 1.3 不在本次范围

- 各栏目爬虫本身的实现细节（属 skillpulse-crawler 仓库子任务）
- 推荐理由 AI 生成（用户明确不要）
- Admin Web 改版（admin 鉴权 API 仍按现状工作）
- 全文搜索升级（仍走现有 LIKE 模糊匹配，4 表 UNION）

## 2. 总体架构

```
        ┌──────────────────────────────────────────────────────────┐
        │               Frontend (skillpulse-chestnut)               │
        │   Header / Hero / WeeklyTimeline / Footer / 搜索          │
        └────────────────────────┬─────────────────────────────────┘
                                 │ HTTP
        ┌────────────────────────▼─────────────────────────────────┐
        │                  Backend (skillpulse-api)                  │
        │   公开 BFF /api/weekly-digest?section=    → UNION 4 表      │
        │   公开 BFF /api/weekly-digest/search?q=  → UNION 4 表      │
        │   Admin /api/admin/weekly-digest/{section}/items           │
        │            4 个独立入库接口（每 section 一个）              │
        └────┬────────────┬───────────────┬────────────────┬────────┘
             │            │               │                │
       ┌─────▼─────┐ ┌───▼────────┐ ┌────▼─────────┐ ┌────▼──────────┐
       │news_item  │ │paper_item  │ │project_item  │ │community_item │
       └───────────┘ └────────────┘ └──────────────┘ └───────────────┘
             │
        ┌────▼────────────────────────────────────────────────────┐
        │   skillpulse-crawler                                    │
        │   - 每 section 独立爬虫                                  │
        │   - 经 admin 鉴权调 batchUpsert API                      │
        │   - 写入 fetch_status / batch_id / raw_url               │
        └─────────────────────────────────────────────────────────┘
```

关键约束：
- 公开 API 路径不变（前端零改动）
- Admin/爬虫 4 个独立端点，每个 section 一个
- 字段重复不抽公共表（每表独立维护）

## 3. 字段设计

### 3.1 4 张表共用字段（重复出现在每张表中）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | VARCHAR(32) | PK | 主键，雪花/UUID 短码 |
| `title` | VARCHAR(512) | NOT NULL | 标题 |
| `summary` | TEXT | NULL | 摘要/简介 |
| `url` | VARCHAR(1024) | NOT NULL | 原文链接 |
| `source` | VARCHAR(64) | NOT NULL | 来源名（Hacker News / arXiv / GitHub / Smithery ...） |
| `source_id` | VARCHAR(128) | NOT NULL | 上游唯一 ID（HN id / arxiv id / repo full_name） |
| `stars` | INT | NULL | 收藏/点赞数（GitHub stars / HN points） |
| `comments_count` | INT | NULL | 评论数 |
| `likes_count` | INT | NULL | 点赞数 |
| `published_date` | DATE | NULL | 上游发布日期 |
| `issue_number` | INT | NULL | 上架期号，未上架为 NULL |
| `is_active` | TINYINT(1) | NOT NULL DEFAULT 1 | 是否上架 |
| `sort_order` | INT | NOT NULL DEFAULT 0 | 同栏目内排序 |
| `created_at` | DATETIME | NOT NULL | 入库时间 |
| `updated_at` | DATETIME | NOT NULL | 最近更新时间 |
| `metadata` | JSON | NULL | 栏目特有字段，见 §3.2 |

爬虫相关字段（每表必备）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `fetch_status` | VARCHAR(16) | NOT NULL DEFAULT 'success' | pending / success / failed / skipped。默认 `success` 用于「人工录入」或「已校验过的爬虫产物」，爬虫任务态流程见 §5.2 |
| `fetched_at` | DATETIME | NULL | 爬虫抓取时间 |
| `batch_id` | VARCHAR(64) | NULL | 抓取批次 ID（一次爬虫 run 一个） |
| `raw_url` | VARCHAR(1024) | NULL | 抓取时的原始 URL（可能被重定向） |
| `error_msg` | VARCHAR(1024) | NULL | 抓取失败原因 |
| `retry_count` | INT | NOT NULL DEFAULT 0 | 重试次数 |

### 3.2 各表 metadata JSON 字段约定

每张表有一个 `metadata JSON` 列，存本栏目特有字段。约定：

#### news_item.metadata
```json
{
  "author": "Alex Chen",
  "media_type": "blog" | "media" | "social" | "release_notes",
  "company": "Anthropic",
  "tags": ["claude", "release"],
  "language": "en"
}
```

#### paper_item.metadata
```json
{
  "arxiv_id": "2609.12345",
  "doi": "10.1234/abc.2026",
  "venue": "NeurIPS 2026",
  "authors": ["Alice", "Bob"],
  "categories": ["cs.CL", "cs.AI"],
  "citations": 42
}
```

#### project_item.metadata
```json
{
  "github_owner": "anthropics",
  "github_repo": "claude-code",
  "language": "TypeScript",
  "license": "MIT",
  "topics": ["agent", "cli"]
}
```

#### community_item.metadata
```json
{
  "provider": "Anthropic",
  "author": "Anthropic",
  "protocol": "MCP" | "A2A" | "Custom",
  "platforms": ["Claude Desktop", "Cursor", "Cline"],
  "install_cmd": "npx @anthropic/skills-install",
  "category": "Memory" | "Tool" | "Workflow" | "Marketplace"
}
```

### 3.3 不抽公共表的原因

| 方案 | 优点 | 缺点 | 决定 |
|---|---|---|---|
| **字段重复（选）** | 各表独立演进、查询简单、迁移工作量小 | 字段定义重复维护 | ✅ |
| 主表+详情表 | 数据范式最严谨 | JOIN 多、admin 改两个表、迁移复杂 | ❌ |
| 不拆表 + section | 改动最小 | 各栏目特有字段无表达空间 | ❌ |

## 4. 索引设计

每张表（4 张同构）：

| 索引名 | 列 | 类型 | 用途 |
|---|---|---|---|
| `PRIMARY` | `id` | UNIQUE BTREE | 主键 |
| `uk_natural_key` | `(source, source_id)` | UNIQUE BTREE | 爬虫幂等去重 |
| `idx_active_issue_sort` | `(is_active, issue_number, sort_order)` | BTREE | 公开列表查询 |
| `idx_published_date` | `(published_date)` | BTREE | 按日期排序（timeline 用） |
| `idx_fetch_status` | `(fetch_status, fetched_at)` | BTREE | 爬虫排障 |

搜索字段：`title` 和 `source` 上加普通 BTREE 索引（不在表设计里强制，留在 MySQL 索引创建时决定）。

## 5. 入库去重与爬虫字段

### 5.1 Natural Key 唯一性

每张表的 `(source, source_id)` 联合 UNIQUE 索引。

爬虫流程：
1. 抓取一条数据前 `GET /api/admin/weekly-digest/{section}/check-existence?source=&sourceId=`
2. 存在则跳过（更新 fetched_at 即可）
3. 不存在则 POST `/api/admin/weekly-digest/{section}/items`，payload 含全字段含 `fetch_status='success'`、`fetched_at`、`batch_id`、`raw_url`

### 5.2 fetch_status 状态机

```
   pending ──┬──► success (入库成功)
             ├──► failed  (重试后仍失败, error_msg 有值)
             └──► skipped (natural key 命中, 已存在)
```

爬虫入库后批量 `UPDATE fetch_status='success', fetched_at=NOW(), batch_id=? WHERE id IN (...)`。

### 5.3 重试策略

`retry_count` 记录失败重试次数。爬虫下次运行时筛 `fetch_status='failed' AND retry_count < 3` 的重新尝试。

## 6. 公开 API 设计（不变路径）

### 6.1 现有 API 保持兼容

| 路径 | 行为 |
|---|---|
| `GET /api/weekly-digest?section=news&issue=108&limit=10` | 后端 UNION news_item 单独查询 |
| `GET /api/weekly-digest/issues` | UNION 4 表 DISTINCT issue_number |
| `GET /api/weekly-digest/search?q=openai&limit=20` | UNION 4 表 title/source LIKE 搜索 |
| `GET /api/weekly-digest/{id}` | 4 表依次查询（id 全局唯一，U 雪花 + 4 库前缀隔离） |

### 6.2 id 全局唯一性

为了避免 4 表 id 冲突（避免公开 API 查 id 时要 union），id 生成规则：

```
{section-short}-{snowflake-id}
例：news-1891234567890123456
    paper-1891234567890123457
    project-1891234567890123458
    community-1891234567890123459
```

后端 `getById(String id)` 实现：先按前缀拆 section → 直接查对应表（无 union）。性能 + 简洁。

### 6.3 前端 type/契约不变

`WeeklyDigestItem` 接口的所有字段保持，前端 0 改动（除非前端后续要展示 metadata）。

## 7. Admin / 爬虫 API 设计（4 个独立端点）

替换现有单一 `WeeklyDigestAdminController` 的 4 个端点：

```
POST   /api/admin/weekly-digest/news/items           # 批量入库 news
GET    /api/admin/weekly-digest/news/check-existence
GET    /api/admin/weekly-digest/news/items           # 分页列表
GET    /api/admin/weekly-digest/news/items/{id}      # 详情
PUT    /api/admin/weekly-digest/news/items/{id}      # 更新
DELETE /api/admin/weekly-digest/news/items/{id}      # 删除

（同样 6 个端点 × paper / project / community = 24 个）
```

向后兼容：保留现有 `POST /api/admin/weekly-digest/items` 作为「全 4 表 union」入口，标记为 `@Deprecated`，但默认不删除（迁移期爬虫用老接口也不报错）。

## 8. 数据迁移方案

### 8.1 现有数据盘点

```sql
SELECT section, COUNT(*) FROM weekly_digest_items GROUP BY section;
-- 期望: news=5, paper=5, project=4, community=0
```

社区 10 条 Skills 在 `src/lib/mock-data.ts`，作为硬编码 JS 对象一并入库。

### 8.2 迁移步骤（dev 环境）

1. **新建 4 表** `news_item / paper_item / project_item / community_item`
2. **回填**：从旧 `weekly_digest_items` 按 section 拆分 → INSERT 新表
   - 自动生成新 id（按 §6.2 规则：`{section}-雪花id`）
   - `fetch_status='success'`、`fetched_at=created_at`、`batch_id='migration-20260921'`、`retry_count=0`
3. **Skills 入库**：执行 `src/lib/mock-data.ts` 中 10 条 Skills → INSERT community_item
4. **保留旧表**：dev 期间不删除 `weekly_digest_items`，方便回滚对比；prod 由运维决定是否 drop
5. **验证**：UNION 查询结果 = 老表查询结果（条数与内容）

### 8.3 迁移 SQL 脚本样例

```sql
-- migration-2026-09-21-section-tables.sql

-- 1. 建表
CREATE TABLE news_item LIKE weekly_digest_items;
ALTER TABLE news_item ADD COLUMN fetch_status VARCHAR(16) NOT NULL DEFAULT 'success';
ALTER TABLE news_item ADD COLUMN fetched_at DATETIME NULL;
ALTER TABLE news_item ADD COLUMN batch_id VARCHAR(64) NULL;
ALTER TABLE news_item ADD COLUMN raw_url VARCHAR(1024) NULL;
ALTER TABLE news_item ADD COLUMN error_msg VARCHAR(1024) NULL;
ALTER TABLE news_item ADD COLUMN retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE news_item ADD COLUMN metadata JSON NULL;
ALTER TABLE news_item DROP PRIMARY KEY, ADD PRIMARY KEY (id);
ALTER TABLE news_item DROP INDEX uk_natural_key, ADD UNIQUE KEY uk_natural_key (source, source_id);
ALTER TABLE news_item ADD INDEX idx_active_issue_sort (is_active, issue_number, sort_order);
ALTER TABLE news_item ADD INDEX idx_published_date (published_date);
ALTER TABLE news_item ADD INDEX idx_fetch_status (fetch_status, fetched_at);
-- paper / project / community 同样套路

-- 2. 回填
INSERT INTO news_item (id, title, summary, url, source, source_id, ...)
SELECT CONCAT('news-', id), title, summary, url, source, source_id, ...
FROM weekly_digest_items WHERE section='news';

-- 3. Skills 入库（10 条 INSERT，详见 admin 接口 POST /api/admin/weekly-digest/community/items）
```

迁移脚本与 admin API 二选一执行（推荐后者，可视化、可回滚）。

## 9. 风险与缓解

| 风险 | 缓解 |
|---|---|
| UNION 4 表后公开 API 性能下降 | 命中 `idx_active_issue_sort`；limit 限制 10；缓存 issues 列表 |
| 4 表 metadata 字段无 schema 强约束 | 在 service 层加 JSON schema 校验（admin 入库时） |
| id 前缀规则被新栏目打破 | Admin 入库前 enum 校验 section 合法性 |
| 旧 `weekly_digest_items` 残留占空间 | dev 保留 1 周观察；prod 由运维 drop |
| 迁移期间读旧数据 → 切到读新表 | 双写期：Service 层 read 新表，crawler admin 写新表，老表写 1 周后停 |

## 10. 验证清单

- [ ] 4 张表 DDL 跑通（建表 + 索引）
- [ ] 14 条历史数据迁移后条数/内容一致
- [ ] 10 条 Skills 迁移成功
- [ ] `GET /api/weekly-digest?section=news` 返回与迁移前等价
- [ ] `GET /api/weekly-digest/issues` 返回 108
- [ ] `GET /api/weekly-digest/search?q=OpenAI` 返回 3 条 OpenAI
- [ ] `GET /api/weekly-digest/{id}` 通过前缀直接命中单表
- [ ] 前端首页 (skillpulse-chestnut) 时间线、Tab、搜索、Toolbar 全部正常
- [ ] Admin POST `/api/admin/weekly-digest/community/items` 入库 Skills 成功
- [ ] check-existence 幂等性（第二次同 key 返回 true）
- [ ] Vitest 20 测试用例仍全部通过
- [ ] tsc --noEmit 0 错误

## 11. 后续步骤（不在本次）

1. 实现 4 张表 + 索引的 MyBatis mapper
2. 重写 `WeeklyDigestItemService` 实现 UNION
3. 拆分 Admin Controller 为 4 个
4. 跑迁移脚本 + 验证
5. 改 skillpulse-crawler 调用新 4 个端点
6. 删除旧 `weekly_digest_items` 表与 `weekly_digest_items` 相关的 mapper 方法（dev 环境在 §8.2 步骤 4 后由运维决定删除时机；prod 在 1 周观察期后）

---

附录 A：单字段类型表（4 表同构）

```
id                  VARCHAR(32)     PK
title               VARCHAR(512)    NOT NULL
summary             TEXT            NULL
url                 VARCHAR(1024)   NOT NULL
source              VARCHAR(64)     NOT NULL
source_id           VARCHAR(128)    NOT NULL
stars               INT             NULL
comments_count      INT             NULL
likes_count         INT             NULL
published_date      DATE            NULL
issue_number        INT             NULL
is_active           TINYINT(1)      NOT NULL DEFAULT 1
sort_order          INT             NOT NULL DEFAULT 0
fetch_status        VARCHAR(16)     NOT NULL DEFAULT 'success'
fetched_at          DATETIME        NULL
batch_id            VARCHAR(64)     NULL
raw_url             VARCHAR(1024)   NULL
error_msg           VARCHAR(1024)   NULL
retry_count         INT             NOT NULL DEFAULT 0
metadata            JSON            NULL
created_at          DATETIME        NOT NULL
updated_at          DATETIME        NOT NULL

索引：
PRIMARY KEY (id)
UNIQUE KEY uk_natural_key (source, source_id)
KEY idx_active_issue_sort (is_active, issue_number, sort_order)
KEY idx_published_date (published_date)
KEY idx_fetch_status (fetch_status, fetched_at)
```
