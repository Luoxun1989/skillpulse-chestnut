/**
 * 首页 Footer（极简版）
 * 仅保留品牌区（Logo + slogan）+ 版权/ICP，去掉加入社区/快捷入口/友情链接
 */

export function Footer() {
    return (
        <footer className="border-t bg-slate-50 dark:bg-slate-950 mt-auto">
            <div className="container mx-auto px-4 py-6">
                <div className="flex flex-col items-center gap-3 text-center">
                    {/* Logo */}
                    <img
                        src="/Skillpulse.svg"
                        alt="SkillPulse"
                        style={{ height: "40px", width: "180px" }}
                    />

                    {/* 版权 + slogan */}
                    <div className="text-sm text-muted-foreground">
                        Copyright © 2026 SkillPulse. 学习、理解、实践，与 AI 一起成长
                    </div>

                    {/* ICP */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <a
                            href="https://beian.miit.gov.cn/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors"
                        >
                            浙ICP备2026030363号
                        </a>
                        <span>|</span>
                        <a
                            href="https://beian.miit.gov.cn/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-primary transition-colors"
                        >
                            浙ICP备2026030363号-1
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
