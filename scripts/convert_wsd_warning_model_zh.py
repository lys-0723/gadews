#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert WSD risk early warning model Excel workbook to Chinese-first frontend JSON.

Usage:
  python convert_wsd_warning_model.py \
    --input "../知识库/白斑病/原网站版本/WSD风险预警模型v1.0.xlsx" \
    --output "public/data/models/wsd-warning-model.json"

Install dependency if needed:
  pip install openpyxl

This script is designed for the workbook sheets:
  1. 环境风险评分表
  2. 病原风险评分表
  3. 病症病理评分表
  4. 基础背景评分表
  5. 综合评分参数及说明表
  6. 输入模板
  7. 输出模板
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet


# -----------------------------------------------------------------------------
# Basic helpers
# -----------------------------------------------------------------------------

def clean_value(value: Any) -> Any:
    """Make Excel cell values JSON-serializable and remove noisy whitespace."""
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, str):
        text = value.strip()
        text = re.sub(r"\s+", " ", text)
        return text if text != "" else None
    return value


def slugify_key(text: Any, fallback: str = "field") -> str:
    """Create a stable key for unknown headers. Chinese is preserved when no known mapping exists."""
    if text is None:
        return fallback
    s = str(text).strip().lower()
    # Preserve Chinese by using known mapping first; unknown Chinese becomes generic.
    s = s.replace("/", "_").replace(" ", "_").replace("-", "_")
    s = re.sub(r"[^0-9a-zA-Z_\u4e00-\u9fff]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        return fallback
    return s


def make_unique(keys: Iterable[str]) -> List[str]:
    """Make duplicated column keys unique by appending _2, _3, ..."""
    seen: Dict[str, int] = {}
    result: List[str] = []
    for key in keys:
        base = key or "field"
        seen[base] = seen.get(base, 0) + 1
        if seen[base] == 1:
            result.append(base)
        else:
            result.append(f"{base}_{seen[base]}")
    return result


def truthy_enabled(value: Any) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"是", "yes", "true", "1", "启用", "enabled"}


# -----------------------------------------------------------------------------
# Header mapping: Chinese workbook headers -> frontend-friendly keys
# -----------------------------------------------------------------------------

