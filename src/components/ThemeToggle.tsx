"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeKey = "light" | "dark" | "system";

const OPTIONS: { key: ThemeKey; label: string; icon: typeof Sun }[] = [
    { key: "light", label: "浅色", icon: Sun },
    { key: "dark", label: "深色", icon: Moon },
    { key: "system", label: "跟随系统", icon: Monitor },
];

/**
 * 三档主题切换：浅色 / 深色 / 跟随系统
 * 平铺 Tab 形态，与 aihot.news 顶部主题区一致
 */
export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const current = (mounted ? theme : "system") as ThemeKey;

    return (
        <div
            role="tablist"
            aria-label="主题切换"
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900"
        >
            {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = current === opt.key;
                return (
                    <button
                        key={opt.key}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        aria-label={opt.label}
                        onClick={() => setTheme(opt.key)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${
                            active
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
