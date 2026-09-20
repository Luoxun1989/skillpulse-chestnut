import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/api-config";

/**
 * 公开 BFF：周刊全库搜索
 * GET /api/weekly-digest/search?q=openai&limit=20
 */
// 强制动态渲染：读取 request.url 与 no-store fetch 后端，不可静态预渲染
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q");
        const limit = searchParams.get("limit") || "20";

        if (!q || !q.trim()) {
            return NextResponse.json({ success: true, message: null, data: [] });
        }

        const res = await fetch(
            `${API_BASE}/api/weekly-digest/search?q=${encodeURIComponent(q.trim())}&limit=${limit}`,
            { cache: "no-store" }
        );
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("[BFF] weekly-digest search error:", error);
        return NextResponse.json(
            { success: false, message: "搜索失败", data: [] },
            { status: 500 }
        );
    }
}
