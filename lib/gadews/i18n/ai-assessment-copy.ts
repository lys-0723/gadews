import type { Locale } from "./locale";
const fields: Record<string, readonly [string,string]> = {
  waterTemperature:["水温","Water temperature"],dissolvedOxygen:["溶氧","Dissolved oxygen"],
  "laboratory.fish_tissue":["鱼体检测","Fish testing"],"laboratory.environment":["环境检测","Environmental testing"],
  "clinical.signsPresent":["异常表现","Abnormal signs"],"clinical.persistentAbnormality":["持续异常","Persistent abnormality"],
  "mortality.abnormalityReported":["死亡异常","Abnormal mortality"],"mortality.abnormalityPersistent":["死亡异常持续","Persistent mortality abnormality"],
  waterTemperatureC:["塘口水温","Pond water temperature"],ph:["塘口pH","Pond pH"],farmingEnvironmentType:["养殖水体","Water environment"],
  pcrQpcrResult:["鱼虾体PCR/qPCR","Animal PCR/qPCR"],rapidTestResult:["现场快检","Rapid test"],environmentalSampleResult:["环境检测","Environmental testing"],liveFeedResult:["鲜活饵料检测","Live-feed testing"],ctValue:["Ct值","Ct value"],
  reducedFeeding:["摄食下降","Reduced feeding"],abnormalSwimming:["游动异常","Abnormal swimming"],pondEdgeAggregation:["池边聚集","Pond-edge aggregation"],whiteSpots:["白斑","White spots"],redBody:["红体","Red body"],softShell:["软壳","Soft shell"],increasedMortality:["死亡增加","Increased mortality"],massMortality:["大规模死亡","Mass mortality"],birdAggregation:["鸟类聚集","Bird aggregation"],
  pathologyResult:["组织病理","Histopathology"],ishResult:["原位杂交","ISH"],species:["养殖物种","Farmed species"],farmingMode:["养殖模式","Farming mode"],month:["月份","Month"],regionalDiseaseBackground:["区域背景","Regional background"],historicalWssvPositiveRecord:["历史阳性记录","Historical positive record"],
};
export function aiFieldLabel(field: string, fallback: string, locale: Locale): string { return fields[field]?.[locale === "zh-CN" ? 0 : 1] ?? fallback; }
