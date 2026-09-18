import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/api-config";

/**
 * 公开 BFF：周刊按栏目查询
 * GET /api/weekly-digest?section=news&issue=36&limit=5
 */
// 强制动态渲染：读取 request.url 与 no-store fetch 后端，不可静态预渲染
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const section = searchParams.get("section");
        const issue = searchParams.get("issue");
        const limit = searchParams.get("limit") || "5";

        if (!section) {
            return NextResponse.json(
                { success: false, message: "栏目 section 不能为空", data: [] },
                { status: 400 }
            );
        }

        const params = new URLSearchParams({ section, limit });
        if (issue) params.append("issue", issue);

        const res = await fetch(`${API_BASE}/api/weekly-digest?${params}`, {
            cache: "no-store",
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("[BFF] weekly-digest list error:", error);
        return NextResponse.json(
            { success: false, message: "获取周刊内容失败", data: [] },
            { status: 500 }
        );
    }
}