HEADER_MAP: Dict[str, str] = {
    # Common IDs / names
    "指标编号": "indicatorId",
    "病原指标编号": "pathogenRuleId",
    "信号编号": "signalId",
    "背景指标编号": "baselineRuleId",
    "参数编号": "parameterId",
    "指标名称": "indicatorName",
    "背景指标名称": "baselineIndicatorName",
    "信号名称": "signalName",
    "措施名称": "actionName",
    "关联知识库编号": "knowledgeRefId",

    # Environment
    "指标类别": "indicatorCategory",
    "监测对象": "monitoringObject",
    "低风险条件": "lowRiskCondition",
    "中风险条件": "mediumRiskCondition",
    "高风险条件": "highRiskCondition",
    "低风险分值": "lowRiskScore",
    "中风险分值": "mediumRiskScore",
    "高风险分值": "highRiskScore",

    # Pathogen
    "检测对象": "testObject",
    "检测方法": "testMethod",
    "权重": "weight",
    "输入值/判定条件": "condition",
    "风险等级": "riskLevel",
    "风险分值": "score",
    "风险解释": "riskExplanation",
    "推荐动作": "recommendedAction",

    # Clinical/pathology
    "信号类型": "signalType",
    "观察/检测对象": "observationObject",
    "是否需要实验室确认": "requiresLabConfirmation",

    # Baseline
    "输入值/判定条件": "condition",

    # Parameters
    "参数类型": "parameterType",
    "参数名称": "parameterName",
    "参数值/规则": "parameterValue",
    "适用模块": "module",
    "说明": "description",
    "是否启用": "enabled",

    # Input/output templates
    "是否必填项": "required",
    "记录编号": "recordId",
    "输出记录编号": "outputRecordId",
    "关联输入记录编号": "inputRecordId",
    "日期": "date",
    "区域/基地": "regionOrSite",
    "养殖对象": "species",
    "养殖种类": "speciesCategory",
    "养殖模式": "farmingMode",
    "生长阶段": "growthStage",
    "水温℃": "waterTemperatureC",
    "pH": "pH",
    "养殖环境类型": "farmingEnvironmentType",
    "PCR/qPCR检测结果": "pcrQpcrResult",
    "快检结果": "rapidTestResult",
    "养殖动物qPCR 定量结果": "animalQpcrQuantitativeResult",
    "组织病理": "histopathologyResult",
    "核内嗜碱性包涵体": "basophilicIntranuclearInclusions",
    "ISH": "ishResult",
    "摄食下降": "reducedFeeding",
    "游动异常/嗜睡": "abnormalSwimmingOrLethargy",
    "池边聚集": "pondEdgeAggregation",
    "甲壳白斑": "whiteSpots",
    "红体": "redBody",
    "死亡增加": "increasedMortality",
    "暴发性死亡": "massMortality",
    "月份": "month",
    "所在区域疾病背景（所在村镇）": "localDiseaseBackground",
    "历史WSSV阳性记录": "historicalWssvPositiveRecord",

    # Output
    "环境风险分": "environmentScore",
    "病原风险分": "pathogenScore",
    "病症风险分": "clinicalScore",
    "病理风险分": "pathologyScore",
    "基础背景分": "baselineScore",
    "综合风险分": "totalScore",
    "初始风险等级": "initialRiskLevel",
    "强制升级规则": "forcedUpgradeRule",
    "是否有极端环境及应对措施": "extremeConditionAndResponse",
    "最终风险等级": "finalRiskLevel",
    "主要风险驱动因素": "mainRiskDrivers",
    "推荐行动": "recommendedAction",
    "是否建议采样检测": "samplingRecommended",
    "是否建议上报": "reportingRecommended",
    "备注": "notes",
}


# Specific frontend labels for important option values.
# Chinese-first version: keep Chinese labels as the primary display text.
VALUE_LABEL_MAP: Dict[str, str] = {
    "阴性": "阴性",
    "弱阳性": "弱阳性",
    "阳性": "阳性",
    "未检测": "未检测",
    "不适用": "不适用",
    "否": "否",
    "是": "是",
    "未观察到": "未观察到",
    "低风险": "低风险",
    "中风险": "中风险",
    "中/高风险": "中/高风险",
    "高风险": "高风险",
    "预警": "预警",
    "极高风险": "极高风险",
}


MODULE_KEY_MAP: Dict[str, str] = {
    "环境风险": "environment",
    "病原风险": "pathogen",
    "病症风险": "clinical",
    "病理风险": "pathology",
    "基础背景": "baseline",
    "综合模型": "total",
}


# -----------------------------------------------------------------------------
# Worksheet readers
# -----------------------------------------------------------------------------

def read_table(ws: Worksheet, header_row: int = 1, start_row: Optional[int] = None) -> List[Dict[str, Any]]:
    """Read a worksheet table into a list of dict rows using a chosen header row."""
    start_row = start_row or header_row + 1
    raw_headers = [clean_value(c.value) for c in ws[header_row]]

    # Drop trailing empty headers while preserving internal blanks if the row has data.
    last_non_empty = 0
    for i, h in enumerate(raw_headers, start=1):
        if h is not None:
            last_non_empty = i
    raw_headers = raw_headers[:last_non_empty]

    mapped_headers: List[str] = []
    for i, h in enumerate(raw_headers, start=1):
        if h is None:
            mapped_headers.append(f"unnamed_{i}")
        else:
            mapped_headers.append(HEADER_MAP.get(str(h), slugify_key(h, f"field_{i}")))
    headers = make_unique(mapped_headers)

    rows: List[Dict[str, Any]] = []
    for row in ws.iter_rows(min_row=start_row, max_col=len(headers), values_only=True):
        values = [clean_value(v) for v in row]
        if all(v is None for v in values):
            continue
        record: Dict[str, Any] = {}
        for key, value in zip(headers, values):
            # Skip fully unnamed blank columns unless they contain useful values.
            if key.startswith("unnamed_") and value is None:
                continue
            record[key] = value
        rows.append(record)
    return rows


