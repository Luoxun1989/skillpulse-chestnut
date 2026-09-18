import type { WeeklyDigestItem } from "@/types/weekly-digest";

export interface DateGroup {
    key: string;      // "YYYY-MM-DD"
    label: string;    // "今天" / "昨天" / "9 天前" / 或日期字符串
    isToday: boolean;
    items: WeeklyDigestItem[];
}

/**
 * 计算 a（参考时刻）相对 b 的整天（日历日）差，忽略时分秒。
 * 基于本地时区日历日、按整天计算（与 groupByDate/formatRelativeTime 共用）。
 */
function dayDiff(a: Date, b: Date): number {
    const aStart = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const bStart = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((aStart.getTime() - bStart.getTime()) / 86400000);
}

/** 将日期格式化为当地 "YYYY-MM-DD" */
function formatDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** 解析 publishedDate 得到 Date，非法日期 fail fast 抛错 */
function parseDate(dateStr: string): Date {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`invalid publishedDate: ${dateStr}`);
    }
    return d;
}

/**
 * 排序：publishedDate 降序（新的在前），同日期按 sortOrder 升序。
 * 无 publishedDate 的项视为 -Infinity 排最后。返回新数组，不改原数组。
 */
export function mixSort(items: WeeklyDigestItem[]): WeeklyDigestItem[] {
    return [...items].sort((x, y) => {
        const a = x.publishedDate ? parseDate(x.publishedDate).getTime() : -Infinity;
        const b = y.publishedDate ? parseDate(y.publishedDate).getTime() : -Infinity;
        if (b !== a) {
            return b - a;
        }
        return (x.sortOrder ?? 0) - (y.sortOrder ?? 0);
    });
}

/**
 * 先 mixSort 排序，再按当地日期分组；组内保持 mixSort 顺序。
 * 无 publishedDate 的项归入今天组（用 now 的日期）。
 */
export function groupByDate(items: WeeklyDigestItem[], now: Date = new Date()): DateGroup[] {
    const sorted = mixSort(items);
    const groups: DateGroup[] = [];
    const indexByKey = new Map<string, DateGroup>();

    for (const it of sorted) {
        const d = it.publishedDate ? parseDate(it.publishedDate) : now;
        const key = formatDateKey(d);
        const diff = dayDiff(now, d);

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

        let group = indexByKey.get(key);
        if (!group) {
            group = { key, label, isToday, items: [] };
            indexByKey.set(key, group);
            groups.push(group);
        } else {
            group.label = label;
            group.isToday = isToday;
        }
        group.items.push(it);
    }

    return groups;
}

/**
 * 计算相对时间文案。
 * 同一日历日：小于 1 小时 → "刚刚"，否则 "N 小时前"；
 * 昨天 → "1 天前"，diff>1 → "N 天前"。
 */
export function formatRelativeTime(dateStr: string, now: Date = new Date()): string {
    const d = parseDate(dateStr);
    const diff = dayDiff(now, d);
    if (diff === 0) {
        const hours = Math.max(0, Math.round((now.getTime() - d.getTime()) / 3600000));
        if (hours < 1) {
            return "刚刚";
        }
        return `${hours} 小时前`;
    }
    return `${diff} 天前`;
}
