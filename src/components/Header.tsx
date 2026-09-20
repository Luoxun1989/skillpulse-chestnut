"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * 首页 Header（精简版）
 * 仅保留 Logo + 搜索框 + 主题切换
 * 搜索框：回车提交 → 写 URL query ?q=<kw>，WeeklyTimeline 据此切换到搜索结果
 */
export function Header() {
    const router = useRouter();
    const [keyword, setKeyword] = useState("");

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const kw = keyword.trim();
        const url = kw ? `/?q=${encodeURIComponent(kw)}` : "/";
        router.push(url);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 max-w-7xl mx-auto px-4 items-center">
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

                {/* 搜索框（居中，移动端隐藏） */}
                <div className="flex-1 hidden md:flex justify-center px-4">
                    <form onSubmit={submit} className="w-full max-w-md">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="搜索 AI 动态 / 论文 / 项目..."
                                className="w-full rounded-full border border-slate-200 dark:border-slate-700 bg-transparent pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                            />
                        </div>
                    </form>
                </div>

                {/* 主题切换 */}
                <div className="w-64 shrink-0 flex items-center justify-end gap-3">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
