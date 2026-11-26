"use client";

import { useState, type FormEvent } from "react";
import { areaNames, roleNames } from "@/lib/accounts/display";
import { areas, catalog, isApprovalParent, models, type Account, type Country, type Role } from "@/lib/accounts/policy";
import { useLocale } from "@/components/gadews/locale-provider";

type Save = (action: string, input: unknown) => Promise<void>;
type Translate = (zh: string, en: string) => string;
const field = "mt-1 block w-full rounded-lg border border-slate-400 bg-white px-3 py-2";
const businessRoles = ["country", "region", "member"] as const;

function GrantEditor({ account, reports, busy, save, modelLabel }: {
  account: Account; reports: Account[]; busy: boolean; save: Save; modelLabel: (key: string, t: Translate) => string;
}) {
  const { t } = useLocale();
  const [role, setRole] = useState<Role>(account.status === "pending" ? account.requested : account.role);
  const [country, setCountry] = useState<Country>(account.country);
  const [region, setRegion] = useState(account.region);
  const [enabled, setEnabled] = useState(account.status !== "disabled");
  const scopeChanged = account.status !== "pending" &&
    (role !== account.role || country !== account.country || region !== account.region);
  const incompatible = reports.filter(child => child.status === "active" &&
    !isApprovalParent({ role, country, region }, { ...child, requested: child.role })).length;
  const records = catalog.filter(record => record.country === country && record.region === region);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await save("systemGrant", {id: account.id, role, country, region, enabled,
      models: data.getAll("model"), records: role === "member" ? data.getAll("record") : []});
  }
  return (
    <form onSubmit={submit} aria-label={t("编辑用户权限", "Edit user permissions")} className="mt-4 grid gap-4 rounded-xl border border-slate-200 p-4">
      <h3 className="break-all font-semibold">{account.username}</h3>
      <p className="text-sm text-slate-700">{t("保存后，该账号由超级管理员直接管理。角色、辖区和授权随即生效。", "Saving places this account under the system administrator. Its role, jurisdiction and grants take effect immediately.")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>{t("业务角色", "Account role")}
          <select name="role" className={field} value={role} onChange={e => setRole(e.target.value as Role)}>
            {businessRoles.map(value => <option key={value} value={value}>{t(...roleNames[value])}</option>)}
          </select>
        </label>
        <label>{t("管理国家", "Account country")}
          <select name="country" className={field} value={country} onChange={e => {
            const next = e.target.value as Country;
            setCountry(next);
            setRegion(areas[next][0]);
          }}>
            {(Object.keys(areas) as Country[]).map(value => <option key={value} value={value}>{t(...areaNames[value])}</option>)}
          </select>
        </label>
        {role !== "country" && <label>{t("所属区域", "Assigned region")}
          <select name="region" className={field} value={region} onChange={e => setRegion(e.target.value)}>
            {areas[country].map(value => <option key={value} value={value}>{t(...areaNames[value])}</option>)}
          </select>
        </label>}
      </div>
      <fieldset>
        <legend className="font-semibold">{t("模型使用权", "Model grants")}</legend>
        {models.map(model => <label className="mr-4 inline-block py-1" key={model}>
          <input type="checkbox" name="model" value={model} defaultChecked={account.models.includes(model)} /> {modelLabel(model,t)}
        </label>)}
      </fieldset>
      {role === "member" && <fieldset>
        <legend className="font-semibold">{t("示例资料读取权", "Sample record grants")}</legend>
        {records.length ? records.map(record => <label className="mr-4 inline-block py-1" key={record.id}>
          <input type="checkbox" name="record" value={record.id} defaultChecked={account.records.includes(record.id)} /> {record.id}
        </label>) : <p className="text-sm text-slate-600">{t("该区域尚无示例资料。", "No sample records for this region.")}</p>}
      </fieldset>}
      <label><input name="enabled" type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> {t("启用账号", "Enable account")}</label>
      {(!enabled && account.status !== "disabled" || scopeChanged) && <p className="text-sm text-amber-800">
        {reports.length
          ? t("保存后，该账号及其下属的当前会话将结束。", "Saving ends current sessions for this account and its subordinates.")
          : t("保存后，该账号的当前会话将结束。", "Saving ends this account’s current sessions.")}
        {scopeChanged && incompatible > 0 && " " + t(
          `有 ${incompatible} 个直属账号不符合新角色或辖区，将被停用。`,
          `${incompatible} direct report(s) fall outside the new role or jurisdiction and will be disabled.`)}
      </p>}
      <button type="submit" className="justify-self-start rounded-lg bg-teal-800 px-4 py-2.5 font-semibold text-white hover:bg-teal-900 disabled:opacity-45" disabled={busy}>
        {account.status === "pending" && enabled ? t("批准并保存权限", "Approve and save permissions") : t("保存用户权限", "Save user permissions")}
      </button>
    </form>
  );
}

export function SystemGrants({ accounts, busy, save, modelLabel }: {
  accounts: Account[]; busy: boolean; save: Save; modelLabel: (key: string, t: Translate) => string;
}) {
  const { t } = useLocale();
  const [selected, setSelected] = useState("");
  const candidates = accounts.filter(account => account.role !== "system" && account.status !== "rejected");
  const account = candidates.find(item => item.id === selected);
  return (
    <section id="user-permissions" className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-bold">{t("用户权限管理", "User permissions")}</h2>
      <label className="mt-4 block">{t("选择账号", "Select account")}
        <select className={field + " max-w-lg"} value={account?.id ?? ""} onChange={e => setSelected(e.target.value)}>
          <option value="">{t("按用户名选择", "Choose a username")}</option>
          {candidates.map(item => <option key={item.id} value={item.id}>
            {item.username} · {t(...roleNames[item.status === "pending" ? item.requested : item.role])} · {modelLabel(item.status,t)}
          </option>)}
        </select>
      </label>
      {account && <GrantEditor key={JSON.stringify(account)} account={account} reports={accounts.filter(item => item.parent === account.id)} busy={busy} save={save} modelLabel={modelLabel}/>}
    </section>
  );
}
