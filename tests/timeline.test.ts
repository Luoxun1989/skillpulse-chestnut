import { describe, it, expect } from "vitest";
import { mixSort, groupByDate, formatRelativeTime, DateGroup } from "../src/lib/timeline";
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
    it("按 publishedDate 降序（新的在前）", () => {
        const items = [
            item({ id: "a", publishedDate: "2026-09-17T08:00:00Z" }),
            item({ id: "b", publishedDate: "2026-09-18T08:00:00Z" }),
            item({ id: "c", publishedDate: "2026-09-16T08:00:00Z" }),
        ];
        const result = mixSort(items);
        expect(result.map((i) => i.id)).toEqual(["b", "a", "c"]);
    });

    it("无 publishedDate 的项排最后", () => {
        const items = [
            item({ id: "a" }),
            item({ id: "b", publishedDate: "2026-09-16T08:00:00Z" }),
        ];
        const result = mixSort(items);
        expect(result.map((i) => i.id)).toEqual(["b", "a"]);
    });

    it("同 publishedDate 按 sortOrder 升序", () => {
        const items = [
            item({ id: "a", publishedDate: "2026-09-16T08:00:00Z", sortOrder: 2 }),
            item({ id: "b", publishedDate: "2026-09-16T08:00:00Z", sortOrder: 1 }),
            item({ id: "c", publishedDate: "2026-09-16T08:00:00Z", sortOrder: 3 }),
        ];
        const result = mixSort(items);
        expect(result.map((i) => i.id)).toEqual(["b", "a", "c"]);
    });

    it("不修改原数组", () => {
        const items = [
            item({ id: "a", publishedDate: "2026-09-16T08:00:00Z" }),
            item({ id: "b", publishedDate: "2026-09-18T08:00:00Z" }),
        ];
        const original = [...items];
        mixSort(items);
        expect(items.map((i) => i.id)).toEqual(original.map((i) => i.id));
    });
});

describe("groupByDate", () => {
    it("按日期分组并返回 DateGroup", () => {
        const items = [
            item({ id: "a", publishedDate: "2026-09-17T08:00:00Z" }),
            item({ id: "b", publishedDate: "2026-09-16T08:00:00Z" }),
            item({ id: "c", publishedDate: "2026-09-15T08:00:00Z" }),
        ];
        const groups = groupByDate(items, NOW);
        expect(groups.map((g) => g.key)).toEqual(["2026-09-17", "2026-09-16", "2026-09-15"]);
        expect(groups[0].items.map((i) => i.id)).toEqual(["a"]);
    });

    it("缺 publishedDate 的项归入今天组且 isToday=true", () => {
        const items = [
            item({ id: "a" }),
            item({ id: "b", publishedDate: "2026-09-16T08:00:00Z" }),
        ];
        const groups = groupByDate(items, NOW);
        const today = groups.find((g) => g.isToday);
        expect(today).toBeDefined();
        expect(today!.key).toEqual("2026-09-17");
        expect(today!.items.map((i) => i.id)).toEqual(["a"]);
    });

    it("label 分别为 今天/昨天/9 天前", () => {
        const items = [
            item({ id: "today", publishedDate: "2026-09-17T08:00:00Z" }),
            item({ id: "yesterday", publishedDate: "2026-09-16T08:00:00Z" }),
            item({ id: "nineDays", publishedDate: "2026-09-08T08:00:00Z" }),
        ];
        const groups = groupByDate(items, NOW);
        expect(groups[0].label).toEqual("今天");
        expect(groups[0].isToday).toBe(true);
        expect(groups[1].label).toEqual("昨天");
        expect(groups[2].label).toEqual("9 天前");
    });

    it("未来日期 label 用 key 原样", () => {
        const items = [
            item({ id: "future", publishedDate: "2026-09-20T08:00:00Z" }),
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
            item({ id: "a", publishedDate: "2026-09-16T08:00:00Z", sortOrder: 2 }),
            item({ id: "b", publishedDate: "2026-09-16T08:00:00Z", sortOrder: 1 }),
            item({ id: "c", publishedDate: "2026-09-16T08:00:00Z", sortOrder: 3 }),
        ];
        const groups = groupByDate(items, NOW);
        expect(groups[0].items.map((i) => i.id)).toEqual(["b", "a", "c"]);
    });
});

describe("formatRelativeTime", () => {
    it("今天内小于 1 小时 → 刚刚", () => {
        const d = new Date("2026-09-17T09:50:00Z");
        expect(formatRelativeTime(d.toISOString(), NOW)).toEqual("刚刚");
    });

    it("今天内 3 小时 → 3 小时前", () => {
        const d = new Date("2026-09-17T07:00:00Z");
        expect(formatRelativeTime(d.toISOString(), NOW)).toEqual("3 小时前");
    });

    it("昨天 → 1 天前", () => {
        const d = new Date("2026-09-16T23:00:00Z");
        expect(formatRelativeTime(d.toISOString(), NOW)).toEqual("1 天前");
    });

    it("9 天前 → 9 天前", () => {
        const d = new Date("2026-09-08T10:00:00Z");
        expect(formatRelativeTime(d.toISOString(), NOW)).toEqual("9 天前");
    });
});
