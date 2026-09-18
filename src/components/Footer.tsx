/**
 * 首页 Footer（精简版）
 * 保留品牌区（Logo + slogan + 二维码）+ 友情链接 + 版权/ICP
 * 去掉邮箱订阅、打赏弹窗、反馈弹窗、Auth 依赖
 */

const friendLinks = [
    { name: "SkillSMP", href: "https://skillsmp.com/" },
    { name: "Smithery", href: "https://smithery.ai/skills" },
    { name: "LobeHub", href: "https://lobehub.com/zh/skills" },
    { name: "SkillHub", href: "https://skillhub.cn/" },
    { name: "AgentSkill", href: "https://agentskill.sh/" },
];

const footerLinks = [
    { name: "服务协议", href: "/terms" },
    { name: "隐私协议", href: "/privacy" },
    { name: "关于我们", href: "/about" },
];

export function Footer() {
    return (
        <footer className="border-t bg-slate-50 dark:bg-slate-950 mt-auto">
            <div className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 品牌介绍 */}
                    <div>
                        {/* Logo */}
                        <div className="mb-3">
                            <img
                                src="/Skillpulse.svg"
                                alt="SkillPulse"
                                style={{ height: "48px", width: "216px" }}
                            />
                        </div>

                        {/* 社区二维码 */}
                        <div>
                            <h4 className="font-semibold mb-2 text-base">加入社区</h4>
                            <div className="grid grid-cols-2 gap-1" style={{ width: "400px" }}>
                                <div className="text-center">
                                    <img
                                        src="/wx_skillpulse.jpg"
                                        alt="公众号"
                                        className="w-16 h-16 mx-auto rounded-lg object-cover"
                                    />
                                    <span className="text-sm text-muted-foreground mt-1 block">公众号</span>
                                </div>
                                <div className="text-center">
                                    <img
                                        src="/qq_skillpulse.jpg"
                                        alt="QQ群"
                                        className="w-16 h-16 mx-auto rounded-lg object-cover"
                                    />
                                    <span className="text-sm text-muted-foreground mt-1 block">QQ群</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 快捷入口 + 友情链接 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 快捷入口 */}
                        <div>
                            <h4 className="font-semibold mb-2 text-base">快捷入口</h4>
                            <ul className="space-y-1">
                                {footerLinks.map((link) => (
                                    <li key={link.name}>
                                        <a
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            {link.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* 友情链接 */}
                        <div>
                            <h4 className="font-semibold mb-2 text-base">友情链接</h4>
                            <ul className="space-y-1">
                                {friendLinks.map((link) => (
                                    <li key={link.name}>
                                        <a
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            {link.name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 底部版权信息 */}
                <div className="mt-6 pt-4 border-t flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
                    <div>
                        <span>
                            Copyright © 2026 SkillPulse. 学习、理解、实践，与 AI 一起成长
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
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
