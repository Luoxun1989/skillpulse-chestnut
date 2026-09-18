import { WeeklyDigestBoard } from "@/components/WeeklyDigestBoard";

/**
 * 首页：Hero 宣传语 + 周刊四栏目
 */
export default function Home() {
    return (
        <>
            {/* Hero */}
            <section className="py-8 px-4 mb-4">
                <div className="max-w-7xl mx-auto text-center">
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                        <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                            学习、理解、实践，与 AI 一起成长
                        </span>
                    </h1>
                </div>
            </section>

            {/* 周刊四栏目 */}
            <div className="max-w-7xl mx-auto pb-8">
                <WeeklyDigestBoard />
            </div>
        </>
    );
}