"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { WeeklyDigestItem, WeeklyDigestSection } from "@/types/weekly-digest";
import { MOCK_SKILL_AGENT_ITEMS } from "@/lib/mock-data";
import { groupByDate, formatRelativeTime } from "@/lib/timeline";
import type { DateGroup } from "@/lib/timeline";

/**
 * 首页周刊时间线流 + 顶部 Tab 横排
 * 数据来源：
 *   news / paper / project：/api/weekly-digest?section=xxx
 *   community（Skills）：前端 mock 数据（后端暂无该 section）
 * 交互：
 *   Tab 本地筛选，不重新请求
 *   期号切换仅重拉后端栏目，mock Skills 保持不变
 */
const FETCH_LIMIT = 10;
/** community 走 mock，不走后端 */
const BACKEND_SECTIONS: WeeklyDigestSection[] = ["news", "paper", "project"];

type TabKey = "all" | WeeklyDigestSection;

/** Tab 定义（顺序固定） */
const TABS: { key: TabKey; label: string }[] = [
    { key: "all", label: "全部 📌" },
    { key: "news", label: "行业 📰" },
    { key: "community", label: "Skills 🔥" },
    { key: "paper", label: "论文 📄" },
    { key: "project", label: "项目 🛠️" },
];

/** 栏目样式映射（彩色 dot） */
const SECTION_STYLES: Record<WeeklyDigestSection, { dot: string }> = {
    news: { dot: "bg-cyan-500" },
    community: { dot: "bg-orange-500" },
    paper: { dot: "bg-purple-500" },
    project: { dot: "bg-blue-500" },
};

/** 大数字格式化：>=1000 → "1.5k" */
function formatCount(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

/**
 * 拉取后端 3 栏目（news / paper / project）并 flat 合并。
 * 校验 res.ok，非 2xx 或数据异常时 fail fast 抛错，不吞异常。
 */
async function fetchBackendSections(issue?: number | null): Promise<WeeklyDigestItem[]> {
    const query = issue ? `&issue=${issue}` : "";
    const results = await Promise.all(
        BACKEND_SECTIONS.map((s) =>
            fetch(`/api/weekly-digest?section=${s}&limit=${FETCH_LIMIT}${query}`, {
                cache: "no-store",
            }).then(async (r) => {
                if (!r.ok) {
                    throw new Error(`weekly-digest ${s} request failed: ${r.status}`);
                }
                const data = await r.json();
                return data?.success && Array.isArray(data.data) ? data.data : [];
            })
        )
    );
    return results.flat();
}

export function WeeklyTimeline() {
    const [allItems, setAllItems] = useState<WeeklyDigestItem[]>([]);
    const [issues, setIssues] = useState<number[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>("all");
    const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    /** 请求序号守卫：防止期号快速切换时旧请求迟到覆盖新数据 */
    const issueSeqRef = useRef(0);

    // 首次加载：期号列表 + 后端 3 栏目并行拉，注入 mock Skills
    useEffect(() => {
        let cancelled = false;
        async function loadAll() {
            try {
                const issuesRes = await fetch("/api/weekly-digest/issues", { cache: "no-store" });
                if (!issuesRes.ok) {
                    throw new Error(`weekly-digest/issues request failed: ${issuesRes.status}`);
                }
                const issuesData = await issuesRes.json();

                const [backend, issuesResult] = await Promise.all([
                    fetchBackendSections(),
                    issuesData,
                ]);

                if (!cancelled && issuesResult.success && Array.isArray(issuesResult.data)) {
                    setIssues(issuesResult.data);
                }

                if (!cancelled) {
                    setAllItems([...MOCK_SKILL_AGENT_ITEMS, ...backend]);
                    setLoading(false);
                }
            } catch (e) {
                console.error("WeeklyTimeline load error:", e);
                if (!cancelled) setLoading(false);
            }
        }
        loadAll();
        return () => {
            cancelled = true;
        };
    }, []);

    // 切换期号：仅重拉后端栏目，mock Skills 保持不变
    const loadByIssue = async (issue: number | null) => {
        const seq = ++issueSeqRef.current;
        setLoading(true);
        try {
            const backend = await fetchBackendSections(issue);
            // 旧请求迟到时丢弃，不覆盖新数据
            if (seq !== issueSeqRef.current) return;
            setAllItems([...MOCK_SKILL_AGENT_ITEMS, ...backend]);
            setSelectedIssue(issue);
        } catch (e) {
            console.error("WeeklyTimeline issue switch error:", e);
            // 失败时不更新 selectedIssue，UI 仍显示上一次成功数据
            if (seq !== issueSeqRef.current) return;
        } finally {
            if (seq === issueSeqRef.current) setLoading(false);
        }
    };

    if (loading) {
        return <TimelineSkeleton />;
    }

    // Tab 本地筛选
    const filtered = activeTab === "all" ? allItems : allItems.filter((i) => i.section === activeTab);
    const groups = groupByDate(filtered);

    // 各 Tab 计数：全部=总数，其余=对应 section 数
    const countByTab = (key: TabKey): number =>
        key === "all" ? allItems.length : allItems.filter((i) => i.section === key).length;

    const maxIssue = issues.length > 0 ? Math.max(...issues) : selectedIssue ?? null;

    return (
        <div className="px-4">
            <TimelineTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                countByTab={countByTab}
                issues={issues}
                selectedIssue={selectedIssue}
                maxIssue={maxIssue}
                onIssueChange={loadByIssue}
            />
            <TimelineList groups={groups} />
        </div>
    );
}

/** Tab 横排 + 期号下拉 */
function TimelineTabs({
    activeTab,
    onTabChange,
    countByTab,
    issues,
    selectedIssue,
    maxIssue,
    onIssueChange,
}: {
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
    countByTab: (key: TabKey) => number;
    issues: number[];
    selectedIssue: number | null;
    maxIssue: number | null;
    onIssueChange: (issue: number | null) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3 mb-6">
            {/* Tab 横排（mobile 横向滚动） */}
            <div className="flex items-center gap-1 overflow-x-auto">
                {TABS.map((tab) => {
                    const active = tab.key === activeTab;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => onTabChange(tab.key)}
                            className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                                active
                                    ? "bg-primary/10 text-primary"
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            {tab.label} ({countByTab(tab.key)})
                        </button>
                    );
                })}
            </div>

            {/* 期号下拉 */}
            <select
                value={selectedIssue ?? ""}
                onChange={(e) => {
                    const v = e.target.value;
                    onIssueChange(v ? parseInt(v) : null);
                }}
                className="shrink-0 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-sm"
            >
                <option value="">第 {maxIssue ?? ""} 期</option>
                {issues.map((issue) => (
                    <option key={issue} value={issue}>
                        第 {issue} 期
                    </option>
                ))}
            </select>
        </div>
    );
}