def add_english_labels(row: Dict[str, Any], fields: Iterable[str]) -> Dict[str, Any]:
    """Add English label fields for known Chinese categorical values."""
    result = dict(row)
    for field in fields:
        value = result.get(field)
        if isinstance(value, str):
            result[f"{field}Label"] = VALUE_LABEL_MAP.get(value, value)
    return result


# -----------------------------------------------------------------------------
# Sheet-specific parsers
# -----------------------------------------------------------------------------

def parse_environment(ws: Worksheet) -> Dict[str, Any]:
    rows = read_table(ws, header_row=1)
    rules: List[Dict[str, Any]] = []
    for row in rows:
        if not row.get("indicatorId"):
            continue
        rules.append({
            "id": row.get("indicatorId"),
            "name": row.get("indicatorName"),
            "knowledgeRefId": row.get("knowledgeRefId"),
            "category": row.get("indicatorCategory"),
            "monitoringObject": row.get("monitoringObject"),
            "options": [
                {
                    "level": "low",
                    "label": "低风险",
                    "condition": row.get("lowRiskCondition"),
                    "score": row.get("lowRiskScore"),
                },
                {
                    "level": "medium",
                    "label": "中风险",
                    "condition": row.get("mediumRiskCondition"),
                    "score": row.get("mediumRiskScore"),
                },
                {
                    "level": "high",
                    "label": "高风险",
                    "condition": row.get("highRiskCondition"),
                    "score": row.get("highRiskScore"),
                },
            ],
            "notes": row.get("notes"),
            "raw": row,
        })
    return {"module": "environment", "rules": rules}


def parse_pathogen(ws: Worksheet) -> Dict[str, Any]:
    rows = read_table(ws, header_row=1)
    rules: List[Dict[str, Any]] = []
    for row in rows:
        if not row.get("pathogenRuleId"):
            continue
        row = add_english_labels(row, ["riskLevel", "condition"])
        rules.append({
            "id": row.get("pathogenRuleId"),
            "name": row.get("indicatorName"),
            "knowledgeRefId": row.get("knowledgeRefId"),
            "testObject": row.get("testObject"),
            "testMethod": row.get("testMethod"),
            "weight": row.get("weight", 1),
            "condition": row.get("condition"),
            "conditionLabel": row.get("conditionLabel"),
            "riskLevel": row.get("riskLevel"),
            "riskLevelLabel": row.get("riskLevelLabel"),
            "score": row.get("score"),
            "riskExplanation": row.get("riskExplanation"),
            "recommendedAction": row.get("recommendedAction"),
            "notes": row.get("notes"),
            "raw": row,
        })
    return {"module": "pathogen", "rules": rules}


def parse_clinical_pathology(ws: Worksheet) -> Dict[str, Any]:
    rows = read_table(ws, header_row=1)
    clinical: List[Dict[str, Any]] = []
    pathology: List[Dict[str, Any]] = []
    other: List[Dict[str, Any]] = []

    for row in rows:
        if not row.get("signalId"):
            continue
        row = add_english_labels(row, ["riskLevel", "condition", "requiresLabConfirmation"])
        item = {
            "id": row.get("signalId"),
            "signalType": row.get("signalType"),
            "name": row.get("signalName"),
            "knowledgeRefId": row.get("knowledgeRefId"),
            "observationObject": row.get("observationObject"),
            "condition": row.get("condition"),
            "conditionLabel": row.get("conditionLabel"),
            "riskLevel": row.get("riskLevel"),
            "riskLevelLabel": row.get("riskLevelLabel"),
            "score": row.get("score"),
            "riskExplanation": row.get("riskExplanation"),
            "requiresLabConfirmation": row.get("requiresLabConfirmation"),
            "recommendedAction": row.get("recommendedAction"),
            "notes": row.get("notes"),
            "raw": row,
        }
        signal_type = str(row.get("signalType") or "")
        rule_id = str(row.get("signalId") or "")
        if signal_type == "病症信号" or rule_id.startswith("CLIN"):
            clinical.append(item)
        elif signal_type in {"病理证据", "综合证据"} or rule_id.startswith("PATHO"):
            pathology.append(item)
        else:
            other.append(item)

    return {"module": "clinicalPathology", "clinicalRules": clinical, "pathologyRules": pathology, "otherRules": other}


