import { StickyHeader } from "@/components/gadews/sticky-header";
import { Footer } from "@/components/gadews/footer";
import { OverviewContent } from "@/components/gadews/overview/overview-content";

export const metadata = {
  title: "全球总览 · Global Overview | GADEWS",
  description: "区域气象、公开疾病报告与可追溯的风险筛查入口。Regional weather snapshots, public disease reports and traceable risk screening tools.",
};
export default function OverviewPage() {
  return <main className="min-h-screen bg-[#eaf3f5] text-slate-900"><StickyHeader variant="light" /><OverviewContent /><Footer /></main>;
}
