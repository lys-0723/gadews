export interface LiteratureItem {
  Title: string;
  Authors: string;
  "Journal/Publisher": string;
  Pub_Year: number;
  DOI: string;
  Abstract: string;
  Category: string;
  file_name: string;
  collection: "wssv" | "streptococcosis";
}

export const literatureCopy = {
  bank: ["知识库", "Knowledge bank"],
  home: ["首页", "Home"],
  repository: ["文献资料库", "Literature repository"],
  heading: ["让风险判断有据可查。", "Evidence for better risk review."],
  intro: ["按病种检索科学文献。保留文章原文、来源和全文入口，支持专家核对预警依据。", "Explore research by disease. Original articles, sources and full-text links support expert review of early warning evidence."],
  original: ["原始资料原文", "Original source text"],
  originalNote: ["标题、作者、期刊及摘要保留资料原文；分类与操作说明随界面语言切换。", "Titles, authors, journals and abstracts retain their source language; categories and controls follow your interface language."],
  papers: ["篇文献", "Papers"],
  categories: ["个分类", "Categories"],
  collections: ["个病种集合", "Disease collections"],
  recent: ["近期文献 · 保留原文", "Recent papers · original text"],
  browse: ["浏览该集合", "Browse collection"],
  all: ["全部", "All"],
  enter: ["进入完整文献库", "Open full repository"],
  research: ["科学文献与参考资料", "Literature and research"],
  search: ["检索文献", "Search literature"],
  searchPlaceholder: ["检索标题、作者、摘要或期刊", "Search title, author, abstract or journal"],
  clear: ["清除搜索", "Clear search"],
  sort: ["年份排序", "Sort by year"],
  newest: ["年份：从新到旧", "Year: newest first"],
  oldest: ["年份：从旧到新", "Year: oldest first"],
  grid: ["卡片视图", "Grid view"],
  list: ["列表视图", "List view"],
  loading: ["正在加载文献…", "Loading literature…"],
  error: ["文献资料加载失败。", "Failed to load literature data."],
  retry: ["重试", "Retry"],
  empty: ["没有找到文献。", "No papers found."],
  emptyHelp: ["请调整检索词或分类筛选。", "Try adjusting your search or filter."],
  results: ["当前结果", "Matching papers"],
  noAbstract: ["暂无摘要。", "No abstract available."],
  expand: ["展开摘要", "Expand abstract"],
  collapse: ["收起摘要", "Collapse abstract"],
  fullText: ["全文", "Full text"],
  doi: ["DOI 链接", "DOI link"],
  close: ["关闭详情", "Close details"],
  authors: ["作者", "Authors"],
  year: ["年份", "Year"],
  category: ["分类", "Category"],
  journal: ["期刊 / 出版机构", "Journal / publisher"],
  unknownPublisher: ["出版机构未提供", "Publisher not provided"],
  abstract: ["摘要 · 原文", "Abstract · original text"],
  title: ["标题", "Title"],
  read: ["阅读", "Read"],
  collectionTitle: ["选择病种，追溯证据。", "Choose a disease. Trace the evidence."],
} as const;

export const knowledgeCollections = [
  { id: "wssv", label: ["白斑综合征（WSSV）", "WSSV"], sublabel: ["虾类 · 病毒性疾病", "Shrimp · viral disease"], description: ["查阅白斑综合征病毒的病原、诊断、生态及防控研究。", "Research on white spot syndrome virus, diagnostics, ecology and prevention."] },
  { id: "streptococcosis", label: ["罗非鱼链球菌病", "Tilapia streptococcosis"], sublabel: ["罗非鱼 · 细菌性疾病", "Tilapia · bacterial disease"], description: ["查阅链球菌病的致病机制、流行病学、诊断及防控研究。", "Research on streptococcal virulence, epidemiology, diagnostics and control."] },
] as const;

const categoryNames: Record<string, readonly [string, string]> = {
  "病原学": ["病原学", "Pathogen biology"],
  "病原致病力及分子基础": ["致病力与分子机制", "Virulence and molecular mechanisms"],
  "国际权威组织": ["国际组织资料", "International organizations"],
  "病原生态学": ["病原生态学", "Pathogen ecology"],
  "流行危害": ["流行与危害", "Epidemiology and impact"],
  "流行病学": ["流行病学", "Epidemiology"],
  "临床诊断": ["临床诊断", "Clinical diagnosis"],
  "预防控制措施": ["预防控制", "Prevention and control"],
  "预防控制": ["预防控制", "Prevention and control"],
};
export function literatureCategory(category: string) { return category.split("-").slice(1).join("-") || category; }
export function categoryCopy(category: string): readonly [string, string] { const key = literatureCategory(category); return categoryNames[key] ?? [key, key]; }
export function doiLink(doi: string) { return doi.startsWith("http") ? doi : `https://doi.org/${doi}`; }
export function literatureFullText(item: LiteratureItem) { return `http://59.110.161.54/literature/${encodeURIComponent(item.file_name)}`; }
