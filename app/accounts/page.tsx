"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { areaNames, roleNames } from "@/lib/accounts/display";
import { accountApi as api, accountMessages as messages } from "@/lib/accounts/client";
import { AccessPreview } from "./access-preview";
import { StickyHeader } from "@/components/gadews/sticky-header";
import { useLocale } from "@/components/gadews/locale-provider";
import {
  areas,
  catalog,
  childRole,
  type Account,
  type Country,
  type Model,
} from "@/lib/accounts/policy";
import type { Dashboard } from "@/lib/accounts/service";

type T = (zh: string, en: string) => string;
const labels: Record<string, readonly [string, string]> = {
  ...areaNames,
  active: ["已启用", "Active"],
  pending: ["待审批", "Awaiting approval"],
  disabled: ["已停用", "Disabled"],
  "wsd-v1.0": ["白斑病 · v1.0", "White spot disease · v1.0"],
  "tilapia-demo-score-v0.1": ["罗非鱼 · v0.1", "Tilapia · v0.1"],
  "knowledge-chat-v1": ["知识助手 · v1", "Knowledge assistant · v1"],
};
const label = (key: string, t: T) => (labels[key] ? t(...labels[key]) : key);
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";
const button =
  "rounded-lg bg-teal-800 px-4 py-2.5 font-semibold text-white hover:bg-teal-900 disabled:opacity-45";
const secondary =
  "rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 disabled:opacity-45";
const field = "mt-1 block w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-slate-950";
type Act = (action: string, input?: unknown) => Promise<void>;

