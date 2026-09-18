import type { WeeklyDigestItem } from "@/types/weekly-digest";

/**
 * 本周最热 Skills/Agent - mock 数据
 * 后端暂无该 section 接口，前端先占位展示
 * 字段严格对齐 WeeklyDigestItem 类型
 */
export const MOCK_SKILL_AGENT_ITEMS: WeeklyDigestItem[] = [
    {
        id: "skill-001",
        section: "community",
        title: "Claude Code Skills：让 AI 代理拥有持久化记忆与跨会话能力",
        summary:
            "Anthropic 推出的 Claude Code Skills 机制，允许开发者将工具调用约定、行为约束写入 Skills 文件，AI 代理可跨会话复用，大幅提升生产力。",
        url: "https://docs.claude.com/en/docs/claude-code/skills",
        source: "Anthropic",
        sourceId: "claude-code-skills",
        stars: 8420,
        commentsCount: 312,
        likesCount: 1280,
        publishedDate: "2026-09-08",
    },
    {
        id: "skill-002",
        section: "community",
        title: "Smithery：聚合 12000+ MCP Skills 的统一市场",
        summary:
            "Smithery 提供 MCP Skills 发现、安装、评分一体化平台，支持一键将 Skills 接入 Claude Desktop / Cursor / Cline。",
        url: "https://smithery.ai/skills",
        source: "Smithery",
        sourceId: "smithery-marketplace",
        stars: 3150,
        commentsCount: 89,
        likesCount: 420,
        publishedDate: "2026-09-07",
    },
    {
        id: "skill-003",
        section: "community",
        title: "Cline 3.4 发布：内置 Agent Skills 自动加载机制",
        summary:
            "Cline 在 3.4 版本中引入 Skills 自动发现协议，可在打开项目时自动加载 .cline/skills 下的预设能力，减少重复 prompt。",
        url: "https://github.com/cline/cline/releases/tag/v3.4.0",
        source: "GitHub",
        sourceId: "cline-3.4",
        stars: 5120,
        commentsCount: 156,
        likesCount: 740,
        publishedDate: "2026-09-06",
    },
    {
        id: "skill-004",
        section: "community",
        title: "LobeHub Skills Hub：中文社区最活跃的 AI Skills 评测库",
        summary:
            "LobeHub 维护的 Skills Hub 收录了 800+ 经过中文用户实测的 Skills，每条带教程视频、可信度评级。",
        url: "https://lobehub.com/zh/skills",
        source: "LobeHub",
        sourceId: "lobehub-skills",
        stars: 2890,
        commentsCount: 201,
        likesCount: 633,
        publishedDate: "2026-09-05",
    },
    {
        id: "skill-005",
        section: "community",
        title: "MCP 协议正式进入 1.0 稳定版",
        summary:
            "Model Context Protocol 1.0 锁定核心 API，Skills 注册中心 / 鉴权 / 流式传输三大规范冻结，向后兼容性长期支持。",
        url: "https://modelcontextprotocol.io/specification/2025-06-18",
        source: "MCP",
        sourceId: "mcp-1.0",
        stars: 15400,
        commentsCount: 502,
        likesCount: 2200,
        publishedDate: "2026-09-04",
    },
    {
        id: "skill-006",
        section: "community",
        title: "Aider Skills：结对编程场景下的代码片段复用",
        summary:
            "Aider 新增 Skills 模块，将高频代码模板（CRUD、迁移、测试）封装为可调用 Skills，让 AI 自动补全上下文。",
        url: "https://aider.chat/2025/skills.html",
        source: "Aider",
        sourceId: "aider-skills",
        stars: 1820,
        commentsCount: 67,
        likesCount: 290,
        publishedDate: "2026-09-03",
    },
    {
        id: "skill-007",
        section: "community",
        title: "Continue 开源 Agent Skills Marketplace",
        summary:
            "Continue.dev 上线社区驱动 Skills 市场，所有 Skills 均带签名校验与社区评分，避免恶意注入。",
        url: "https://marketplace.continue.dev/",
        source: "Continue",
        sourceId: "continue-marketplace",
        stars: 1240,
        commentsCount: 45,
        likesCount: 178,
        publishedDate: "2026-09-02",
    },
    {
        id: "skill-008",
        section: "community",
        title: "Windsurf Skills：基于工作流的自动化能力组合",
        summary:
            "Codeium 的 Windsurf 编辑器推出 Skills Chain，可将多个原子 Skills 串成工作流，一键执行复杂任务。",
        url: "https://codeium.com/windsurf/skills",
        source: "Codeium",
        sourceId: "windsurf-skills",
        stars: 980,
        commentsCount: 34,
        likesCount: 156,
        publishedDate: "2026-09-01",
    },
    {
        id: "skill-009",
        section: "community",
        title: "Roo Code Skills 框架：让任意 IDE 拥有 Skills 能力",
        summary:
            "Roo Code 开源 Skills 运行时框架，可嵌入 VS Code / JetBrains / Vim，让任何编辑器都能调用 Anthropic / OpenAI 的 Skills。",
        url: "https://github.com/RooCodeInc/Roo-Code/skills",
        source: "GitHub",
        sourceId: "roo-code-skills",
        stars: 670,
        commentsCount: 28,
        likesCount: 95,
        publishedDate: "2026-08-31",
    },
    {
        id: "skill-010",
        section: "community",
        title: "Zed 编辑器加入 Skills 生态：极简高性能方案",
        summary:
            "Zed 与 Anthropic 合作推出原生 Skills 支持，延迟低于 50ms，适合对响应速度有要求的开发者。",
        url: "https://zed.dev/blog/skills",
        source: "Zed",
        sourceId: "zed-skills",
        stars: 540,
        commentsCount: 21,
        likesCount: 78,
        publishedDate: "2026-08-30",
    },
];