def parse_baseline(ws: Worksheet) -> Dict[str, Any]:
    # This sheet has an accidental extra value in the header row in the uploaded file.
    rows = read_table(ws, header_row=1)
    rules: List[Dict[str, Any]] = []
    for row in rows:
        if not row.get("baselineRuleId"):
            continue
        row = add_english_labels(row, ["riskLevel", "condition"])
        rules.append({
            "id": row.get("baselineRuleId"),
            "name": row.get("baselineIndicatorName"),
            "category": row.get("indicatorCategory"),
            "condition": row.get("condition"),
            "conditionLabel": row.get("conditionLabel"),
            "riskLevel": row.get("riskLevel"),
            "riskLevelLabel": row.get("riskLevelLabel"),
            "score": row.get("score"),
            "riskExplanation": row.get("riskExplanation"),
            "notes": row.get("notes"),
            "raw": row,
        })
    return {"module": "baseline", "rules": rules}


def parse_range_text(value: Any) -> Dict[str, Any]:
    """Parse threshold strings like 0-120 or >240 into structured min/max."""
    if value is None:
        return {"raw": None}
    text = str(value).strip().replace("—", "-").replace("–", "-")
    # 0-120
    m = re.match(r"^\s*([0-9.]+)\s*-\s*([0-9.]+)\s*$", text)
    if m:
        return {"raw": text, "min": float(m.group(1)), "max": float(m.group(2)), "operator": "rangeInclusive"}
    # >240 or >=240
    m = re.match(r"^\s*(>=|>|≤|<=|<)\s*([0-9.]+)\s*$", text)
    if m:
        op = m.group(1).replace("≤", "<=")
        return {"raw": text, "operator": op, "value": float(m.group(2))}
    return {"raw": text}


def parse_parameters(ws: Worksheet) -> Dict[str, Any]:
    rows = read_table(ws, header_row=1)
    max_scores: Dict[str, Any] = {}
    risk_levels: List[Dict[str, Any]] = []
    forced_rules: List[Dict[str, Any]] = []
    extreme_conditions: List[Dict[str, Any]] = []
    other_params: List[Dict[str, Any]] = []

    for row in rows:
        ptype = row.get("parameterType")
        pname = row.get("parameterName")
        pval = row.get("parameterValue")
        enabled = truthy_enabled(row.get("enabled"))
        normalized_module = MODULE_KEY_MAP.get(str(row.get("module")), row.get("module"))
        item = {
            "type": ptype,
            "name": pname,
            "value": pval,
            "weight": row.get("weight"),
            "module": row.get("module"),
            "moduleKey": normalized_module,
            "description": row.get("description"),
            "enabled": enabled,
            "raw": row,
        }

        if ptype == "模块满分":
            # Map module names to frontend keys.
            max_scores[str(normalized_module)] = pval
        elif ptype == "模型总分":
            max_scores["total"] = pval
        elif ptype == "风险等级阈值":
            risk_levels.append({
                "name": pname,
                "label": VALUE_LABEL_MAP.get(str(pname), pname),
                "range": parse_range_text(pval),
                "actionMode": row.get("weight"),
                "enabled": enabled,
                "raw": row,
            })
        elif ptype == "强制升级规则":
            forced_rules.append(item)
        elif ptype == "极端条件":
            extreme_conditions.append(item)
        else:
            other_params.append(item)

    return {
        "maxScores": max_scores,
        "riskLevels": risk_levels,
        "forcedUpgradeRules": forced_rules,
        "extremeConditions": extreme_conditions,
        "otherParameters": other_params,
        "rawRows": rows,
    }


