# 首页改版：AI 行业聚合时间线流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把首页 4 栏目分块改版为单条时间线流（顶部 Tab 横排 + 按日期分组），参考 aihot.news。

**Architecture:** 新增 `src/lib/timeline.ts`（纯函数排序/分组/相对时间）+ 重写 `WeeklyDigestBoard.tsx` 为 `WeeklyTimeline`（一次拉全部 + 本地 filter + 按日期分组渲染）。不新增后端接口，Skills 用 mock。纯前端改动，Vitest 单测纯函数层。

**Tech Stack:** Next 14.2.35, React 18, Tailwind 3.4, lucide-react, Vitest（新增 dev dep）

---

## 前置任务：初始化 git + 安装 Vitest

**Files:**
- Create: `vitest.config.mts`
- Modify: `package.json`（加 dev dep + test script）
- Create: `vitest.setup.ts`（可选，本计划不需要）— 跳过

> 说明：`skillpulse-chestnut` 当前**不是 git 仓库**，且未安装 Vitest。必须先 `git init` 与安装依赖，后续任务才能提交、测试。

- [ ] **Step 1: 初始化 git 仓库**

```bash
cd D:/WebstormProjects/skillpulse-chestnut
git init
```

Expected: `Initialized empty Git repository in ...`

- [ ] **Step 2: 安装 Vitest（dev dependency）**

```bash
cd D:/WebstormProjects/skillpulse-chestnut
npm install -D vitest jsdom
```

Expected: 安装成功，`node_modules/.bin/vitest` 存在。**不升级**任何现有 Next/React/Tailwind 版本。

- [ ] **Step 3: 添加 Vitest 配置与 test script**

Create `vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
```

Modify `package.json` scripts 加入:

```json
"test": "vitest run"
```

- [ ] **Step 4: 验证 Vitest 可用**

Run: `npx vitest run --reporter=dot`
Expected: `No test files found`（或 0 个测试，0 失败）— 表示 runner 本身可跑。

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: init git + add vitest"
```

---

## Task 1: timeline 纯函数层（TDD）

**Files:**
- Create: `src/lib/timeline.ts`
- Test: `tests/timeline.test.ts`

清单：
- `mixSort(items)` — publishedDate desc → sortOrder asc（无日期视为最早）
- `groupByDate(items, now?)` — 按日期分组成 `{ key, label, isToday, items }[]`
- `formatRelativeTime(dateStr, now?)` — 今天内"X 小时前"，否则"N 天前"

- [ ] **Step 1: 写失败测试**

Create `tests/timeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mixSort, groupByDate, formatRelativeTime } from "../src/lib/timeline";
import type { WeeklyDigestItem } from "../src/types/weekly-digest";

const NOW = new Date("2026-09-17T10:00:00Z");

function item(partial: Partial<WeeklyDigestItem>): WeeklyDigestItem {
    return {
        id: partial.id ?? "x",
        section: partial.section ?? "news",
        title: partial.title ?? "t",
        url: partial.url ?? "https://example.com",
        publishedDate: partial.publishedDate ?? null,
        sortOrder: partial.sortOrder ?? 0,
        ...partial,
    };
}

describe("mixSort", () => {
    it("按 publishedDate desc 排序", () => {
        const a = item({ id: "a", publishedDate: "2026-09-10" });
        const b = item({ id: "b", publishedDate: "2026-09-12" });
        const c = item({ id: "c", publishedDate: "2026-09-08" });
        const sorted = mixSort([a, c, b]);
        expect(sorted.map((i) => i.id)).toEqual(["b", "a", "c"]);
    });

    it("无日期项排最后", () => {
        const withDate = item({ id: "a", publishedDate: "2026-09-01" });
        const noDate = item({ id: "b", publishedDate: null });
        const sorted = mixSort([noDate, withDate]);
        expect(sorted.map((i) => i.id)).toEqual(["a", "b"]);
    });

    it("同一天内按 sortOrder 升序", () => {
        const a = item({ id: "a", publishedDate: "2026-09-12", sortOrder: 2 });
        const b = item({ id: "b", publishedDate: "2026-09-12", sortOrder: 1 });
        const sorted = mixSort([a, b]);
        expect(sorted.map((i) => i.id)).toEqual(["b", "a"]);
    });
});

