import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * 首页 Header（精简版）
 * 仅保留 Logo + slogan + 主题切换，去掉搜索框/登录/提交按钮/用户菜单
 */
export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 max-w-7xl mx-auto px-4">
                {/* Logo */}
                <div className="w-64 shrink-0 flex items-center">
                    <Link href="/" className="flex items-center gap-2">
                        <img
                            src="/Skillpulse.svg"
                            alt="SkillPulse"
                            style={{ height: "40px", width: "180px" }}
                        />
                    </Link>
                </div>

                {/* Slogan */}
                <div className="flex-1 flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">
                        一周精选 · 每周一更新
                    </span>
                </div>

                {/* 主题切换 */}
                <div className="w-64 shrink-0 flex items-center justify-end gap-3">
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
