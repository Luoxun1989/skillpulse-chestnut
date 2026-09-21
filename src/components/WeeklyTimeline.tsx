"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, X } from "lucide-react";
import Link from "next/link";
import type { WeeklyDigestItem, WeeklyDigestSection } from "@/types/weekly-digest";
import { groupByDate, formatRelativeTime, rankTop, engagementScore } from "@/lib/timeline";
import type { DateGroup } from "@/lib/timeline";

/**
 * 首页周刊时间线流 + 顶部 Tab 横排
 * 数据来源：4 栏目全部走 /api/weekly-digest?section=xxx（community 已入库到 community_item）
 * 交互：
 *   Tab 本地筛选，不重新请求
 *   期号切换仅重拉后端
 */
const FETCH_LIMIT = 10;
const BACKEND_SECTIONS: WeeklyDigestSection[] = ["news", "paper", "project", "community"];

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
    const searchParams = useSearchParams();
    const q = (searchParams.get("q") || "").trim();

    const [allItems, setAllItems] = useState<WeeklyDigestItem[]>([]);
    const [issues, setIssues] = useState<number[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>("all");
    const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    /** 搜索结果 */
    const [searchResults, setSearchResults] = useState<WeeklyDigestItem[] | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    /** 请求序号守卫：防止期号快速切换时旧请求迟到覆盖新数据 */
    const issueSeqRef = useRef(0);
    /** 搜索请求序号守卫 */
    const searchSeqRef = useRef(0);

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
                    setAllItems(backend);
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
            setAllItems(backend);
            setSelectedIssue(issue);
        } catch (e) {
            console.error("WeeklyTimeline issue switch error:", e);
            // 失败时不更新 selectedIssue，UI 仍显示上一次成功数据
            if (seq !== issueSeqRef.current) return;
        } finally {
            if (seq === issueSeqRef.current) setLoading(false);
        }
    };

    // 搜索：q 非空时拉全库搜索结果；q 清空恢复时间线
    useEffect(() => {
        const seq = ++searchSeqRef.current;
        if (!q) {
            setSearchResults(null);
            setSearchLoading(false);
            return;
        }
        setSearchLoading(true);
        setSearchResults(null);
        fetch(`/api/weekly-digest/search?q=${encodeURIComponent(q)}`, { cache: "no-store" })
            .then(async (r) => {
                if (!r.ok) throw new Error(`search request failed: ${r.status}`);
                const data = await r.json();
                if (seq !== searchSeqRef.current) return;
                setSearchResults(data?.success && Array.isArray(data.data) ? data.data : []);
            })
            .catch((e) => {
                console.error("WeeklyTimeline search error:", e);
                if (seq === searchSeqRef.current) setSearchResults([]);
            })
            .finally(() => {
                if (seq === searchSeqRef.current) setSearchLoading(false);
            });
        return () => {
            /* seq guard handles cleanup */
        };
    }, [q]);

    // 搜索视图：q 非空时展示搜索结果，隐藏常规 Toolbar/Tab
    if (q) {
        return (
            <div className="px-4">
                <SearchHeader q={q} />
                {searchLoading && !searchResults ? (
                    <TimelineSkeleton />
                ) : (
                    <SearchResults items={searchResults ?? []} q={q} />
                )}
            </div>
        );
    }

    if (loading) {
        return <TimelineSkeleton />;
    }

    // Tab 本地筛选
    const filtered = activeTab === "all" ? allItems : allItems.filter((i) => i.section === activeTab);
    const groups = groupByDate(filtered);

    // 各 Tab 计数：全部=总数，其余=对应 section 数
    const countByTab = (key: TabKey): number =>
        key === "all" ? allItems.length : allItems.filter((i) => i.section === key).length;

    const topItems = rankTop(allItems, 5);

    return (
        <div className="px-4">
            <TimelineTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                countByTab={countByTab}
            />
            <Toolbar
                topItems={topItems}
                issues={issues}
                selectedIssue={selectedIssue}
                onIssueChange={loadByIssue}
            />
            <TimelineList groups={groups} />
        </div>
    );
}

