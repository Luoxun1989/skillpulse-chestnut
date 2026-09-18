import { NextResponse } from "next/server";
import { API_BASE } from "@/lib/api-config";

/**
 * 公开 BFF：往期回顾期号列表
 * GET /api/weekly-digest/issues
 */
// 强制动态渲染：no-store fetch 后端，不可静态预渲染
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const res = await fetch(`${API_BASE}/api/weekly-digest/issues`, {
            cache: "no-store",
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("[BFF] weekly-digest issues error:", error);
        return NextResponse.json(
            { success: false, message: "获取期号列表失败", data: [] },
            { status: 500 }
        );
    }
}
