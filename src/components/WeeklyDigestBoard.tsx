"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Calendar, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import type { WeeklyDigestItem, WeeklyDigestSection } from "@/types/weekly-digest";
import { MOCK_SKILL_AGENT_ITEMS } from "@/lib/mock-data";

/**
 * 首页周刊四栏目板块
 * 栏目顺序：AI 行业动态 → 本周最热 Skills/Agent → 本周精选论文 → 本周热门项目
 * 数据来源：
 *   news / paper / project：/api/weekly-digest?section=xxx
 *   skillAgent：前端 mock 数据（后端暂无该 section）
 */
const VISIBLE_COUNT = 5;
const FETCH_LIMIT = 10;

interface SectionConfig {
    key: WeeklyDigestSection;
    icon: string;
    title: string;
    accentBar: string;
    dotColor: string;
    linkColor: string;
    /** 是否使用 mock 数据 */
    mock?: boolean;
}

const SECTIONS: SectionConfig[] = [
    {
        key: "news",
        icon: "📰",
        title: "AI 行业动态",
        accentBar: "bg-gradient-to-r from-cyan-500 to-blue-500",
        dotColor: "bg-cyan-500",
        linkColor: "text-cyan-600",
    },
    {
        key: "community",
        icon: "🔥",
        title: "本周最热 Skills · Agent",
        accentBar: "bg-gradient-to-r from-orange-500 to-red-500",
        dotColor: "bg-orange-500",
        linkColor: "text-orange-600",
        mock: true,
    },
    {
        key: "paper",
        icon: "📄",
        title: "本周精选论文",
        accentBar: "bg-gradient-to-r from-purple-500 to-violet-500",
        dotColor: "bg-purple-500",
        linkColor: "text-purple-600",
    },
    {
        key: "project",
        icon: "🛠️",
        title: "本周热门项目",
        accentBar: "bg-gradient-to-r from-blue-500 to-indigo-500",
        dotColor: "bg-blue-500",
        linkColor: "text-blue-600",
    },
];

