import { describe, it, expect } from "vitest";
import { mixSort, groupByDate, formatRelativeTime, DateGroup } from "../src/lib/timeline";
import type { WeeklyDigestItem } from "../src/types/weekly-digest";

// 用本地时间构造，保证任意本地时区下日历日稳定（不依赖 UTC 解析的时区偏移）。
// h/m 省略时默认 12:00，避开午夜的边界问题。
function localDate(y: number, m: number, d: number, h: number = 12, min: number = 0): Date {
    return new Date(y, m - 1, d, h, min, 0);
}

const NOW = localDate(2026, 9, 17, 10);

/** 将本地日期转成字符串供 publishedDate 使用；经 toISOString 往返后本地日历日不变 */
function dateStr(y: number, m: number, d: number, h: number = 12): string {
    return localDate(y, m, d, h).toISOString();
}

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
    it("按 publishedDate 降序（新的在前）", () => {
        const items = [
            item({ id: "a", publishedDate: dateStr(2026, 9, 17, 8) }),
            item({ id: "b", publishedDate: dateStr(2026, 9, 18, 8) }),
            item({ id: "c", publishedDate: dateStr(2026, 9, 16, 8) }),
        ];
        const result = mixSort(items);
        expect(result.map((i) => i.id)).toEqual(["b", "a", "c"]);
    });

    it("无 publishedDate 的项排最后", () => {
        const items = [
            item({ id: "a" }),
            item({ id: "b", publishedDate: dateStr(2026, 9, 16, 8) }),
        ];
        const result = mixSort(items);
        expect(result.map((i) => i.id)).toEqual(["b", "a"]);
    });

    it("同 publishedDate 按 sortOrder 升序", () => {
        const items = [
            item({ id: "a", publishedDate: dateStr(2026, 9, 16, 8), sortOrder: 2 }),
            item({ id: "b", publishedDate: dateStr(2026, 9, 16, 8), sortOrder: 1 }),
            item({ id: "c", publishedDate: dateStr(2026, 9, 16, 8), sortOrder: 3 }),
        ];
        const result = mixSort(items);
        expect(result.map((i) => i.id)).toEqual(["b", "a", "c"]);
    });

    it("不修改原数组", () => {
        const items = [
            item({ id: "a", publishedDate: dateStr(2026, 9, 16, 8) }),
            item({ id: "b", publishedDate: dateStr(2026, 9, 18, 8) }),
        ];
        const original = [...items];
        mixSort(items);
        expect(items.map((i) => i.id)).toEqual(original.map((i) => i.id));
    });
});

describe("groupByDate", () => {
    it("按日期分组并返回 DateGroup", () => {
        const items = [
            item({ id: "a", publishedDate: dateStr(2026, 9, 17, 8) }),
            item({ id: "b", publishedDate: dateStr(2026, 9, 16, 8) }),
            item({ id: "c", publishedDate: dateStr(2026, 9, 15, 8) }),
        ];
        const groups = groupByDate(items, NOW);
        expect(groups.map((g) => g.key)).toEqual(["2026-09-17", "2026-09-16", "2026-09-15"]);
        expect(groups[0].items.map((i) => i.id)).toEqual(["a"]);
    });

    it("缺 publishedDate 的项归入今天组且 isToday=true", () => {
        const items = [
            item({ id: "a" }),
            item({ id: "b", publishedDate: dateStr(2026, 9, 16, 8) }),
        ];
        const groups = groupByDate(items, NOW);
        const today = groups.find((g) => g.isToday);
        expect(today).toBeDefined();
        expect(today!.key).toEqual("2026-09-17");
        expect(today!.items.map((i) => i.id)).toEqual(["a"]);
    });

    it("label 分别为 今天/昨天/9 天前", () => {
        const items = [
            item({ id: "today", publishedDate: dateStr(2026, 9, 17, 8) }),
            item({ id: "yesterday", publishedDate: dateStr(2026, 9, 16, 8) }),
            item({ id: "nineDays", publishedDate: dateStr(2026, 9, 8, 8) }),
        ];
        const groups = groupByDate(items, NOW);
        expect(groups[0].label).toEqual("今天");
        expect(groups[0].isToday).toBe(true);
        expect(groups[1].label).toEqual("昨天");
        expect(groups[2].label).toEqual("9 天前");
    });

    it("未来日期 label 用 key 原样", () => {
        const items = [
            item({ id: "future", publishedDate: dateStr(2026, 9, 20, 8) }),
        ];
        const groups = groupByDate(items, NOW);
        expect(groups[0].label).toEqual("2026-09-20");
    });

    it("无效日期字符串 throws fail fast", () => {
        const items = [
            item({ id: "bad", publishedDate: "not-a-date" }),
        ];
        expect(() => groupByDate(items, NOW)).toThrow("invalid publishedDate");
    });

    it("同一日期内保持 mixSort 排序（同 publishedDate 按 sortOrder 升序）", () => {
        const items = [
            item({ id: "a", publishedDate: dateStr(2026, 9, 16, 8), sortOrder: 2 }),
            item({ id: "b", publishedDate: dateStr(2026, 9, 16, 8), sortOrder: 1 }),
            item({ id: "c", publishedDate: dateStr(2026, 9, 16, 8), sortOrder: 3 }),
        ];
        const groups = groupByDate(items, NOW);
        expect(groups[0].items.map((i) => i.id)).toEqual(["b", "a", "c"]);
    });
});

describe("formatRelativeTime", () => {
    it("今天内小于 1 小时 → 刚刚", () => {
        // 5 分钟前，仍属今天同一日历日，约 0.08 小时（round 得 0）→ "刚刚"
        const d = localDate(2026, 9, 17, 9, 55);
        expect(formatRelativeTime(d.toISOString(), NOW)).toEqual("刚刚");
    });

    it("今天内 3 小时 → 3 小时前", () => {
        expect(formatRelativeTime(dateStr(2026, 9, 17, 7), NOW)).toEqual("3 小时前");
    });

    it("昨天 → 1 天前", () => {
        expect(formatRelativeTime(dateStr(2026, 9, 16, 23), NOW)).toEqual("1 天前");
    });

    it("9 天前 → 9 天前", () => {
        expect(formatRelativeTime(dateStr(2026, 9, 8), NOW)).toEqual("9 天前");
    });
});
