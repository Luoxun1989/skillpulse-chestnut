# 首页改版：AI 行业聚合时间线流（参考 aihot.news）

- 日期：2026-09-17
- 项目：skillpulse-chestnut（前端）
- 状态：设计已获批，待写计划

## 背景与目标

当前首页有 4 个并列栏目卡片（AI 行业动态 / 本周最热 Skills·Agent / 本周精选论文 / 本周热门项目），二行二列 + 每栏目独立展开。

本次改版为**单条时间线流**，参考 [aihot.news](https://aihot.news)：主区按日期 H2 分组，顶部 Tab 横排用于筛选栏目维度。**不做** aihot 的 AI 原因/评分/收藏等需要 AI 后端能力的元素（用户明确排除）。

## 非目标（YAGNI）

- 不做「推荐理由 / AI 评分 / 收藏」等需要新后端能力的功能
- 不新增后端接口（继续复用 `/api/weekly-digest?section=xxx`）
- 不做往期归档独立页面（`/archive` 后续再议）
- 不改动数据源（news/paper/project 从后端，Skills 用前端 mock）

## 决策记录（brainstorming 结论）

| # | 决策 | 结论 |
|---|---|---|
| 1 | 布局 | **B** 顶部 Tab 横排 + 时间线（无固定侧栏） |
| 2 | 默认视图 | 全部（混合 4 栏目） |
| 3 | Tab 筛选 | 一次拉全部 + 本地 filter |
| 4 | GitHub 日期塌陷 | 按 publishedDate，缺失字段堆"今天" |
| 5 | Skills 呈现 | 完全同质混在时间线，不带额外徽章 |
| 6 | 期号切换 | 保留右上角 `[第 107 期 ▾]` |
| 7 | 卡片元素 | 纯样式仿，不加 AI 评分/收藏/推荐理由 |
| 8 | 移动端 | 横排 Tab 横向滚动 |
| 9 | 同一天排序 | 按后端 sortOrder（全局串联） |
| 10 | 加载状态 | Skeleton 骨架屏 |

## 架构

### 组件树

```
HomePage (src/app/page.tsx，Hero 不变)
└── WeeklyTimeline (替换 WeeklyDigestBoard)
    ├── TimelineTabs        Tab 横排 [全部/行业/Skills/论文/项目] + 期号下拉
    ├── TimelineSkeleton    loading 骨架屏
    └── TimelineList
        ├── DateGroupHeader    H2 "今天 · 周四" / "昨天" / "N 天前"
        └── TimelineCard       单条 item（无边框列表项）
            └── SourceBadge      彩色 dot 标签
```

### 数据流

```
首次加载:
  fetch /api/weekly-digest?section=news&limit=10    ┐
  fetch /api/weekly-digest?section=paper&limit=10   │  Promise.all
  fetch /api/weekly-digest?section=project&limit=10 │
  MOCK_SKILL_AGENT_ITEMS (community 占位)            ┘
                         ↓
  merge → sort (publishedDate desc → sortOrder asc)
                         ↓
  group by date（缺日期 → "今天"）
                         ↓
  渲染 Tab + TimelineList

切换 Tab：纯本地 filter，不重新请求
切换 Issue：仅后端 3 栏目重拉；mock Skills 保持不变
```

### 状态

- `allItems: WeeklyDigestItem[]` — 合并 + 缓存
- `activeTab: "all" | "news" | "community" | "paper" | "project"`
- `selectedIssue: number | null`
- `loading: boolean`（首次拉取 + 期号切换时为 true）

## 视觉 & 交互

### 顶部 Tab 区

```
[📌 全部 40] [📰 行业 12] [🔥 Skills 10] [📄 论文 8] [🛠 项目 10]   [第 107 期 ▾]
```

- 激活 Tab：`bg-primary/10 text-primary rounded-lg` 高亮；未激活灰字 hover 变深
- 右侧 `[第 107 期 ▾]` select；期号切换时仅后端 3 栏目重拉，mock Skills 保持不变
- mobile（<lg）：整行 `overflow-x-auto` 横向滚动

### 日期分组头（H2）

```
── 2026-09-17 · 今天 · 周四 ──────────────
── 2026-09-16 · 昨天 · 周三 ─────────────
── 2026-09-08 · 9 天前 ─────────────────
```

- 今天高亮（brand 色），昨天/更早中性色
- 左侧竖条 accent bar 呼应栏目色

### 卡片（TimelineCard，无边框列表项）

```
[GitHub Blog] 🔥
GitHub 用 Copilot 智能体将运行时迁到 83 万行 Rust     ← 标题 16px semibold
GitHub 工程师 Stephen Toub 复盘用 Copilot 智能体…      ← summary 14px line-clamp-2
🔥 84.2k ⭐ · 3h ago · skillpulse                    ← 元数据行
```

- 来源徽章：**彩色 dot 标签**（每栏目一种色）
- summary：两行截断（line-clamp-2）
- 元数据行：stars（🔥/⭐）/ comments（💬）/ likes（👍）/ 时间（相对时间），有才显示
- 时间用相对时间（今天内"3 小时前"，其他"9 天前"）
- 整卡可点击 → `target="_blank"`

## 测试

- 前端：抽取排序/分组逻辑为纯函数 `groupByDate(items)` + `mixSort(items)`，用 Vitest 单测
  - 混合排序：publishedDate desc → sortOrder asc
  - 日期分组：缺日期项归入 "today" 组
  - 相对时间：今天/昨天/N 天前文案
- UI 层：通过 preview 启动 dev server，验证：
  - 默认"全部"混合 4 栏目
  - Tab 切换过滤正确
  - 期号切换后端重拉、mock 不动
  - mobile 横向滚动
