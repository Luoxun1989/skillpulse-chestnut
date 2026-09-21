"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * 首页 Header（精简版）
 * 仅保留 Logo + 搜索框（外侧独立按钮 + input）+ 主题切换
 * 搜索框：输入关键词 + 点击右侧「搜索」按钮 → 写 URL query ?q=<kw>
 */
export function Header() {
    const router = useRouter();
    const [keyword, setKeyword] = useState("");

    const submit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const kw = keyword.trim();
        const url = kw ? `/?q=${encodeURIComponent(kw)}` : "/";
        router.push(url);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 max-w-7xl mx-auto px-4 items-center gap-3">
                {/* Logo */}
                <div className="w-64 shrink-0 flex items-center">
                    <Link href="/" className="flex items-center">
                        <img
                            src="/Skillpulse.svg"
                            alt="SkillPulse"
                            style={{ height: "40px", width: "180px" }}
                        />
                    </Link>
                </div>

                {/* 搜索框（居中，移动端隐藏）：外侧独立按钮 + input */}
                <form
                    onSubmit={submit}
                    className="flex-1 hidden md:flex items-center gap-2"
                >
                    <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="搜索 AI 动态 / 论文 / 项目..."
                        className="flex-1 min-w-0 rounded-full border border-slate-200 dark:border-slate-700 bg-transparent px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                    />
                    <button
                        type="submit"
                        aria-label="搜索"
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:opacity-90 active:opacity-80 transition-opacity shrink-0"
                    >
                        <Search className="h-4 w-4" />
                        <span>搜索</span>
                    </button>
                </form>

                {/* 主题切换：三档平铺 Tab */}
                <div className="shrink-0 flex items-center justify-end">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