function Credentials({ act, busy }: { act: Act; busy: boolean }) {
  const { t } = useLocale();
  const signup = useSearchParams().get("mode") === "register";
  const [country, setCountry] = useState<Country>("A");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = Object.fromEntries(new FormData(form));
    await act("register", input);
  }
  if (!signup) return (
    <section className={card}>
      <h2 className="text-xl font-bold">{t("登录账号", "Sign in")}</h2>
      <div className="my-5 flex flex-wrap gap-3">
        <Link href="/login?entry=user" className={button}>{t("普通用户登录", "User sign-in")}</Link>
        <Link href="/login?entry=admin" className={secondary}>{t("管理员登录", "Administrator sign-in")}</Link>
      </div>
      <Link href="/accounts?mode=register" className="text-teal-800 underline">{t("注册账号", "Create an account")}</Link>
    </section>
  );
  return (
    <section className={card}>
      <h2 className="text-xl font-bold">{t("创建账号", "Create an account")}</h2>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          {t("用户名", "Username")}
          <input
            className={field}
            name="username"
            required
            minLength={3}
            maxLength={40}
            pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{2,39}"
            autoComplete="username"
          />
        </label>
        <p className="text-sm text-slate-600">
          {t(
            "用户名使用 3–40 个英文字母、数字、点、下划线或短横线；密码至少 10 个字符。",
            "Use 3–40 letters, digits, dots, underscores or hyphens; choose a password of at least 10 characters.",
          )}
        </p>
        <label className="block">
          {t("密码", "Password")}
          <input
            className={field}
            name="password"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
          />
        </label>
        <label className="block">
          {t("申请身份", "Requested role")}
          <select className={field} name="requested" defaultValue="member">
            {(["member", "region", "country"] as const).map((r) => (
              <option key={r} value={r}>
                {t(...roleNames[r])}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            {t("申请国家", "Country")}
            <select
              className={field}
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value as Country)}
            >
              {Object.keys(areas).map((id) => (
                <option key={id} value={id}>
                  {label(id, t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("申请区域", "Region")}
            <select key={country} className={field} name="region">
              {areas[country].map((id) => (
                <option key={id} value={id}>
                  {label(id, t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button disabled={busy} className={button}>
          {t("注册并查看申请状态", "Register and view status")}
        </button>
      </form>
      <Link className="mt-4 inline-block text-teal-800 underline" href="/login?entry=user">
        {t("已有账号？去登录", "Already registered? Sign in")}
      </Link>
    </section>
  );
}

function Assignment({ user, view, act, busy }: { user: Account; view: Dashboard; act: Act; busy: boolean }) {
  const { t } = useLocale();
  const role = childRole(view.self.role)!;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act("assign", {
      id: user.id,
      enabled: f.get("enabled") === "yes",
      models: f.getAll("model"),
      records: f.getAll("record"),
    });
  }
  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">
        {user.username} · {label(user.country, t)} / {label(user.region, t)} · {label(user.status, t)}
      </summary>
      <form onSubmit={save} className="mt-4 space-y-3">
        <p>
          {t("分配身份", "Assigned role")} · {t(...roleNames[role])}
        </p>
        <label className="block">
          <input type="checkbox" name="enabled" value="yes" defaultChecked={user.status !== "disabled"} />{" "}
          {t("启用账号", "Enable account")}
        </label>
        <fieldset>
          <legend className="font-semibold">{t("模型使用权", "Model grants")}</legend>
          {view.assignable.map((m) => (
            <label className="mr-4 inline-block py-1" key={m}>
              <input name="model" type="checkbox" value={m} defaultChecked={user.models.includes(m)} />{" "}
              {label(m, t)}
            </label>
          ))}
        </fieldset>
        {role === "member" && (
          <fieldset>
            <legend className="font-semibold">{t("示例资料读取权", "Sample record grants")}</legend>
            {catalog
              .filter((r) => r.country === user.country && r.region === user.region)
              .map((r) => (
                <label className="mr-4" key={r.id}>
                  <input
                    type="checkbox"
                    name="record"
                    value={r.id}
                    defaultChecked={user.records.includes(r.id)}
                  />{" "}
                  {r.id}
                </label>
              ))}
          </fieldset>
        )}
        <button className={button} disabled={busy}>
          {user.status === "pending" ? t("批准并分配", "Approve assignment") : t("保存授权", "Save grants")}
        </button>
      </form>
    </details>
  );
}
type Preview = {
  standard: string;
  inputVersion: string;
  subtotal: number;
  complete: number | null;
  maximum: number;
  evaluated: number;
  total: number;
};
function Score({ value, t }: { value: Preview; t: T }) {
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-teal-50 p-4">
      <dt>{t("规则版本", "Rule version")}</dt>
      <dd>{value.standard}</dd>
      <dt>{t("输入版本", "Input version")}</dt>
      <dd>{value.inputVersion}</dd>
      <dt>{t("已判定项目", "Evaluated items")}</dt>
      <dd>
        {value.evaluated} / {value.total}
      </dd>
      <dt>{t("已知小计", "Known subtotal")}</dt>
      <dd>{value.subtotal}</dd>
      <dt>{t("完整分数", "Complete score")}</dt>
      <dd>
        {value.complete === null
          ? t("资料不完整", "Incomplete evidence")
          : value.complete + " / " + value.maximum}
      </dd>
    </dl>
  );
}
export default function AccountsPage() {
  const { t, locale } = useLocale();
  const [view, setView] = useState<Dashboard | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [score, setScore] = useState<Preview | null>(null),
    [output, setOutput] = useState("");
  async function refresh() {
    const data = (await api()) as Dashboard | null;
    setView(data);
  }
  useEffect(() => {
    let mounted = true;
    api()
      .then((data) => {
        if (mounted) setView(data);
      })
      .catch((e) => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  async function act(action: string, input?: unknown) {
    setBusy(true);
    setMessage("");
    setError("");
    setOutput("");
    setScore(null);
    try {
      if (action === "refresh") {
        await refresh();
        return;
      }
      const data = await api(action, input);
      if (action === "register") {
        const { username, password } = input as { username: string; password: string };
        await api("login", { username, password });
      }
      if (action === "register" || action === "logout") {
        window.dispatchEvent(new Event("gadews:session-changed"));
      }
      if (action === "preview") setScore(data);
      if (action === "detail") setOutput(JSON.stringify(data, null, 2));
      if (action === "ai")
        setOutput(
          JSON.stringify(
            {
              standard: data.standard,
              model: data.model,
              validation: data.validation,
              differences: data.differences,
            },
            null,
            2,
          ),
        );
      if (action === "assign") setMessage(t("授权已保存。", "Grants saved."));
      await refresh();
    } catch (e) {
      const code = e instanceof Error ? e.message : "unavailable";
      setError(code);
      if (code === "login_required") {
        setView(null);
        window.dispatchEvent(new Event("gadews:session-changed"));
      }
      else if (view) await refresh().catch(() => setView(null));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <StickyHeader />
      <header className="bg-[#082b38] px-5 pb-9 pt-28 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold sm:text-4xl">{t("账号与授权", "Accounts and access")}</h1>
          <p className="mt-3 max-w-2xl text-slate-200">
            {t(
              "按国家、区域分配模型版本和示例资料。此工作区仅使用虚构记录。",
              "Assign model versions and sample records by country and region. This workspace uses fictional data.",
            )}
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-7">
        {error && (
          <p role="alert" className="rounded-xl bg-amber-100 p-4">
            {t(...(messages[error] ?? ["服务暂不可用，请重试。", "The service is unavailable. Try again."]))}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-xl bg-teal-50 p-4">
            {message}
          </p>
        )}
        {loading ? (
          <p>{t("正在读取账号…", "Loading account…")}</p>
        ) : !view ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Credentials act={act} busy={busy} />
            <section className={card}>
              <h2 className="text-xl font-bold">{t("注册后的权限", "After registration")}</h2>
              <p className="mt-4 leading-7">
                {t(
                  "注册后可登录查看申请状态。管理员核对辖区后分配角色、病种模型和可读记录。公开报告与文献仍可直接浏览。",
                  "Sign in to see your application. A manager verifies your jurisdiction, then assigns a role, models and readable records. Public reports and literature remain accessible.",
                )}
              </p>
            </section>
          </div>
        ) : (
          <>
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{view.self.username}</h2>
                  <p>
                    {view.active ? t(...roleNames[view.self.role]) : view.self.status === "pending"
                      ? t("待审批", "Awaiting approval") : t("权限暂不可用", "Access unavailable")}
                    {view.active && view.self.role !== "system" && " · " + label(view.self.country, t)}
                    {view.active && (view.self.role === "region" || view.self.role === "member") &&
                      " / " + label(view.self.region, t)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className={secondary} onClick={() => act("refresh")} disabled={busy}>
                    {t("刷新状态", "Refresh")}
                  </button>
                  <button className={secondary} onClick={() => act("logout")} disabled={busy}>
                    {t("退出", "Sign out")}
                  </button>
                </div>
              </div>
            </section>
            {view.active && (
              <>
                <section className={card}>
                  <h2 className="text-xl font-bold">
                    {view.self.role === "system"
                      ? t("可分配的模型版本", "Assignable model versions")
                      : t("已获配的模型版本", "Assigned model versions")}
                  </h2>
                  <p className="mt-3">
                    {(view.self.role === "system" ? view.assignable : view.models)
                      .map((m: Model) => label(m, t))
                      .join(" · ") || t("尚未分配", "None assigned")}
                  </p>
                </section>
                {view.engine && <p className="text-sm text-slate-600">{t("AI 服务配置","AI service configuration")} · {view.engine.model || t("未指定","Unspecified")} · {view.engine.configured ? t("已配置，实际状态以调用回执为准","Configured; availability is checked on request") : t("未配置，规则演示可用","Not configured; offline previews available")}</p>}
                {view.self.role !== "member" && (
                  <section className={card}>
                    <h2 className="text-xl font-bold">
                      {t("管理下一级账号", "Manage subordinate accounts")}
                    </h2>
                    <div className="mt-4 space-y-3">
                      {view.children.length
                        ? view.children.map((u) => (
                            <Assignment
                              key={JSON.stringify([u, view.assignable])}
                              user={u}
                              view={view}
                              act={act}
                              busy={busy}
                            />
                          ))
                        : t(
                            "当前范围内没有待分配或直属账号。",
                            "No pending or directly managed accounts in this scope.",
                          )}
                    </div>
                  </section>
                )}
                {!!view.directory.length && (
                  <details className={card}>
                    <summary className="cursor-pointer font-bold">
                      {t("全站账号目录", "System account directory")} · {view.directory.length}
                    </summary>
                    <ul className="mt-3 divide-y">
                      {view.directory.map((a) => (
                        <li className="py-2" key={a.username}>
                          {a.username} · {t(...roleNames[a.status === "pending" ? a.requested : a.role])} ·{" "}
                          {label(a.country, t)} / {label(a.region, t)} · {label(a.status, t)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {!!view.summary.length && (
                  <section className={card}>
                    <h2 className="text-xl font-bold">{t("本国示例汇总", "National sample summary")}</h2>
                    {view.summary.map((r) => (
                      <p key={r.region}>
                        {label(r.region, t)} · {r.count} {t("条示例", "samples")}
                      </p>
                    ))}
                  </section>
                )}
                {["region", "member"].includes(view.self.role) && (
                  <section className={card}>
                    <h2 className="text-xl font-bold">{t("可读示例资料", "Readable sample records")}</h2>
                    {!view.records.length && (
                      <p className="mt-3">{t("尚未分配可读资料。", "No readable records assigned.")}</p>
                    )}
                    {view.records.map((r) => (
                      <div key={r.id} className="mt-4 rounded-xl bg-slate-50 p-4">
                        <h3 className="font-semibold">
                          {r.id} · {label(r.model, t)}
                        </h3>
                        <p className="my-2 text-sm">
                          {view.models.includes(r.model)
                            ? t("资料可读 · 模型已授权", "Record readable · model authorized")
                            : t("资料可读 · 模型未获授权", "Record readable · model not authorized")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(["detail", "preview", "ai"] as const).map((a, i) => (
                            <button
                              key={a}
                              disabled={busy || (a !== "detail" && !view.models.includes(r.model))}
                              className={a === "preview" ? button : secondary}
                              onClick={() => act(a, { id: r.id, locale })}
                            >
                              {
                                [
                                  t("查看资料", "View record"),
                                  t("运行规则演示", "Run rule preview"),
                                  t("请求 AI 对照", "Request AI comparison"),
                                ][i]
                              }
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {score && (
                      <div className="mt-3" role="status">
                        <Score value={score} t={t} />
                      </div>
                    )}
                    {output && (
                      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-white">
                        {output}
                      </pre>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}
        <AccessPreview />
      </div>
    </main>
  );
}
