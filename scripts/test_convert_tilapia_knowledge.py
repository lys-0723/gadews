"""Behavior checks for the read-only XLSX conversion boundary (stdlib only)."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile


SCRIPT = Path(__file__).with_name("convert_tilapia_knowledge.py")
MODULE = None
if SCRIPT.exists():
    SPEC = importlib.util.spec_from_file_location("tilapia_converter", SCRIPT)
    MODULE = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(MODULE)

# A small real XLSX archive, independent of production parser constants. The
# fixtures use one evidence/source and one of each base entity; all 22 rule IDs
# and 14 parameter IDs are kept to exercise the complete registry contract.
HEADERS = {
    "00_框架与使用": {"A": "模块", "B": "记录数"},
    "01_疾病基础档案": {"A": "疾病编号", "E": "病原编号", "Y": "证据编号", "Z": "来源编号"},
    "02_病原基础档案": {"A": "病原编号", "B": "关联疾病编号", "S": "证据编号", "T": "来源编号"},
    "03_宿主易感性": {"A": "宿主记录编号", "B": "关联疾病编号", "C": "关联病原编号", "N": "证据编号", "O": "来源编号"},
    "04_综合征与临床症状": {"A": "症状记录编号", "B": "关联疾病编号", "C": "关联病原编号", "N": "证据编号", "O": "来源编号"},
    "05_风险因子分类表": {"A": "风险因子编号", "B": "关联疾病编号", "C": "关联病原编号", "O": "证据编号", "P": "来源编号"},
    "06_环境阈值与触发条件": {"A": "触发条件编号", "B": "关联疾病编号", "C": "关联病原编号", "D": "关联风险因子编号", "E": "指标名称", "H": "触发条件", "J": "风险逻辑", "Q": "证据编号", "R": "来源编号", "X": "参数编号", "Y": "候选数值", "Z": "单位", "AA": "持续时间候选_h", "AC": "生产启用"},
    "07_诊断方法": {"A": "诊断方法编号", "B": "关联疾病编号", "C": "关联病原编号", "Q": "证据编号", "R": "来源编号"},
    "08_防控措施": {"A": "措施编号", "B": "关联疾病编号", "C": "关联病原编号", "O": "证据编号", "P": "来源编号"},
    "09_预警规则表": {"A": "预警规则编号", "B": "关联疾病编号", "C": "关联病原编号", "D": "规则名称", "H": "关联触发条件编号", "I": "关联症状编号", "J": "关联诊断方法编号", "K": "关联防控措施编号", "L": "判定逻辑", "R": "启用状态", "U": "证据编号", "V": "来源编号"},
    "10_证据事实表": {"A": "证据编号", "C": "来源编号", "F": "已核实结果（转述）", "G": "局限与不可外推事项", "J": "访问层级"},
    "11_核实来源": {"A": "来源编号", "B": "文献题名", "F": "DOI", "G": "直接访问链接", "H": "实际访问层级", "K": "证据编号", "N": "访问核查链接"},
    "12_原150条核查": {"A": "原文献编号", "J": "相关替代来源（不代表同篇）"},
    "13_字段与接入字典": {"A": "所属表/场景", "C": "机器字段建议", "I": "设计依据证据", "J": "来源编号"},
    "14_参数与验证": {"A": "条目编号", "B": "条目类型", "C": "关联条目", "D": "定义或候选内容", "E": "候选数值", "F": "单位", "G": "正式采用值", "J": "核对方法或验收指标", "L": "证据编号", "M": "来源编号", "N": "签署人（待填）", "O": "签署日期（待填）"},
}
S = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
P = "http://schemas.openxmlformats.org/package/2006/relationships"


def fixture_tables():
    tables = {name: [dict(headers)] for name, headers in HEADERS.items()}
    tables["00_框架与使用"] = [{"A": "原始标题"}, HEADERS["00_框架与使用"], {"A": "原始说明", "B": "1", "B__formula": "1+0"}]
    tables["01_疾病基础档案"].append({"A": "TST", "E": "SAG;SIN", "Y": "E01", "Z": "S01"})
    tables["02_病原基础档案"] += [{"A": p, "B": "TST", "S": "E01", "T": "S01"} for p in ("SAG", "SIN")]
    for name, entity in [("03_宿主易感性", "HOST"), ("04_综合征与临床症状", "SYM"), ("05_风险因子分类表", "RF"), ("07_诊断方法", "DIAG"), ("08_防控措施", "CTRL")]:
        tables[name].append({"A": f"TST-{entity}-001", "B": "TST", "C": "SAG;SIN"})
    for n in range(1, 23):
        tables["06_环境阈值与触发条件"].append({"A": f"TST-TRG-{n:03}", "B": "TST", "C": "SAG" if n == 3 else "SAG;SIN", "D": "TST-RF-001", "E": "指标", "H": "触发原文", "J": "逻辑原文", "Q": "E01", "R": "S01", "X": "P01" if n == 1 else "", "Y": "30" if n == 1 else "", "AA": "24" if n == 1 else "", "AC": "否"})
        tables["09_预警规则表"].append({"A": f"TST-WARN-{n:03}", "B": "TST", "C": "SAG" if n == 2 else "SAG;SIN", "D": f"规则{n}", "H": "TST-TRG-017" if n == 9 else f"TST-TRG-{n:03}", "I": "TST-SYM-001", "J": "TST-DIAG-001", "K": "TST-CTRL-001", "L": "保留≥与中文，不解析执行", "R": "草案禁用", "U": "E01", "V": "S01"})
    tables["10_证据事实表"].append({"A": "E01", "C": "S01", "F": "原始证据", "G": "不外推", "J": "摘要"})
    tables["11_核实来源"].append({"A": "S01", "B": "来源标题", "F": "10.example/test", "G": "https://example.org/display-url", "H": "摘要", "K": "E01", "N": "打开来源"})
    tables["12_原150条核查"].append({"A": "1", "J": "S01（独立替代）"})
    tables["13_字段与接入字典"] += [{"A": table, "C": "shared_field", "I": "E01", "J": "S01"} for table in ("第一表", "第二表")]
    for n in range(1, 15):
        tables["14_参数与验证"].append({"A": f"P{n:02}", "B": "候选参数", "C": "TST-TRG-017" if n in (10, 13, 14) else f"TST-TRG-{n:03}", "D": "参数原文", "E": {1: "30", 10: "0.2", 13: "2", 14: "7"}.get(n, ""), "F": "°C；持续24h" if n == 1 else "单位", "L": "E01", "M": "S01"})
    for n in range(1, 13):
        tables["14_参数与验证"].append({"A": f"V{n:02}", "B": "逻辑验证", "C": "全部规则" if n == 1 else f"TST-WARN-{n:03}", "J": f"预期{n}", "L": "E01", "M": "S01"})
    return tables


def write_fixture(path, tables=None, broken_hyperlink=False):
    tables = tables or fixture_tables()
    workbook = ET.Element(f"{{{S}}}workbook")
    sheet_list = ET.SubElement(workbook, f"{{{S}}}sheets")
    rels = ET.Element(f"{{{P}}}Relationships")
    shared = ET.Element(f"{{{S}}}sst")
    ET.SubElement(ET.SubElement(shared, f"{{{S}}}si"), f"{{{S}}}t").text = "shared value preserved"
    with zipfile.ZipFile(path, "w") as archive:
        for index, (name, rows) in enumerate(tables.items(), 1):
            ET.SubElement(sheet_list, f"{{{S}}}sheet", {"name": name, "sheetId": str(index), f"{{{R}}}id": f"rId{index}"})
            ET.SubElement(rels, f"{{{P}}}Relationship", {"Id": f"rId{index}", "Target": f"worksheets/sheet{index}.xml", "Type": f"{R}/worksheet"})
            sheet = ET.Element(f"{{{S}}}worksheet")
            data = ET.SubElement(sheet, f"{{{S}}}sheetData")
            for row_number, row in enumerate(rows, 1):
                row_xml = ET.SubElement(data, f"{{{S}}}row", {"r": str(row_number)})
                for column, value in row.items():
                    if column.endswith("__formula"):
                        continue
                    cell = ET.SubElement(row_xml, f"{{{S}}}c", {"r": f"{column}{row_number}", "t": "inlineStr"})
                    ET.SubElement(ET.SubElement(cell, f"{{{S}}}is"), f"{{{S}}}t").text = value
                    if column + "__formula" in row:
                        ET.SubElement(cell, f"{{{S}}}f").text = row[column + "__formula"]
                if name == "00_框架与使用" and row_number == 3:
                    cell = ET.SubElement(row_xml, f"{{{S}}}c", {"r": "C3", "t": "s"})
                    ET.SubElement(cell, f"{{{S}}}v").text = "0"
            if name == "11_核实来源":
                links = ET.SubElement(sheet, f"{{{S}}}hyperlinks")
                ET.SubElement(links, f"{{{S}}}hyperlink", {"ref": "N2", f"{{{R}}}id": "rIdMissing" if broken_hyperlink else "rIdUrl"})
                sheet_rels = ET.Element(f"{{{P}}}Relationships")
                ET.SubElement(sheet_rels, f"{{{P}}}Relationship", {"Id": "rIdUrl", "Target": "https://example.org/actual-source?a=1&b=2", "TargetMode": "External", "Type": f"{R}/hyperlink"})
                archive.writestr(f"xl/worksheets/_rels/sheet{index}.xml.rels", ET.tostring(sheet_rels))
            archive.writestr(f"xl/worksheets/sheet{index}.xml", ET.tostring(sheet))
        archive.writestr("xl/workbook.xml", ET.tostring(workbook))
        archive.writestr("xl/_rels/workbook.xml.rels", ET.tostring(rels))
        archive.writestr("xl/sharedStrings.xml", ET.tostring(shared))
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ConverterFixtureTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(MODULE, "converter behavior is missing")
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.input = Path(self.temp.name) / "fixture.xlsx"
        self.output = Path(self.temp.name) / "resource.json"
        self.sha = write_fixture(self.input)

    def convert(self, **kwargs):
        return MODULE.convert(self.input, self.output, expected_sha256=self.sha, **kwargs)

    def test_preserves_rows_strings_formulas_hyperlinks_and_normalized_contract(self):
        self.convert()
        resource = json.loads(self.output.read_bytes())
        self.assertEqual(resource["schemaVersion"], "1.0")
        self.assertEqual(resource["source"]["sha256"], self.sha)
        self.assertEqual(len(resource["tables"]), 15)
        intro = resource["tables"][0]
        self.assertEqual(intro["headers"]["A"], "模块")
        self.assertEqual(intro["rows"][2]["cells"]["C3"], "shared value preserved")
        self.assertEqual(intro["rows"][2]["cells"]["B3__formula"], "1+0")
        source = resource["sources"][0]
        self.assertEqual(source["url"], "https://example.org/actual-source?a=1&b=2")
        self.assertEqual(source["original"]["cells"]["N2"], "打开来源")
        self.assertEqual(source["sourceRefs"], [{"sheet": "11_核实来源", "row": 2}])
        rule = resource["rules"][1]
        self.assertEqual(rule["pathogenIds"], ["SAG"])
        self.assertEqual(rule["logic"], "保留≥与中文，不解析执行")
        self.assertEqual(sum(r["executionSupport"] == "deterministic" for r in resource["rules"]), 13)
        self.assertTrue(all(r["enablement"] == "draft_disabled" for r in resource["rules"]))
        self.assertEqual(resource["triggers"][2]["pathogenIds"], ["SAG"])
        self.assertEqual(resource["rules"][2]["pathogenIds"], ["SAG", "SIN"])
        self.assertEqual(resource["validationCases"][0]["expected"], "预期1")
        self.assertEqual(len(resource["validationCases"][0]["ruleIds"]), 22)

    def test_parameters_link_in_both_directions_without_adoption(self):
        self.convert()
        resource = json.loads(self.output.read_bytes())
        trigger = resource["triggers"][16]
        self.assertEqual(trigger["parameterIds"], ["P10", "P13", "P14"])
        self.assertEqual(resource["rules"][8]["parameterIds"], ["P10", "P13", "P14"])
        self.assertEqual(resource["parameters"][12]["relatedIds"], ["TST-TRG-017"])
        self.assertEqual(resource["parameters"][0]["candidateValue"], 30)
        self.assertEqual(resource["parameters"][0]["candidateDurationHours"], 24)
        self.assertEqual(resource["parameters"][9]["candidateValue"], 0.2)
        self.assertIsNone(resource["parameters"][1]["candidateValue"])
        self.assertTrue(all(p[k] is None for p in resource["parameters"] for k in ("adoptedValue", "signedBy", "signedAt")))

    def test_repeated_generation_is_identical_and_check_does_not_write(self):
        self.convert()
        first = self.output.read_bytes()
        self.convert()
        self.assertEqual(first, self.output.read_bytes())
        before = (self.input.stat().st_mtime_ns, self.output.stat().st_mtime_ns)
        self.convert(check=True)
        self.assertEqual(before, (self.input.stat().st_mtime_ns, self.output.stat().st_mtime_ns))
        self.output.write_bytes(first + b" ")
        changed = self.output.read_bytes()
        with self.assertRaisesRegex(MODULE.ConversionError, "out of date"):
            self.convert(check=True)
        self.assertEqual(changed, self.output.read_bytes())

    def test_check_missing_output_does_not_create_directory_or_file(self):
        self.output = self.output.parent / "absent" / "resource.json"
        with self.assertRaisesRegex(MODULE.ConversionError, "missing"):
            self.convert(check=True)
        self.assertFalse(self.output.parent.exists())

    def test_bad_sha_and_bad_workbook_do_not_overwrite_published_bytes(self):
        self.output.write_bytes(b"existing publication")
        with self.assertRaisesRegex(MODULE.ConversionError, "SHA-256"):
            MODULE.convert(self.input, self.output, expected_sha256="0" * 64)
        self.assertEqual(self.output.read_bytes(), b"existing publication")
        self.input.write_bytes(b"not a zip workbook")
        self.sha = hashlib.sha256(self.input.read_bytes()).hexdigest()
        with self.assertRaisesRegex(MODULE.ConversionError, "XLSX"):
            self.convert()
        self.assertEqual(self.output.read_bytes(), b"existing publication")

    def test_structural_id_and_reference_errors_are_specific_and_preserve_output(self):
        mutations = [
            ("missing sheet", lambda t: t.pop("10_证据事实表"), "missing sheet.*10_证据事实表"),
            ("missing column", lambda t: t["09_预警规则表"][0].pop("L"), "09_预警规则表.*L.*判定逻辑"),
            ("duplicate", lambda t: t["09_预警规则表"][2].update(A="TST-WARN-001"), "duplicate ID.*TST-WARN-001"),
            ("missing primary ID", lambda t: t["10_证据事实表"][1].update(A=""), "missing ID.*10_证据事实表.*2"),
            ("bad source", lambda t: t["10_证据事实表"][1].update(C="S99"), "10_证据事实表.*C2.*S99"),
            ("bad trigger", lambda t: t["09_预警规则表"][1].update(H="TST-TRG-999"), "09_预警规则表.*H2.*TST-TRG-999"),
            ("bad parameter reverse link", lambda t: t["14_参数与验证"][14].update(C="TST-TRG-999"), "14_参数与验证.*C15.*TST-TRG-999"),
            ("wrong parameter kind", lambda t: t["06_环境阈值与触发条件"][1].update(X="V01"), "06_环境阈值与触发条件.*X2.*V01"),
            ("wrong reverse link kind", lambda t: t["14_参数与验证"][1].update(C="TST-WARN-001"), "14_参数与验证.*C2.*TST-WARN-001"),
            ("wrong validation rule kind", lambda t: t["14_参数与验证"][16].update(C="TST-TRG-002"), "14_参数与验证.*C17.*TST-TRG-002"),
            ("incomplete rule registry", lambda t: t["09_预警规则表"].pop(), "missing.*TST-WARN-022"),
            ("unrecognized alternative source", lambda t: t["12_原150条核查"][1].update(J="SXX（来源）"), "12_原150条核查.*J2.*SXX"),
            ("bad dictionary reference", lambda t: t["13_字段与接入字典"][1].update(I="E99"), "13_字段与接入字典.*I2.*E99"),
            ("bad original alternative source", lambda t: t["12_原150条核查"][1].update(J="S99（替代来源）"), "12_原150条核查.*J2.*S99"),
            ("bad clinical reference", lambda t: t["09_预警规则表"][1].update(I="TST-SYM-999"), "09_预警规则表.*I2.*TST-SYM-999"),
            ("changed draft", lambda t: t["09_预警规则表"][1].update(R="已启用"), "draft.*09_预警规则表.*R2"),
            ("changed production", lambda t: t["06_环境阈值与触发条件"][1].update(AC="是"), "disabled.*06_环境阈值与触发条件.*AC2"),
            ("adopted parameter", lambda t: t["14_参数与验证"][1].update(G="30"), "adopted.*14_参数与验证.*G2"),
            ("signed parameter", lambda t: t["14_参数与验证"][1].update(N="person"), "signed.*14_参数与验证.*N2"),
        ]
        for label, mutate, message in mutations:
            with self.subTest(label=label):
                tables = fixture_tables()
                mutate(tables)
                self.sha = write_fixture(self.input, tables)
                self.output.write_bytes(b"previous bytes")
                with self.assertRaisesRegex(MODULE.ConversionError, message):
                    self.convert()
                self.assertEqual(self.output.read_bytes(), b"previous bytes")

    def test_missing_hyperlink_relationship_is_explicit(self):
        self.sha = write_fixture(self.input, broken_hyperlink=True)
        with self.assertRaisesRegex(MODULE.ConversionError, "hyperlink.*11_核实来源.*N2.*rIdMissing"):
            self.convert()


class ProductionResourceTests(unittest.TestCase):
    def test_published_resource_passes_read_only_check(self):
        self.assertTrue(SCRIPT.exists(), "converter behavior is missing")
        result = subprocess.run([sys.executable, str(SCRIPT), "--check-published"], capture_output=True, text=True, cwd=SCRIPT.parent.parent)
        self.assertEqual(result.returncode, 0, result.stderr)
        resource = json.loads((SCRIPT.parent.parent / "public/data/knowledge/tilapia-streptococcosis.json").read_bytes())
        self.assertEqual(resource["source"]["sha256"], "a13f014303048d75e87340e17b30b7d4cdf0de30c56d0d56082754d2fa629f6b")
        self.assertEqual(resource["source"]["bytes"], 160733)
        self.assertEqual([len(resource[key]) for key in ("tables", "rules", "triggers", "evidence", "sources", "parameters", "validationCases")], [15, 22, 22, 31, 36, 14, 12])
        self.assertEqual(resource["rules"][8]["parameterIds"], ["P10", "P13", "P14"])
        self.assertEqual(resource["sources"][0]["url"], "https://www.fao.org/north-america/resources/publications/framework-for-early-warning-of-animal-health-threats/en")


if __name__ == "__main__":
    unittest.main()