export function WeeklyDigestBoard() {
    const [dataByKey, setDataByKey] = useState<Record<string, WeeklyDigestItem[]>>({});
    const [issues, setIssues] = useState<number[]>([]);
    const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    /** 每栏目独立展开状态 */
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    // 首次加载：mock 栏目直接灌入，其他栏目并行拉
    useEffect(() => {
        let cancelled = false;
        async function loadAll() {
            try {
                const backendSections = SECTIONS.filter((s) => !s.mock);
                const [issuesRes, ...sectionRes] = await Promise.all([
                    fetch("/api/weekly-digest/issues", { cache: "no-store" }),
                    ...backendSections.map((s) =>
                        fetch(`/api/weekly-digest?section=${s.key}&limit=${FETCH_LIMIT}`, {
                            cache: "no-store",
                        }).then((r) => r.json())
                    ),
                ]);

                const issuesData = await issuesRes.json();
                if (!cancelled && issuesData.success && Array.isArray(issuesData.data)) {
                    setIssues(issuesData.data);
                }

                const map: Record<string, WeeklyDigestItem[]> = {};
                SECTIONS.forEach((s) => {
                    if (s.mock) {
                        map[s.key] = MOCK_SKILL_AGENT_ITEMS;
                        return;
                    }
                    const idx = backendSections.findIndex((b) => b.key === s.key);
                    const res = sectionRes[idx];
                    map[s.key] = res?.success && Array.isArray(res.data) ? res.data : [];
                });
                if (!cancelled) {
                    setDataByKey(map);
                    setLoading(false);
                }
            } catch (e) {
                console.error("WeeklyDigest load error:", e);
                if (!cancelled) setLoading(false);
            }
        }
        loadAll();
        return () => {
            cancelled = true;
        };
    }, []);

    // 切换期号：只重新拉后端栏目，mock 栏目不变
    const loadByIssue = async (issue: number | null) => {
        setSelectedIssue(issue);
        setLoading(true);
        try {
            const backendSections = SECTIONS.filter((s) => !s.mock);
            const results = await Promise.all(
                backendSections.map((s) =>
                    fetch(
                        `/api/weekly-digest?section=${s.key}&limit=${FETCH_LIMIT}${issue ? `&issue=${issue}` : ""}`,
                        { cache: "no-store" }
                    ).then((r) => r.json())
                )
            );
            setDataByKey((prev) => {
                const next = { ...prev };
                backendSections.forEach((s, idx) => {
                    const res = results[idx];
                    next[s.key] = res?.success && Array.isArray(res.data) ? res.data : [];
                });
                return next;
            });
        } catch (e) {
            console.error("WeeklyDigest issue switch error:", e);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (key: string) => {
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) {
        return (
            <div className="px-4 py-8 text-center text-slate-400 text-base">
                正在加载本周内容...
            </div>
        );
    }

    // 4 个栏目都为空时不展示
    const totalCount = SECTIONS.reduce(
        (sum, s) => sum + (dataByKey[s.key]?.length || 0),
        0
    );
    if (totalCount === 0) return null;

    return (
        <div className="px-4">
            {/* 二行二列布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {SECTIONS.map((section) => {
                    const items = dataByKey[section.key] || [];
                    if (items.length === 0) return null;
                    return (
                        <SectionBlock
                            key={section.key}
                            config={section}
                            items={items}
                            expanded={!!expanded[section.key]}
                            onToggleExpand={() => toggleExpand(section.key)}
                        />
                    );
                })}
            </div>

            {/* 底部：数据来源 / 期号回顾 */}
            <div className="mt-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                        <RefreshCw className="w-4 h-4" />
                        数据来源：arXiv · GitHub Trending · Hacker News · V2EX · Reddit · 掘金
                    </span>
                    <span>·</span>
                    <span>每周一更新</span>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <label>往期回顾：</label>
                    <select
                        value={selectedIssue ?? ""}
                        onChange={(e) => {
                            const v = e.target.value;
                            loadByIssue(v ? parseInt(v) : null);
                        }}
                        className="border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 text-sm"
                    >
                        <option value="">最新一期</option>
                        {issues.map((issue) => (
                            <option key={issue} value={issue}>
                                第 {issue} 期
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}

/** 单个栏目卡片 */
function SectionBlock({
    config,
    items,
    expanded,
    onToggleExpand,
}: {
    config: SectionConfig;
    items: WeeklyDigestItem[];
    expanded: boolean;
    onToggleExpand: () => void;
}) {
    // 默认展示前 VISIBLE_COUNT 条，展开后展示全部
    const visibleItems = expanded ? items : items.slice(0, VISIBLE_COUNT);
    const hasMore = items.length > VISIBLE_COUNT;

    return (
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* 顶部强调条 */}
            <div className={`h-1 ${config.accentBar}`} />

            <div className="px-5 py-4">
                {/* 标题 */}
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        <span>{config.icon}</span>
                        <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                            {config.title}
                        </span>
                        <span className="text-sm font-normal px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500">
                            {items.length} 条
                        </span>
                    </h2>
                </div>

                {/* 列表 */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleItems.map((item) => (
                        <DigestRow
                            key={item.id}
                            item={item}
                            dotColor={config.dotColor}
                            linkColor={config.linkColor}
                            section={config.key}
                        />
                    ))}
                </div>

                {/* 展开/收起按钮 */}
                {hasMore && (
                    <button
                        type="button"
                        onClick={onToggleExpand}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-dashed border-slate-200 dark:border-slate-700 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                        {expanded ? (
                            <>
                                <ChevronUp className="w-4 h-4" />
                                收起
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-4 h-4" />
                                展开更多（还剩 {items.length - VISIBLE_COUNT} 条）
                            </>
                        )}
                    </button>
                )}
            </div>
        </section>
    );
}

/** 单行内容 */
function DigestRow({
    item,
    dotColor,
    linkColor,
    section,
}: {
    item: WeeklyDigestItem;
    dotColor: string;
    linkColor: string;
    section: WeeklyDigestSection;
}) {
    // 元数据：按栏目渲染不同字段
    const meta = renderMeta(item, section);

    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 py-3 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
            <span className={`mt-2 w-2 h-2 rounded-full ${dotColor} shrink-0`} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-base text-slate-900 dark:text-white truncate">
                        {item.title}
                    </h3>
                    <span
                        className={`link-icon ${linkColor} text-sm shrink-0 opacity-60 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 flex items-center gap-0.5`}
                    >
                        链接
                        <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                </div>
                {item.summary && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1.5 leading-relaxed line-clamp-2">
                        {item.summary}
                    </p>
                )}
                {meta && (
                    <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                        {meta}
                    </div>
                )}
            </div>
        </a>
    );
}

/** 按栏目渲染元数据 */
function renderMeta(item: WeeklyDigestItem, section: WeeklyDigestSection) {
    const parts: React.ReactNode[] = [];

    if (section === "paper") {
        parts.push(
            <span key="type" className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                论文
            </span>
        );
        if (item.source) parts.push(<span key="src">来源：{item.source}</span>);
        if (item.sourceId) parts.push(<span key="sid">{item.sourceId}</span>);
        if (item.stars) parts.push(<span key="star">🔥 {formatCount(item.stars)}</span>);
    } else if (section === "project") {
        parts.push(
            <span key="type" className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                项目
            </span>
        );
        if (item.source) parts.push(<span key="src">来源：{item.source}</span>);
        if (item.sourceId) parts.push(<span key="lang">{item.sourceId}</span>);
        if (item.stars) parts.push(<span key="star">⭐ {formatCount(item.stars)}</span>);
    } else if (section === "news") {
        parts.push(
            <span key="type" className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                动态
            </span>
        );
        if (item.source) parts.push(<span key="src">来源：{item.source}</span>);
        if (item.publishedDate)
            parts.push(<span key="date">{formatDate(item.publishedDate)}</span>);
    } else if (section === "community") {
        // 本栏目复用于"本周最热 Skills/Agent"
        parts.push(
            <span key="type" className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                Skill
            </span>
        );
        if (item.source) parts.push(<span key="src">来源：{item.source}</span>);
        if (item.stars) parts.push(<span key="star">⭐ {formatCount(item.stars)}</span>);
        if (item.publishedDate)
            parts.push(<span key="date">{formatDate(item.publishedDate)}</span>);
    }

    if (parts.length === 0) return null;

    const result: React.ReactNode[] = [];
    parts.forEach((p, i) => {
        if (i > 0) result.push(<span key={`sep-${i}`}> · </span>);
        result.push(p);
    });
    return <>{result}</>;
}

function formatCount(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
}

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch {
        return dateStr;
    }
}