/** Tab 横排（mobile 横向滚动） */
function TimelineTabs({
    activeTab,
    onTabChange,
    countByTab,
}: {
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
    countByTab: (key: TabKey) => number;
}) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1 scrollbar-thin">
            {TABS.map((tab) => {
                const active = tab.key === activeTab;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onTabChange(tab.key)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        {tab.label}
                        <span
                            className={`ml-1 text-xs ${
                                active
                                    ? "text-primary-foreground/70"
                                    : "text-slate-400"
                            }`}
                        >
                            {countByTab(tab.key)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** 搜索结果头部：展示搜索词 + 一键清空返回时间线 */
function SearchHeader({ q }: { q: string }) {
    return (
        <div className="flex items-center justify-between gap-3 mb-3 mt-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>搜索：{q}</span>
            </h2>
            <Link
                href="/"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
                <X className="w-3.5 h-3.5" />
                <span>返回时间线</span>
            </Link>
        </div>
    );
}

/** 搜索结果列表：复用卡片样式展示后端全库匹配 */
function SearchResults({ items, q }: { items: WeeklyDigestItem[]; q: string }) {
    if (items.length === 0) {
        return (
            <p className="text-center text-slate-400 text-base py-12">
                未找到与「{q}」相关的内容
            </p>
        );
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item) => (
                <TimelineCard key={item.id} item={item} />
            ))}
        </div>
    );
}

/** Toolbar 区：本周热榜 + 往期回顾 两个卡片（桌面横排，移动端竖排） */
function Toolbar({
    topItems,
    issues,
    selectedIssue,
    onIssueChange,
}: {
    topItems: WeeklyDigestItem[];
    issues: number[];
    selectedIssue: number | null;
    onIssueChange: (issue: number | null) => void;
}) {
    const sortedIssues = [...issues].sort((a, b) => b - a);
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            {/* 本周热榜 */}
            <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <h2 className="text-sm font-semibold mb-2 text-slate-900 dark:text-white">
                    🔥 本周热榜
                </h2>
                <ol className="space-y-1">
                    {topItems.length === 0 && (
                        <li className="text-sm text-slate-400">暂无数据</li>
                    )}
                    {topItems.map((item, idx) => (
                        <li key={item.id}>
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-2 text-sm hover:text-primary transition-colors"
                            >
                                <span className="w-5 text-center shrink-0 font-medium text-slate-400">
                                    {idx + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-slate-700 dark:text-slate-300 group-hover:underline">
                                        {item.title}
                                    </span>
                                </span>
                                <span className="shrink-0 text-xs text-slate-400">
                                    {formatCount(Math.round(engagementScore(item)))}
                                </span>
                            </a>
                        </li>
                    ))}
                </ol>
            </section>

            {/* 往期回顾 */}
            <section className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <h2 className="text-sm font-semibold mb-2 text-slate-900 dark:text-white">
                    📅 往期回顾
                </h2>
                <div className="flex flex-wrap gap-2">
                    {sortedIssues.map((issue) => {
                        const active = issue === selectedIssue;
                        return (
                            <button
                                key={issue}
                                type="button"
                                onClick={() => onIssueChange(active ? null : issue)}
                                className={`shrink-0 px-3 py-1 rounded-lg text-sm border transition-colors ${
                                    active
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                第 {issue} 期
                            </button>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

/** 时间线列表：按日期分组，组间上下叠，组内双列 */
function TimelineList({ groups }: { groups: DateGroup[] }) {
    if (groups.length === 0) {
        return <p className="text-center text-slate-400 text-base py-8">暂无内容</p>;
    }
    return (
        <div>
            {groups.map((group) => (
                <div key={group.key} className="mb-6">
                    <DateGroupHeader group={group} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

/** 单条 item（带边框卡片） */
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
            className="group flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all"
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
                <h3 className="font-semibold text-base text-slate-900 dark:text-white leading-snug">
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
    return (
        <div className="animate-pulse space-y-4">
            {[0, 1, 2].map((g) => (
                <div key={g}>
                    {/* 标题条 */}
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[0, 1].map((c) => (
                            <div
                                key={c}
                                className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2"
                            >
                                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