def parse_input_template(ws: Worksheet) -> Dict[str, Any]:
    """Parse the input template. Uploaded workbook uses row 1 for required flags and row 4 for field names."""
    header_row = 4
    required_row = 1
    group_row = 2
    subgroup_row = 3

    headers_raw = [clean_value(c.value) for c in ws[header_row]]
    required_raw = [clean_value(c.value) for c in ws[required_row]]
    group_raw = [clean_value(c.value) for c in ws[group_row]]
    subgroup_raw = [clean_value(c.value) for c in ws[subgroup_row]]

    fields: List[Dict[str, Any]] = []
    seen: Dict[str, int] = {}
    for idx, header in enumerate(headers_raw, start=1):
        if header is None:
            continue
        base_key = HEADER_MAP.get(str(header), slugify_key(header, f"field_{idx}"))
        seen[base_key] = seen.get(base_key, 0) + 1
        key = base_key if seen[base_key] == 1 else f"{base_key}_{seen[base_key]}"
        fields.append({
            "index": idx,
            "sourceHeader": header,
            "key": key,
            "required": truthy_enabled(required_raw[idx - 1] if idx - 1 < len(required_raw) else None),
            "group": group_raw[idx - 1] if idx - 1 < len(group_raw) else None,
            "subgroup": subgroup_raw[idx - 1] if idx - 1 < len(subgroup_raw) else None,
        })

    example_rows = read_table(ws, header_row=header_row, start_row=header_row + 1)
    return {"fields": fields, "exampleRows": example_rows}


def parse_output_template(ws: Worksheet) -> Dict[str, Any]:
    rows = read_table(ws, header_row=1)
    fields = []
    headers = [clean_value(c.value) for c in ws[1]]
    for i, h in enumerate(headers, start=1):
        if h is None:
            continue
        fields.append({"index": i, "sourceHeader": h, "key": HEADER_MAP.get(str(h), slugify_key(h, f"field_{i}"))})
    return {"fields": fields, "exampleRows": rows}


# -----------------------------------------------------------------------------
# Main conversion
# -----------------------------------------------------------------------------