/** 时间线列表：外层竖线，按日期分组渲染 */
function TimelineList({ groups }: { groups: DateGroup[] }) {
    if (groups.length === 0) {
        return <p className="text-center text-slate-400 text-base py-8">暂无内容</p>;
    }
    return (
        <div className="border-l border-slate-200 dark:border-slate-800 pl-4">
            {groups.map((group) => (
                <div key={group.key} className="mb-6">
                    <DateGroupHeader group={group} />
                    <div>
                        {group.items.map((item) => (
                            <TimelineCard key={item.id} item={item} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/** H2 日期分组头 */
function DateGroupHeader({ group }: { group: DateGroup }) {
    return (
        <h2
            className={`flex items-center gap-2 text-sm font-semibold mb-2 mt-1 ${
                group.isToday ? "text-primary" : "text-slate-500"
            }`}
        >
            <span
                className={`w-2 h-2 rounded-full ${group.isToday ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
            />
            <span>──</span>
            <span>{group.label}</span>
            <span className="font-normal text-xs text-slate-400"> {group.items.length} 条</span>
        </h2>
    );
}

/** 单条 item（无边框列表项） */
function TimelineCard({ item }: { item: WeeklyDigestItem }) {
    const style = SECTION_STYLES[item.section];
    const relativeTime = item.publishedDate
        ? formatRelativeTime(item.publishedDate, new Date())
        : null;

    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
            {/* 左侧彩色 dot */}
            <span className={`mt-2 w-2 h-2 rounded-full ${style.dot} shrink-0`} />

            {/* 右侧内容 */}
            <div className="flex-1 min-w-0">
                {/* 顶行：来源名 + 外部链接图标 */}
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs text-slate-400 uppercase tracking-wide truncate">
                        {item.source || item.sourceId || "来源"}
                    </span>
                    <ExternalLink
                        className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-all group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 shrink-0"
                    />
                </div>

                {/* 标题 */}
                <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                    {item.title}
                </h3>

                {/* summary */}
                {item.summary && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {item.summary}
                    </p>
                )}

                {/* 元数据行 */}
                <div className="flex items-center gap-3 text-sm text-slate-400 dark:text-slate-500 mt-1.5">
                    {item.stars ? <span>⭐ {formatCount(item.stars)}</span> : null}
                    {item.commentsCount ? <span>💬 {formatCount(item.commentsCount)}</span> : null}
                    {item.likesCount ? <span>👍 {formatCount(item.likesCount)}</span> : null}
                    <span>· {relativeTime ?? "本周"}</span>
                </div>
            </div>
        </a>
    );
}

/** loading 骨架屏 */
function TimelineSkeleton() {
    const fakeGroups = [0, 1, 2];
    return (
        <div className="animate-pulse border-l border-slate-200 dark:border-slate-800 pl-4">
            {fakeGroups.map((g) => (
                <div key={g} className="mb-6">
                    {/* 标题条 */}
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2" />
                    {/* 2 行内容条 */}
                    <div className="space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}