describe("groupByDate", () => {
    it("按日期分组并生成标签", () => {
        const today = item({ id: "t", publishedDate: "2026-09-17" });
        const yesterday = item({ id: "y", publishedDate: "2026-09-16" });
        const groups = groupByDate([yesterday, today], NOW);
        expect(groups).toHaveLength(2);
        expect(groups[0].items.map((i) => i.id)).toEqual(["t"]);
        expect(groups[0].isToday).toBe(true);
        expect(groups[1].items.map((i) => i.id)).toEqual(["y"]);
        expect(groups[1].isToday).toBe(false);
    });

    it("缺日期项归入 today 组", () => {
        const noDate = item({ id: "n", publishedDate: null });
        const groups = groupByDate([noDate], NOW);
        expect(groups[0].items.map((i) => i.id)).toEqual(["n"]);
        expect(groups[0].isToday).toBe(true);
    });

    it("label 格式：今天 / 昨天 / N 天前", () => {
        const gToday = groupByDate([item({ publishedDate: "2026-09-17" })], NOW)[0];
        const gYest = groupByDate([item({ publishedDate: "2026-09-16" })], NOW)[0];
        const gOld = groupByDate([item({ publishedDate: "2026-09-08" })], NOW)[0];
        expect(gToday.label).toContain("今天");
        expect(gYest.label).toContain("昨天");
        expect(gOld.label).toContain("9 天前");
    });
});

