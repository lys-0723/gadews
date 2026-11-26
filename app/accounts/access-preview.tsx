"use client";

import { useState } from "react";
import { access, type Account, type Role } from "@/lib/accounts/policy";
import { useLocale } from "@/components/gadews/locale-provider";

export function AccessPreview() {
  const { t } = useLocale();
  const [role, setRole] = useState<Role>("member");
  const [model, setModel] = useState(true);
  const [record, setRecord] = useState(true);
  const accounts: Account[] = (["system", "country", "region", "member"] as const).map(
    (level, index, levels) => ({
      id: level,
      username: level,
      role: level,
      requested: level,
      parent: levels[index - 1] ?? null,
      country: "A",
      region: "east",
      status: "active",
      models: level === "member" && !model ? [] : ["wsd-v1.0"],
      records: level === "member" && record ? ["E-01"] : [],
    }),
  );
  const rights = access(accounts.find((a) => a.role === role)!, accounts);
  const readable = rights.readable.some((r) => r.id === "E-01");
  const usable = rights.usable.includes("wsd-v1.0");
  return (
    <details className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
      <summary className="cursor-pointer font-bold text-teal-950">
        {t("预览四级权限演示", "Preview the four access levels")}
      </summary>
      <p className="my-3 text-sm">
        {t(
          "选择一个虚构身份，查看甲国东区 E-01 与白斑病版本的授权效果。此预览仅计算显示状态。",
          "Select a fictional role to see its access to E-01 in Country A, East and the WSD version. This preview only calculates display states.",
        )}
      </p>
      <label>
        {t("演示身份", "Demo role")}{" "}
        <select className="rounded border p-2" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="system">{t("超级管理员", "System administrator")}</option>
          <option value="country">{t("国家管理员", "Country administrator")}</option>
          <option value="region">{t("区域管理员", "Regional administrator")}</option>
          <option value="member">{t("终端用户", "End user")}</option>
        </select>
      </label>
      {role === "member" && (
        <fieldset className="my-3 flex flex-wrap gap-4">
          <legend className="sr-only">{t("终端授权组合", "End-user grants")}</legend>
          <label>
            <input type="checkbox" checked={model} onChange={(e) => setModel(e.target.checked)} />{" "}
            {t("分配模型", "Grant model")}
          </label>
          <label>
            <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} />{" "}
            {t("分配记录", "Grant record")}
          </label>
        </fieldset>
      )}
      <p className="mt-4 font-medium" aria-live="polite">
        {readable ? t("资料可读", "Record readable") : t("明细受限", "Record restricted")} ·{" "}
        {usable ? t("模型已获配", "Model assigned") : t("无业务调用权", "No model execution grant")} ·{" "}
        {usable && readable ? t("允许示例运行", "Run permitted") : t("不可运行此示例", "Run restricted")}
      </p>
    </details>
  );
}
