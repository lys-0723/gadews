#!/usr/bin/env python3
"""Deterministically publish the controlled tilapia draft workbook using stdlib.

No formulas/macros are executed, no sources are fetched, and --check is read-only.
All cell text, cached values, formula text and hyperlink targets remain traceable.
"""
import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import posixpath
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile


ROOT = Path(__file__).resolve().parent.parent
WORKBOOK = ROOT.parent / "知识库/罗非鱼链球菌病/罗非鱼链球菌病_结构化知识库_v1.0_20261027.xlsx"
OUTPUT = ROOT / "public/data/knowledge/tilapia-streptococcosis.json"
EXPECTED_SHA256 = "a13f014303048d75e87340e17b30b7d4cdf0de30c56d0d56082754d2fa629f6b"
PUBLISHED_SHA256 = "8604ee26b9bc0cd86731b5ee957054bdb9c881d347b1843f84dc5cf844a9e88c"
RESOURCE_ID = "tilapia-streptococcosis-v1.0"
S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
P = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"s": S}
SHEETS = (
    "00_框架与使用", "01_疾病基础档案", "02_病原基础档案", "03_宿主易感性",
    "04_综合征与临床症状", "05_风险因子分类表", "06_环境阈值与触发条件",
    "07_诊断方法", "08_防控措施", "09_预警规则表", "10_证据事实表",
    "11_核实来源", "12_原150条核查", "13_字段与接入字典", "14_参数与验证",
)
DETERMINISTIC_IDS = {f"TST-WARN-{n:03}" for n in (2, 3, 7, 8, 11, 12, 14, 15, 16, 18, 20, 21, 22)}
# Columns consumed by normalization/reference validation are a fixed source
# contract. Other columns are also retained in full, without reinterpretation.
REQUIRED_HEADERS = (
    {"A": "模块", "B": "记录数"},
    {"A": "疾病编号", "E": "病原编号", "Y": "证据编号", "Z": "来源编号"},
    {"A": "病原编号", "B": "关联疾病编号", "S": "证据编号", "T": "来源编号"},
    {"A": "宿主记录编号", "B": "关联疾病编号", "C": "关联病原编号", "N": "证据编号", "O": "来源编号"},
    {"A": "症状记录编号", "B": "关联疾病编号", "C": "关联病原编号", "N": "证据编号", "O": "来源编号"},
    {"A": "风险因子编号", "B": "关联疾病编号", "C": "关联病原编号", "O": "证据编号", "P": "来源编号"},
    {"A": "触发条件编号", "B": "关联疾病编号", "C": "关联病原编号", "D": "关联风险因子编号", "E": "指标名称", "H": "触发条件", "J": "风险逻辑", "Q": "证据编号", "R": "来源编号", "X": "参数编号", "Y": "候选数值", "Z": "单位", "AA": "持续时间候选_h", "AC": "生产启用"},
    {"A": "诊断方法编号", "B": "关联疾病编号", "C": "关联病原编号", "Q": "证据编号", "R": "来源编号"},
    {"A": "措施编号", "B": "关联疾病编号", "C": "关联病原编号", "O": "证据编号", "P": "来源编号"},
    {"A": "预警规则编号", "B": "关联疾病编号", "C": "关联病原编号", "D": "规则名称", "H": "关联触发条件编号", "I": "关联症状编号", "J": "关联诊断方法编号", "K": "关联防控措施编号", "L": "判定逻辑", "R": "启用状态", "U": "证据编号", "V": "来源编号"},
    {"A": "证据编号", "C": "来源编号", "F": "已核实结果（转述）", "G": "局限与不可外推事项", "J": "访问层级"},
    {"A": "来源编号", "B": "文献题名", "F": "DOI", "G": "直接访问链接", "H": "实际访问层级", "K": "证据编号", "N": "访问核查链接"},
    {"A": "原文献编号", "J": "相关替代来源（不代表同篇）"},
    {"A": "所属表/场景", "C": "机器字段建议", "I": "设计依据证据", "J": "来源编号"},
    {"A": "条目编号", "B": "条目类型", "C": "关联条目", "D": "定义或候选内容", "E": "候选数值", "F": "单位", "G": "正式采用值", "J": "核对方法或验收指标", "L": "证据编号", "M": "来源编号", "N": "签署人（待填）", "O": "签署日期（待填）"},
)
# Reference targets are worksheet indices; -1 means any declared entity.
REFERENCE_COLUMNS = {
    1: {"E": 2, "Y": 10, "Z": 11},
    2: {"B": 1, "S": 10, "T": 11},
    3: {"B": 1, "C": 2, "N": 10, "O": 11},
    4: {"B": 1, "C": 2, "N": 10, "O": 11},
    5: {"B": 1, "C": 2, "O": 10, "P": 11},
    6: {"B": 1, "C": 2, "D": 5, "Q": 10, "R": 11, "X": 14},
    7: {"B": 1, "C": 2, "Q": 10, "R": 11},
    8: {"B": 1, "C": 2, "O": 10, "P": 11},
    9: {"B": 1, "C": 2, "H": 6, "I": 4, "J": 7, "K": 8, "U": 10, "V": 11},
    10: {"C": 11}, 11: {"K": 10}, 12: {"J": 11},
    13: {"I": 10, "J": 11}, 14: {"C": -1, "L": 10, "M": 11},
}
ID_PATTERNS = {1: r"TST", 2: r"SAG|SIN", 3: r"TST-HOST-\d{3}", 4: r"TST-SYM-\d{3}", 5: r"TST-RF-\d{3}", 6: r"TST-TRG-\d{3}", 7: r"TST-DIAG-\d{3}", 8: r"TST-CTRL-\d{3}", 9: r"TST-WARN-\d{3}", 10: r"E\d{2}", 11: r"S\d{2}", 12: r"[1-9]\d*", 14: r"[PVM]\d{2}"}


