export interface WarningField {
  key: string;
  label: string;
  group: "context" | "environment" | "laboratory" | "clinical" | "background";
  type: "text" | "number" | "select" | "boolean";
  unit?: string;
  options?: Array<{ value: string; label: string }>;
}
const lab = [
  { value: "negative", label: "Negative" }, { value: "weak_positive", label: "Weak positive" },
  { value: "positive", label: "Positive" }, { value: "strong_positive", label: "Strong positive" },
  { value: "not_tested", label: "Not tested" }, { value: "inconclusive", label: "Inconclusive" },
];
export const WSD_FIELDS: WarningField[] = [
  { key: "regionOrSite", label: "Region / site", group: "context", type: "text" },
  { key: "farmOrPondId", label: "Farm / pond ID", group: "context", type: "text" },
  { key: "species", label: "Species", group: "context", type: "select", options: [{ value: "凡纳滨对虾", label: "Whiteleg shrimp" }, { value: "斑节对虾", label: "Giant tiger prawn" }, { value: "克氏原螯虾", label: "Red swamp crayfish" }, { value: "罗氏沼虾", label: "Giant freshwater prawn" }, { value: "其他甲壳类", label: "Other crustaceans" }] },
  { key: "farmingMode", label: "Farming mode", group: "context", type: "select", options: [{ value: "普通池塘", label: "Pond culture" }, { value: "稻虾连作", label: "Rice–crayfish rotation" }, { value: "工厂化养殖", label: "Indoor / intensive culture" }, { value: "大水面养殖", label: "Large waterbody" }, { value: "其他", label: "Other" }] },
  { key: "month", label: "Observation month", group: "context", type: "number" },
  { key: "waterTemperatureC", label: "Pond water temperature", group: "environment", type: "number", unit: "°C" },
  { key: "ph", label: "Pond pH", group: "environment", type: "number" },
  { key: "farmingEnvironmentType", label: "Water environment", group: "environment", type: "select", options: [{ value: "淡水养殖", label: "Freshwater" }, { value: "海水养殖", label: "Marine" }, { value: "半咸水养殖", label: "Brackish water" }] },
  ...[ ["pcrQpcrResult", "Animal PCR / qPCR"], ["rapidTestResult", "Rapid test"], ["environmentalSampleResult", "Environmental WSSV test"], ["liveFeedResult", "Live feed WSSV test"], ["ishResult", "ISH result"] ].map(([key, label]): WarningField => ({ key, label, group: "laboratory", type: "select", options: lab })),
  { key: "ctValue", label: "Animal qPCR Ct (optional)", group: "laboratory", type: "number" },
  { key: "pathologyResult", label: "Histopathology", group: "laboratory", type: "select", options: [{ value: "negative", label: "No typical lesions" }, { value: "suspicious", label: "Suspicious lesions" }, { value: "typical", label: "Typical pathology positive" }, { value: "not_tested", label: "Not examined" }, { value: "inconclusive", label: "Inconclusive" }] },
  ...[ ["reducedFeeding", "Reduced feeding"], ["abnormalSwimming", "Abnormal swimming / lethargy"], ["pondEdgeAggregation", "Pond-edge aggregation"], ["whiteSpots", "White spots on carapace"], ["redBody", "Red body"], ["softShell", "Soft / easily peeled shell"], ["increasedMortality", "Increased mortality"], ["massMortality", "Acute mass mortality"], ["birdAggregation", "Abnormal bird aggregation"] ].map(([key, label]): WarningField => ({ key, label, group: "clinical", type: "boolean" })),
  { key: "regionalDiseaseBackground", label: "Regional disease background", group: "background", type: "select", options: [{ value: "无", label: "No known signal" }, { value: "QAAD/WAHIS区域背景", label: "Public regional snapshot signal" }, { value: "周边疑似或确诊", label: "Nearby suspected / confirmed signal" }, { value: "unknown", label: "Unknown" }] },
  { key: "historicalWssvPositiveRecord", label: "Historical WSSV-positive record", group: "background", type: "boolean" },
];
export const WARNING_GROUPS = [
  { id: "context", title: "Farm context", description: "Identify the observation. No values are assumed." },
  { id: "environment", title: "Pond environment", description: "Use measured pond water values, not regional air temperature." },
  { id: "laboratory", title: "Laboratory evidence", description: "Keep animal, environmental and pathology evidence separate." },
  { id: "clinical", title: "Observed signs", description: "Not recorded, no and yes are different observations." },
  { id: "background", title: "Background evidence", description: "Historical and regional signals provide context, not a diagnosis." },
] as const;

export function fieldValue(field: WarningField, value: string): string | number | boolean | undefined {
  if (value === "") return undefined;
  if (field.type === "boolean") return value === "yes" ? true : value === "no" ? false : value;
  // Keep numeric text intact while editing; the assessment validates and parses it.
  return value;
}

export const WSD_WORKBENCH_EXAMPLE: Record<string, string | number | boolean> = {
  regionOrSite: "Example region", farmOrPondId: "Example pond", species: "凡纳滨对虾", farmingMode: "普通池塘", month: 6,
  waterTemperatureC: 30, ph: 8.2, farmingEnvironmentType: "海水养殖", pcrQpcrResult: "positive", rapidTestResult: "negative",
  environmentalSampleResult: "negative", liveFeedResult: "negative", pathologyResult: "negative", ishResult: "negative",
  reducedFeeding: false, abnormalSwimming: false, pondEdgeAggregation: false, whiteSpots: false, redBody: true, softShell: false,
  increasedMortality: false, massMortality: false, birdAggregation: false, regionalDiseaseBackground: "无", historicalWssvPositiveRecord: false,
};