def convert_workbook(input_path: Path, include_raw_sheets: bool = False) -> Dict[str, Any]:
    wb = load_workbook(input_path, data_only=True)

    required_sheets = [
        "环境风险评分表",
        "病原风险评分表",
        "病症病理评分表",
        "基础背景评分表",
        "综合评分参数及说明表",
        "输入模板",
        "输出模板",
    ]
    missing = [s for s in required_sheets if s not in wb.sheetnames]
    if missing:
        raise ValueError(f"Workbook is missing required sheets: {missing}")

    env = parse_environment(wb["环境风险评分表"])
    pathogen = parse_pathogen(wb["病原风险评分表"])
    clinical_pathology = parse_clinical_pathology(wb["病症病理评分表"])
    baseline = parse_baseline(wb["基础背景评分表"])
    params = parse_parameters(wb["综合评分参数及说明表"])
    input_template = parse_input_template(wb["输入模板"])
    output_template = parse_output_template(wb["输出模板"])

    model: Dict[str, Any] = {
        "modelName": "WSD风险预警模型",
        "modelNameEn": "WSD Early Warning Model",
        "modelNameZh": "WSD风险预警模型",
        "version": "1.0",
        "sourceWorkbook": input_path.name,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "description": "由WSD风险预警模型Excel转换得到的前端可读取JSON配置。当前版本以中文展示文本为主，同时保留稳定字段key，便于前端计算。",
        "modules": {
            "environment": {
                "maxScore": params["maxScores"].get("environment"),
                "rules": env["rules"],
            },
            "pathogen": {
                "maxScore": params["maxScores"].get("pathogen"),
                "rules": pathogen["rules"],
            },
            "clinical": {
                "maxScore": params["maxScores"].get("clinical"),
                "rules": clinical_pathology["clinicalRules"],
            },
            "pathology": {
                "maxScore": params["maxScores"].get("pathology"),
                "rules": clinical_pathology["pathologyRules"],
            },
            "baseline": {
                "maxScore": params["maxScores"].get("baseline"),
                "rules": baseline["rules"],
            },
        },
        "totalMaxScore": params["maxScores"].get("total"),
        "riskLevels": params["riskLevels"],
        "forcedUpgradeRules": params["forcedUpgradeRules"],
        "extremeConditions": params["extremeConditions"],
        "inputTemplate": input_template,
        "outputTemplate": output_template,
        "frontendNotes": [
            "当前JSON以中文展示内容为主，适合先在Warning Tools前端做中文版本展示。",
            "字段key仍保留为稳定的英文/拼音式内部key，便于TypeScript计算和表单绑定。",
            "重复的输入模板字段会自动追加_2、_3等后缀，避免JSON key冲突。",
            "前端可以优先使用name、condition、riskLevel、recommendedAction、sourceHeader等中文字段作为展示文本。",
            "Ct值规则、强制升级规则和极端条件在正式应用前仍建议交由专家复核。"
        ],
    }

    if include_raw_sheets:
        model["rawSheets"] = {
            "environment": read_table(wb["环境风险评分表"], 1),
            "pathogen": read_table(wb["病原风险评分表"], 1),
            "clinicalPathology": read_table(wb["病症病理评分表"], 1),
            "baseline": read_table(wb["基础背景评分表"], 1),
            "parameters": read_table(wb["综合评分参数及说明表"], 1),
            "inputTemplateRows": read_table(wb["输入模板"], 4, 5),
            "outputTemplateRows": read_table(wb["输出模板"], 1),
        }

    return model


def write_json(data: Dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def print_summary(model: Dict[str, Any], output_path: Path) -> None:
    modules = model.get("modules", {})
    print("WSD风险预警模型JSON生成成功。")
    print(f"输出文件: {output_path}")
    print(f"综合满分: {model.get('totalMaxScore')}")
    for key, module in modules.items():
        print(f"- {key}: maxScore={module.get('maxScore')}, rules={len(module.get('rules', []))}")
    print(f"- riskLevels: {len(model.get('riskLevels', []))}")
    print(f"- forcedUpgradeRules: {len(model.get('forcedUpgradeRules', []))}")
    print(f"- extremeConditions: {len(model.get('extremeConditions', []))}")
    print(f"- input fields: {len(model.get('inputTemplate', {}).get('fields', []))}")


def main() -> None:
    parser = argparse.ArgumentParser(description="将WSD风险预警模型Excel转换为中文优先的JSON配置。")
    parser.add_argument(
        "--input",
        "-i",
        type=Path,
        default=Path("../知识库/白斑病/原网站版本/WSD风险预警模型v1.0.xlsx"),
        help="WSD风险预警模型Excel文件路径。",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("public/data/models/wsd-warning-model.json"),
        help="输出JSON文件路径。",
    )
    parser.add_argument(
        "--include-raw-sheets",
        action="store_true",
        help="是否在JSON中包含原始解析行，便于调试。",
    )
    args = parser.parse_args()

    if not args.input.exists():
        raise FileNotFoundError(f"未找到输入Excel文件: {args.input}")

    model = convert_workbook(args.input, include_raw_sheets=args.include_raw_sheets)
    write_json(model, args.output)
    print_summary(model, args.output)


if __name__ == "__main__":
    main()