class ConversionError(ValueError):
    """An explicit input/contract failure that must not publish partial data."""


def _relationships(archive, path):
    if path not in archive.namelist():
        return {}
    root = ET.fromstring(archive.read(path))
    result = {}
    for relationship in root.findall(f"{{{P}}}Relationship"):
        identity = relationship.get("Id")
        if identity in result:
            raise ConversionError(f"duplicate relationship ID {identity} in {path}")
        result[identity] = relationship.attrib
    return result


def _target_path(base_path, target):
    path = posixpath.normpath(posixpath.join(posixpath.dirname(base_path), target)) if not target.startswith("/") else target.lstrip("/")
    if path.startswith("../"):
        raise ConversionError(f"invalid XLSX relationship target: {target}")
    return path


def _text(element):
    return "".join(t.text or "" for t in element.iter(f"{{{S}}}t")) if element is not None else ""


def read_workbook(workbook_bytes):
    """Extract original cell contents and actual links without executing Excel."""
    try:
        with zipfile.ZipFile(io.BytesIO(workbook_bytes)) as archive:
            strings = []
            if "xl/sharedStrings.xml" in archive.namelist():
                strings = [_text(si) for si in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", NS)]
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            relationships = _relationships(archive, "xl/_rels/workbook.xml.rels")
            tables = []
            names = set()
            for sheet in workbook.findall("s:sheets/s:sheet", NS):
                name = sheet.get("name")
                if name in names:
                    raise ConversionError(f"duplicate sheet: {name}")
                names.add(name)
                identity = sheet.get(f"{{{R}}}id")
                if identity not in relationships:
                    raise ConversionError(f"missing sheet relationship: {name} {identity}")
                path = _target_path("xl/workbook.xml", relationships[identity]["Target"])
                root = ET.fromstring(archive.read(path))
                rows = []
                row_by_number = {}
                for row_element in root.findall("s:sheetData/s:row", NS):
                    number = int(row_element.get("r"))
                    if number in row_by_number:
                        raise ConversionError(f"duplicate row: {name} {number}")
                    cells = {}
                    for cell in row_element.findall("s:c", NS):
                        ref = cell.get("r", "")
                        if not re.fullmatch(r"[A-Z]+" + str(number), ref) or ref in cells:
                            raise ConversionError(f"invalid/duplicate cell: {name} {ref}")
                        value = cell.find("s:v", NS)
                        raw = value.text or "" if value is not None else ""
                        if cell.get("t") == "s":
                            try:
                                raw = strings[int(raw)]
                            except (ValueError, IndexError) as exc:
                                raise ConversionError(f"invalid shared string: {name} {ref}") from exc
                        elif cell.get("t") == "inlineStr":
                            raw = _text(cell.find("s:is", NS))
                        cells[ref] = raw
                        formula = cell.find("s:f", NS)
                        if formula is not None:
                            cells[ref + "__formula"] = formula.text or ""
                    if cells:
                        row = {"row": number, "cells": cells, "hyperlinks": {}}
                        rows.append(row)
                        row_by_number[number] = row
                rel_path = posixpath.join(posixpath.dirname(path), "_rels", posixpath.basename(path) + ".rels")
                links = _relationships(archive, rel_path)
                for link in root.findall("s:hyperlinks/s:hyperlink", NS):
                    ref = link.get("ref", "")
                    identity = link.get(f"{{{R}}}id")
                    if identity and identity not in links:
                        raise ConversionError(f"missing hyperlink relationship: {name} {ref} {identity}")
                    target = links[identity].get("Target") if identity else link.get("location")
                    match = re.fullmatch(r"[A-Z]+([1-9]\d*)", ref)
                    if not match or int(match.group(1)) not in row_by_number or not target:
                        raise ConversionError(f"invalid hyperlink: {name} {ref}")
                    row_by_number[int(match.group(1))]["hyperlinks"][ref] = target
                header_row = 2 if name == SHEETS[0] else 1
                header = row_by_number.get(header_row, {"cells": {}})
                headers = {re.sub(r"\d+$", "", ref): value for ref, value in header["cells"].items() if not ref.endswith("__formula")}
                tables.append({"name": name, "headers": headers, "rows": rows})
            return tables
    except (zipfile.BadZipFile, KeyError, ET.ParseError, TypeError, OSError) as exc:
        raise ConversionError(f"invalid XLSX structure: {exc}") from exc


def _value(row, column):
    return row["cells"].get(f"{column}{row['row']}", "")


def _ids(value):
    return [part.strip() for part in re.split(r"[;；]", value) if part.strip()]


def _data_rows(table):
    return [row for row in table["rows"] if row["row"] > (2 if table["name"] == SHEETS[0] else 1) and any(value != "" for ref, value in row["cells"].items() if not ref.endswith("__formula"))]


def _validate_tables(tables):
    by_name = {table["name"]: table for table in tables}
    for name in SHEETS:
        if name not in by_name:
            raise ConversionError(f"missing sheet: {name}")
    unexpected = set(by_name) - set(SHEETS)
    if unexpected:
        raise ConversionError(f"unexpected sheets: {sorted(unexpected)}")
    ordered = [by_name[name] for name in SHEETS]
    registry = {}
    for index, table in enumerate(ordered):
        for column, header in REQUIRED_HEADERS[index].items():
            if table["headers"].get(column) != header:
                raise ConversionError(f"required column: {table['name']} {column} expected {header!r}")
        registry[index] = set()
        for row in _data_rows(table):
            if index in ID_PATTERNS:
                identity = _value(row, "A")
                if not identity:
                    raise ConversionError(f"missing ID: {table['name']} row {row['row']}")
                if not re.fullmatch(ID_PATTERNS[index], identity):
                    raise ConversionError(f"invalid ID: {table['name']} A{row['row']} {identity}")
                if identity in registry[index]:
                    raise ConversionError(f"duplicate ID: {identity} in {table['name']} row {row['row']}")
                registry[index].add(identity)
            elif index == 13:
                # Machine names may be reused by different source tables.
                key = (_value(row, "A"), _value(row, "C"))
                if not all(key) or key in registry[index]:
                    raise ConversionError(f"invalid/duplicate dictionary key: {table['name']} row {row['row']} {key}")
                registry[index].add(key)
    all_ids = set().union(*(registry[i] for i in ID_PATTERNS))
    for index, columns in REFERENCE_COLUMNS.items():
        for row in _data_rows(ordered[index]):
            for column, target_index in columns.items():
                value = _value(row, column)
                if index == 14 and column == "C" and value == "全部规则":
                    continue
                references = re.findall(r"(?<![A-Za-z0-9_-])S\d+(?![A-Za-z0-9_-])", value) if index == 12 else _ids(value)
                declared = all_ids if target_index == -1 else registry[target_index]
                if index == 6 and column == "X":
                    declared = {identity for identity in registry[14] if identity.startswith("P")}
                elif index == 14 and column == "C":
                    if _value(row, "A").startswith("P"):
                        declared = registry[6]
                    elif _value(row, "A").startswith("V"):
                        declared = registry[9]
                if index == 12 and value and not references:
                    raise ConversionError(f"unknown reference: {ordered[index]['name']} {column}{row['row']} -> {value}")
                for reference in references:
                    if reference not in declared:
                        raise ConversionError(f"unknown reference: {ordered[index]['name']} {column}{row['row']} -> {reference}")
    for index, prefix, count in [(6, "TST-TRG-", 22), (9, "TST-WARN-", 22), (14, "P", 14), (14, "V", 12)]:
        expected = {f"{prefix}{n:03}" if index != 14 else f"{prefix}{n:02}" for n in range(1, count + 1)}
        actual = {identity for identity in registry[index] if identity.startswith(prefix)}
        if actual != expected:
            raise ConversionError(f"ID registry mismatch: {ordered[index]['name']}; missing {sorted(expected - actual)}, unexpected {sorted(actual - expected)}")
    for index, column, expected, label in [(9, "R", "草案禁用", "draft state"), (6, "AC", "否", "production must remain disabled")]:
        for row in _data_rows(ordered[index]):
            if _value(row, column) != expected:
                raise ConversionError(f"{label}: {ordered[index]['name']} {column}{row['row']}")
    for row in _data_rows(ordered[14]):
        if _value(row, "A").startswith("P"):
            for column, label in [("G", "adopted value must remain empty"), ("N", "signed by must remain empty"), ("O", "signed at must remain empty")]:
                if _value(row, column) != "":
                    raise ConversionError(f"{label}: {SHEETS[14]} {column}{row['row']}")
    return ordered


def _record(row, sheet):
    return {"id": _value(row, "A"), "sourceRefs": [{"sheet": sheet, "row": row["row"]}], "original": row}


def _number(value, location):
    if value == "":
        return None
    try:
        result = float(value)
    except ValueError as exc:
        raise ConversionError(f"invalid candidate number: {location} {value}") from exc
    if not math.isfinite(result):
        raise ConversionError(f"invalid candidate number: {location} {value}")
    return int(result) if result.is_integer() else result


def build_resource(workbook, expected_sha256=EXPECTED_SHA256):
    """Validate a workbook completely, then build its reproducible JSON value."""
    workbook = Path(workbook)
    try:
        data = workbook.read_bytes()
    except OSError as exc:
        raise ConversionError(f"missing/unreadable workbook: {workbook}: {exc}") from exc
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected_sha256:
        raise ConversionError(f"SHA-256 mismatch: {workbook.name}: expected {expected_sha256}, got {digest}")
    tables = _validate_tables(read_workbook(data))
    rows = {index: _data_rows(table) for index, table in enumerate(tables)}
    parameters = []
    for row in rows[14]:
        if not _value(row, "A").startswith("P"):
            continue
        parameter = _record(row, SHEETS[14])
        parameter.update(relatedIds=_ids(_value(row, "C")), candidateValue=_number(_value(row, "E"), f"{SHEETS[14]} E{row['row']}"), candidateDurationHours=None, adoptedValue=None, signedBy=None, signedAt=None)
        parameters.append(parameter)
    parameter_by_id = {parameter["id"]: parameter for parameter in parameters}
    triggers = []
    for row in rows[6]:
        trigger = _record(row, SHEETS[6])
        trigger.update(name=_value(row, "E"), pathogenIds=_ids(_value(row, "C")), evidenceIds=_ids(_value(row, "Q")), sourceIds=_ids(_value(row, "R")), parameterIds=sorted(set(_ids(_value(row, "X"))) | {p["id"] for p in parameters if trigger["id"] in p["relatedIds"]}), logic=_value(row, "H"), enablement="draft_disabled")
        for identity in trigger["parameterIds"]:
            parameter = parameter_by_id[identity]
            if trigger["id"] not in parameter["relatedIds"]:
                parameter["relatedIds"].append(trigger["id"])
            duration = _number(_value(row, "AA"), f"{SHEETS[6]} AA{row['row']}")
            if duration is not None:
                old_duration = parameter["candidateDurationHours"]
                if old_duration is not None and old_duration != duration:
                    raise ConversionError(f"conflicting candidate duration: {identity} {trigger['id']}")
                parameter["candidateDurationHours"] = duration
        triggers.append(trigger)
    trigger_by_id = {trigger["id"]: trigger for trigger in triggers}
    rules = []
    for row in rows[9]:
        rule = _record(row, SHEETS[9])
        trigger_ids = _ids(_value(row, "H"))
        rule.update(name=_value(row, "D"), pathogenIds=_ids(_value(row, "C")), triggerIds=trigger_ids, evidenceIds=_ids(_value(row, "U")), sourceIds=_ids(_value(row, "V")), parameterIds=sorted({identity for trigger in trigger_ids for identity in trigger_by_id[trigger]["parameterIds"]}), logic=_value(row, "L"), executionSupport="deterministic" if rule["id"] in DETERMINISTIC_IDS else "unsupported", enablement="draft_disabled")
        rules.append(rule)
    evidence = []
    for row in rows[10]:
        record = _record(row, SHEETS[10])
        record.update(sourceIds=_ids(_value(row, "C")), statement=_value(row, "F"), limitations=_value(row, "G"), accessLevel=_value(row, "J"))
        evidence.append(record)
    sources = []
    for row in rows[11]:
        record = _record(row, SHEETS[11])
        url = row["hyperlinks"].get(f"N{row['row']}") or _value(row, "G")
        if not re.match(r"https?://", url):
            raise ConversionError(f"invalid source URL: {SHEETS[11]} N{row['row']} {url}")
        record.update(title=_value(row, "B"), url=url, doi=_value(row, "F") or None, accessLevel=_value(row, "H"))
        sources.append(record)
    validations = []
    for row in rows[14]:
        if not _value(row, "A").startswith("V"):
            continue
        record = _record(row, SHEETS[14])
        record.update(expected=_value(row, "J"), ruleIds=[rule["id"] for rule in rules] if _value(row, "C") == "全部规则" else _ids(_value(row, "C")))
        validations.append(record)
    return {"schemaVersion": "1.0", "resourceId": RESOURCE_ID, "source": {"workbookName": "tilapia-streptococcosis-v1.0.xlsx" if digest == EXPECTED_SHA256 else workbook.name, "sha256": digest, "bytes": len(data)}, "rules": rules, "triggers": triggers, "parameters": parameters, "evidence": evidence, "sources": sources, "validationCases": validations, "tables": tables}


def convert(workbook=WORKBOOK, output=OUTPUT, *, check=False, expected_sha256=EXPECTED_SHA256):
    """Generate atomically or compare exact bytes without writing in check mode."""
    resource = build_resource(workbook, expected_sha256)
    content = (json.dumps(resource, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    output = Path(output)
    if check:
        if not output.is_file():
            raise ConversionError(f"published resource missing: {output}")
        if output.read_bytes() != content:
            raise ConversionError(f"published resource out of date: {output}; run scripts/convert_tilapia_knowledge.py")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(prefix=f".{output.name}.", suffix=".tmp", dir=output.parent, delete=False) as target:
                temporary = Path(target.name)
                target.write(content)
                target.flush()
                os.fsync(target.fileno())
            os.replace(temporary, output)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()
    return {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest(), "counts": {key: len(resource[key]) for key in ("tables", "rules", "triggers", "parameters", "evidence", "sources", "validationCases")}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, default=WORKBOOK, help="Local controlled workbook")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check-published", action="store_true", help="Verify the reviewed public JSON without a private workbook")
    modes.add_argument("--check", action="store_true", help="Read-only: verify exact published JSON bytes against controlled XLSX")
    args = parser.parse_args()
    try:
        if args.check_published:
            if hashlib.sha256(OUTPUT.read_bytes()).hexdigest() != PUBLISHED_SHA256:
                raise ConversionError("published JSON checksum mismatch")
            print("Verified published tilapia JSON checksum")
            return 0
        summary = convert(workbook=args.workbook, check=args.check)
    except (ConversionError, OSError) as exc:
        print(f"tilapia knowledge conversion failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"mode": "check" if args.check else "generate", **summary}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
