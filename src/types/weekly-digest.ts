/**
 * 周刊内容项 - 首页四栏目
 * 公开接口：/api/weekly-digest
 *
 * 栏目 section:
 *   news      - AI 行业动态
 *   project   - 本周热门项目
 *   paper     - 本周精选论文
 *   community - 社区声音·一周热议
 */
export type WeeklyDigestSection = "news" | "project" | "paper" | "community";

export interface WeeklyDigestItem {
    id: string;
    section: WeeklyDigestSection;
    title: string;
    summary?: string;
    url: string;
    source?: string;
    sourceId?: string;
    stars?: number | null;
    commentsCount?: number | null;
    likesCount?: number | null;
    publishedDate?: string | null;
    issueNumber?: number;
    isActive?: number;
    sortOrder?: number;
    createdAt?: string;
    updatedAt?: string;
}