describe("formatRelativeTime", () => {
    it("今天内显示 X 小时前", () => {
        expect(formatRelativeTime("2026-09-17T07:00:00Z", NOW)).toContain("小时前");
    });
    it("昨天显示 1 天前", () => {
        expect(formatRelativeTime("2026-09-16T12:00:00Z", NOW)).toBe("1 天前");
    });
    it("9 天前", () => {
        expect(formatRelativeTime("2026-09-08T12:00:00Z", NOW)).toBe("9 天前");
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/timeline.test.ts`
Expected: FAIL —— `Cannot find module '../src/lib/timeline'`

- [ ] **Step 3: 实现 `src/lib/timeline.ts`**

```ts
import type { WeeklyDigestItem } from "@/types/weekly-digest";

export interface DateGroup {
    key: string;
    label: string;
    isToday: boolean;
    items: WeeklyDigestItem[];
}

const dayDiff = (a: Date, b: Date): number => {
    const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((B.getTime() - A.getTime()) / 86400000);
};

export function mixSort(items: WeeklyDigestItem[]): WeeklyDigestItem[] {
    return [...items].sort((a, b) => {
        const da = a.publishedDate ? new Date(a.publishedDate).getTime() : -Infinity;
        const db = b.publishedDate ? new Date(b.publishedDate).getTime() : -Infinity;
        if (da !== db) return db - da;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
}

export function groupByDate(items: WeeklyDigestItem[], now: Date = new Date()): DateGroup[] {
    const sorted = mixSort(items);
    const groups: DateGroup[] = [];
    const map = new Map<string, DateGroup>();
    for (const it of sorted) {
        const d = it.publishedDate ? new Date(it.publishedDate) : new Date(now);
        if (Number.isNaN(d.getTime())) {
            throw new Error(`invalid publishedDate: ${it.publishedDate}`);
        }
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const diff = dayDiff(d, now);
        let label: string;
        let isToday = false;
        if (diff === 0) {
            label = "今天";
            isToday = true;
        } else if (diff === 1) {
            label = "昨天";
        } else if (diff > 1) {
            label = `${diff} 天前`;
        } else {
            label = key;
        }
        let g = map.get(key);
        if (!g) {
            g = { key, label, isToday, items: [] };
            map.set(key, g);
            groups.push(g);
        }
        g.items.push(it);
    }
    return groups;
}

export function formatRelativeTime(dateStr: string, now: Date = new Date()): string {
    const d = new Date(dateStr);
    const diff = dayDiff(d, now);
    if (diff <= 0) {
        const hours = Math.max(0, Math.round((now.getTime() - d.getTime()) / 3600000));
        return hours < 1 ? "刚刚" : `${hours} 小时前`;
    }
    return `${diff} 天前`;
}
```

> 注意：`mixSort` 里已用绝对日期排序；`groupByDate` 依赖 `mixSort`，`formatRelativeTime` 独立。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/timeline.test.ts`
Expected: PASS（8 个断言全过）

- [ ] **Step 5: Commit**

```bash
git add src/lib/timeline.ts tests/timeline.test.ts
git commit -m "feat: add timeline sort/group/relative-time pure functions"
```

---

## Task 2: WeeklyTimeline 组件（替换 WeeklyDigestBoard）

**Files:**
- Create: `src/components/WeeklyTimeline.tsx`
- Delete: `src/components/WeeklyDigestBoard.tsx`（被替换，页面不再引用）
- Modify: `src/app/page.tsx`（引用改名为 WeeklyTimeline）

组件职责（数据流见 spec §架构）：
- 首次加载 `Promise.all` 拉 news/paper/project + 注入 mock Skills
- `allItems` 合并缓存；`mixSort` + `groupByDate`
- Tab `activeTab` 本地 filter（不重请求）
- 期号下拉 `selectedIssue`：仅重拉后端 3 栏目，mock 不变
- `loading` 首次/切换时显示 Skeleton
- 卡片无边框列表项：来源彩色 dot + 标题 + summary(line-clamp-2) + 元数据行(stars/comments/likes/时间)

- [ ] **Step 1: 写 WeeklyTimeline.tsx 主组件**

Create `src/components/WeeklyTimeline.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Calendar } from "lucide-react";
import type { WeeklyDigestItem, WeeklyDigestSection } from "@/types/weekly-digest";
import { MOCK_SKILL_AGENT_ITEMS } from "@/lib/mock-data";
import { mixSort, groupByDate, formatRelativeTime } from "@/lib/timeline";

type TabKey = "all" | WeeklyDigestSection;

const FETCH_LIMIT = 10;
const BACKEND_SECTIONS: WeeklyDigestSection[] = ["news", "paper", "project"];

const TABS: { key: TabKey; icon: string; label: string }[] = [
    { key: "all", icon: "📌", label: "全部" },
    { key: "news", icon: "📰", label: "行业" },
    { key: "community", icon: "🔥", label: "Skills" },
    { key: "paper", icon: "📄", label: "论文" },
    { key: "project", icon: "🛠️", label: "项目" },
];

/** 栏目 → 彩色 dot / 元数据 emoji 映射 */
const SECTION_STYLE: Record<
    WeeklyDigestSection,
    { dot: string }
> = {
    news: { dot: "bg-cyan-500" },
    community: { dot: "bg-orange-500" },
    paper: { dot: "bg-purple-500" },
    project: { dot: "bg-blue-500" },
};

export function WeeklyTimeline() {
    const [allItems, setAllItems] = useState<WeeklyDigestItem[]>([]);
    const [issues, setIssues] = useState<number[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>("all");
    const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // 首次加载：一次拉全部 + 注入 mock
    useEffect(() => {
        let cancelled = false;
        async function loadInitial() {
            try {
                const [issuesRes, ...sectionRes] = await Promise.all([
                    fetch("/api/weekly-digest/issues", { cache: "no-store" }),
                    ...BACKEND_SECTIONS.map((s) =>
                        fetch(`/api/weekly-digest?section=${s}&limit=${FETCH_LIMIT}`, {
                            cache: "no-store",
                        }).then((r) => r.json())
                    ),
                ]);
                const issuesData = await issuesRes.json();
                if (!cancelled && issuesData.success && Array.isArray(issuesData.data)) {
                    setIssues(issuesData.data);
                }

                const merged: WeeklyDigestItem[] = [...MOCK_SKILL_AGENT_ITEMS];
                BACKEND_SECTIONS.forEach((s, idx) => {
                    const res = sectionRes[idx];
                    if (res?.success && Array.isArray(res.data)) {
                        merged.push(...res.data);
                    }
                });
                if (!cancelled) {
                    setAllItems(merged);
                    setLoading(false);
                }
            } catch (e) {
                console.error("WeeklyTimeline load error:", e);
                if (!cancelled) setLoading(false);
            }
        }
        loadInitial();
        return () => {
            cancelled = true;
        };
    }, []);

    // 期号切换：仅重拉后端 3 栏目，mock 不变
    const loadByIssue = async (issue: number | null) => {
        setSelectedIssue(issue);
        setLoading(true);
        try {
            const results = await Promise.all(
                BACKEND_SECTIONS.map((s) =>
                    fetch(
                        `/api/weekly-digest?section=${s}&limit=${FETCH_LIMIT}${issue ? `&issue=${issue}` : ""}`,
                        { cache: "no-store" }
                    ).then((r) => r.json())
                )
            );
            const backend: WeeklyDigestItem[] = [];
            BACKEND_SECTIONS.forEach((s, idx) => {
                const res = results[idx];
                if (res?.success && Array.isArray(res.data)) {
                    backend.push(...res.data);
                }
            });
            setAllItems([...MOCK_SKILL_AGENT_ITEMS, ...backend]);
        } catch (e) {
            console.error("WeeklyTimeline issue switch error:", e);
        } finally {
            setLoading(false);
        }
    };

    // 过滤
    const filtered =
        activeTab === "all" ? allItems : allItems.filter((i) => i.section === activeTab);

    // 分组（loading 时仍可计算，但渲染 Skeleton）
    const groups = groupByDate(filtered);

    return (
        <div className="px-4">
            {/* Tab 区 */}
            <TimelineTabs
                tabs={TABS}
                counts={countByTab(allItems)}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                issues={issues}
                selectedIssue={selectedIssue}
                onIssueChange={loadByIssue}
            />

            {loading ? (
                <TimelineSkeleton />
            ) : groups.length === 0 ? (
                <p className="py-12 text-center text-slate-400">暂无本周内容</p>
            ) : (
                <TimelineList groups={groups} />
            )}
        </div>
    );
}

function countByTab(items: WeeklyDigestItem[]): Record<TabKey, number> {
    const c: Record<TabKey, number> = { all: items.length, news: 0, community: 0, paper: 0, project: 0 };
    for (const i of items) c[i.section] += 1;
    return c;
}

// ---- Tab 区 ----
function TimelineTabs({
    tabs,
    counts,
    activeTab,
    onTabChange,
    issues,
    selectedIssue,
    onIssueChange,
}: {
    tabs: { key: TabKey; icon: string; label: string }[];
    counts: Record<TabKey, number>;
    activeTab: TabKey;
    onTabChange: (k: TabKey) => void;
    issues: number[];
    selectedIssue: number | null;
    onIssueChange: (n: number | null) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 overflow-x-auto py-1">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onTabChange(t.key)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === t.key
                                ? "bg-primary/10 text-primary"
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        {t.icon} {t.label} {counts[t.key] ?? 0}
                    </button>
                ))}
            </div>
            <select
                value={selectedIssue ?? ""}
                onChange={(e) => onIssueChange(e.target.value ? parseInt(e.target.value) : null)}
                className="shrink-0 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-transparent text-sm"
            >
                <option value="">第 {maxIssue(issues)} 期</option>
                {issues.map((n) => (
                    <option key={n} value={n}>
                        第 {n} 期
                    </option>
                ))}
            </select>
        </div>
    );
}

function maxIssue(issues: number[]): number {
    return issues.length ? Math.max(...issues) : 0;
}

// ---- 时间线 ----
function TimelineList({ groups }: { groups: { key: string; label: string; isToday: boolean; items: WeeklyDigestItem[] }[] }) {
    return (
        <div>
            {groups.map((g) => (
                <div key={g.key} className="border-l border-slate-200 dark:border-slate-800 pl-4 mb-6">
                    <h2
                        className={`flex items-center gap-2 text-base font-bold mb-2 ${
                            g.isToday ? "text-primary" : "text-slate-500"
                        }`}
                    >
                        <span className={`block w-1.5 h-5 rounded ${g.isToday ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"}`} />
                        <span className="text-slate-500 dark:text-slate-400 font-medium">──</span>
                        {g.label}
                        <span className="text-sm font-normal text-slate-400">{g.items.length} 条</span>
                    </h2>
                    <div>
                        {g.items.map((item) => (
                            <TimelineCard key={item.id} item={item} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ---- 无边框卡片 ----
function TimelineCard({ item }: { item: WeeklyDigestItem }) {
    const style = SECTION_STYLE[item.section];
    const now = new Date();
    const time = item.publishedDate ? formatRelativeTime(item.publishedDate, now) : "本周";
    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
            <span className={`mt-2 w-2 h-2 rounded-full ${style.dot} shrink-0`} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-slate-400 uppercase tracking-wide">{item.source}</span>
                    <span className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 group-hover:text-slate-500 transition-transform">
                        <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                </div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                    {item.title}
                </h3>
                {item.summary && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {item.summary}
                    </p>
                )}
                <div className="flex items-center gap-3 text-sm text-slate-400 dark:text-slate-500 mt-1.5">
                    {typeof item.stars === "number" && (
                        <span>⭐ {formatCount(item.stars)}</span>
                    )}
                    {typeof item.commentsCount === "number" && (
                        <span>💬 {formatCount(item.commentsCount)}</span>
                    )}
                    {typeof item.likesCount === "number" && (
                        <span>👍 {formatCount(item.likesCount)}</span>
                    )}
                    <span>· {time}</span>
                </div>
            </div>
        </a>
    );
}

// ---- Skeleton ----
function TimelineSkeleton() {
    return (
        <div className="space-y-4 py-4">
            {[0, 1, 2].map((n) => (
                <div key={n} className="animate-pulse space-y-2">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                    {[0, 1].map((m) => (
                        <div key={m} className="space-y-1.5">
                            <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800/60 rounded" />
                            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800/60 rounded" />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function formatCount(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
}
```

- [ ] **Step 2: 更新 page.tsx 引用**

Modify `src/app/page.tsx`（整个文件替换为）:

```tsx
import { WeeklyTimeline } from "@/components/WeeklyTimeline";

/**
 * 首页：Hero 宣传语 + AI 行业聚合时间线流
 */
export default function Home() {
    return (
        <>
            <section className="py-8 px-4 mb-4">
                <div className="max-w-7xl mx-auto text-center">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                        <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                            学习、理解、实践，与 AI 一起成长
                        </span>
                    </h1>
                </div>
            </section>

            <div className="max-w-7xl mx-auto pb-8">
                <WeeklyTimeline />
            </div>
        </>
    );
}
```

- [ ] **Step 3: 删除旧组件**

```bash
rm src/components/WeeklyDigestBoard.tsx
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 5: preview 验证 UI**
- 启动 dev（若未运行）：`preview_start next-dev`
- 用 `preview_snapshot` 确认：默认"全部"出现 4 栏目混合的时间线、日期分组 H2（今天/昨天/N 天前）、Tab 横排带 count、右上角期号下拉
- 用 `preview_click` 切换 Tab（如"行业"），`preview_snapshot` 确认只剩 news 类
- 用 `preview_click` 期号下拉选一期，确认 mock Skills 仍在
- `preview_resize` mobile 宽度，确认 Tab 横滚

- [ ] **Step 6: Commit**

```bash
git add src/components/WeeklyTimeline.tsx src/app/page.tsx
git add -u src/components/WeeklyDigestBoard.tsx
git commit -m "feat: replace section board with timeline stream (tabs + date grouping)"
```

---

## Task 3: 回归验证 + 收尾

**Files:**
- 无新文件（改动集中在 Task 1/2）

- [ ] **Step 1: 跑全部单测**

Run: `npx vitest run`
Expected: 全 PASS。

- [ ] **Step 2: lint**

Run: `npm run lint`
Expected: 0 error（可能 0 warning 或少量无关 warning）。

- [ ] **Step 3: dev 冒烟测试 + 浏览器预览**

用 preview 工具完成黄金路径 + 边界：
- 黄金路径：默认全部 → 每条卡片含来源/标题/summary/元数据
- Tab 切换过滤
- 期号切换
- mobile 横滚
- 空数据 Tab（如某栏目无数据时 Tab count=0，切过去显示"暂无本周内容"）

- [ ] **Step 4: 最终 Commit**

```bash
git add .
git commit -m "chore: regression pass on timeline stream"
```

---

## Self-Review 记录

- **Spec 覆盖**：4 栏目混合=Task2 默认 all；Tab 本地 filter=Task2 activeTab；GitHub 日期塌陷=groupByDate 缺日期归 today（测试覆盖）；Skills 同质=TimelineCard 无特殊分支；期号下拉保留=TimelineTabs；纯样式仿=TimelineCard 无 AI 评分/收藏；移动端横滚=overflow-x-auto；同天 sortOrder=mixSort 测试；Skeleton=TimelineSkeleton。全部命中。
- **占位符扫描**：无 TBD/TODO。
- **类型一致性**：`mixSort/groupByDate/formatRelativeTime` 三函数在 Task1 定义、Task2 引用签名一致；`DateGroup` 的 `{key,label,isToday,items}` 贯穿。`formatCount` 仅在组件内定义一次。
