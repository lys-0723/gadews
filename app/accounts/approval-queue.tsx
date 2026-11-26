"use client";

import { useState, type FormEvent } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLocale } from "@/components/gadews/locale-provider";
import { areaNames, roleNames } from "@/lib/accounts/display";
import { childRole, isApprovalParent, type Account } from "@/lib/accounts/policy";
import type { Dashboard } from "@/lib/accounts/service";

type Translate = (zh: string, en: string) => string;
type Approve = (input: { id: string; parentId?: string }) => Promise<void>;

function scope(account: Account, t: Translate) {
  const country = t(...areaNames[account.country]);
  return account.requested === "country" ? country : country + " / " + t(...areaNames[account.region]);
}

export function ApplicationDetails({ account }: { account: Account }) {
  const { t } = useLocale();
  return (
    <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
      <p>{t("申请身份", "Requested role")} · {t(...roleNames[account.requested])}</p>
      <p>{t("申请辖区", "Requested jurisdiction")} · {scope(account, t)}</p>
      {account.status === "rejected" ? (
        <p>{t("如需核对审批结果，请联系超级管理员。", "Contact the system administrator if you have questions about this decision.")}</p>
      ) : <p>
        {account.requested === "country"
          ? t("请联系超级管理员审批。", "Ask the system administrator to approve your application.")
          : account.requested === "region"
            ? t("请联系本国国家管理员或超级管理员审批。", "Ask your country administrator or the system administrator to approve your application.")
            : t("请联系本区域的区域管理员或超级管理员审批。", "Ask your regional administrator or the system administrator to approve your application.")}
        {" "}{t("获批后点击“刷新状态”即可查看身份。", "Once approved, select Refresh to see your assigned role.")}
      </p>}
    </div>
  );
}

type ReviewActions = { approve: Approve; reject: (input: { id: string }) => Promise<void>; busy: boolean };

function ApprovalRequest({ account, view, approve, reject, busy }: ReviewActions & { account: Account; view: Dashboard }) {
  const { t } = useLocale();
  const delegate = view.self.role === "system" && childRole(view.self.role) !== account.requested;
  const candidates = delegate ? view.approvalParents.filter(parent => isApprovalParent(parent, account)) : [];
  const [selected, setSelected] = useState(view.self.id);
  const parentId = selected === view.self.id ? view.self.id : candidates.find(parent => parent.id === selected)?.id;
  const selectId = "parent-" + account.id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (delegate && !parentId)) return;
    await approve(delegate ? { id: account.id, parentId } : { id: account.id });
  }

  return (
    <form aria-label={account.username} onSubmit={submit} className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
      <div className="min-w-0">
        <h3 className="break-all font-semibold text-slate-950">{account.username}</h3>
        <p className="mt-1 text-sm text-slate-700">{t(...roleNames[account.requested])} · {scope(account, t)}</p>
        {delegate && (
          <div className="mt-3">
            <label htmlFor={selectId} className="block text-sm font-medium">{t("直属管理员", "Supervising administrator")}</label>
            <select id={selectId} value={parentId ?? ""} onChange={e => setSelected(e.target.value)} required
              className="mt-1 w-full max-w-sm rounded-lg border border-slate-400 bg-white px-3 py-2 text-sm">
              <option value={view.self.id}>{t("由超级管理员直接管理", "Managed directly by system administrator")}</option>
              {candidates.map(parent => <option key={parent.id} value={parent.id}>{parent.username} · {t(...roleNames[parent.role])}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || (delegate && !parentId)}
          className="rounded-lg bg-teal-800 px-4 py-2.5 font-semibold text-white hover:bg-teal-900 disabled:opacity-45">
          {t("批准申请", "Approve application")}
        </button>
        {view.self.role === "system" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" disabled={busy} className="rounded-lg border border-rose-300 bg-white px-4 py-2.5 font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-45">
                {t("拒绝申请", "Reject application")}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent overlayClassName="z-[1300]" className="z-[1301] w-[calc(100%-2rem)] rounded-xl bg-white text-slate-900">
              <AlertDialogHeader>
                <AlertDialogTitle className="break-words">{t(`拒绝 ${account.username} 的注册申请？`, `Reject the application from ${account.username}?`)}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("申请人将看到“申请已拒绝”，这条申请会移出待审批列表。", "The applicant will see “Application rejected” and the request will leave the pending list.")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel type="button">{t("取消", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction type="button" disabled={busy} onClick={() => void reject({ id: account.id })}
                  className="bg-rose-800 text-white hover:bg-rose-900">{t("确认拒绝", "Confirm rejection")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </form>
  );
}

export function ApprovalQueue({ view, approve, reject, busy }: ReviewActions & { view: Dashboard }) {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const applications = view.approvals.filter(applicant => applicant.username.includes(search.trim().toLowerCase()));
  return (
    <section id="approvals" aria-labelledby="approvals-title" className="scroll-mt-28 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 id="approvals-title" className="text-xl font-bold">{t("待审批申请", "Pending applications")} ({view.approvals.length})</h2>
      <p className="mt-2 text-sm text-slate-700">
        {view.self.role === "system" ? t("可审批所有辖区的注册申请。", "You can approve registrations for all jurisdictions.") :
          t("这里列出本辖区内可由你审批的注册申请。", "These registrations are awaiting your approval within your jurisdiction.")}
        {" "}{t("批准后可在账号授权中分配模型及资料权限。", "Model and record access can be assigned after approval.")}
      </p>
      {view.approvals.length > 0 && (
        <label className="mt-4 block text-sm font-medium">
          {t("按用户名查找申请", "Find an application by username")}
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} className="mt-1 block w-full max-w-sm rounded-lg border border-slate-400 px-3 py-2" />
        </label>
      )}
      <div className="mt-4 space-y-3">
        {applications.length ? applications.map(account => <ApprovalRequest key={account.id} account={account} view={view} approve={approve} reject={reject} busy={busy} />) :
          <p className="text-sm text-slate-600">{view.approvals.length ? t("没有匹配的申请。", "No matching applications.") : t("暂无待审批申请。", "No pending applications.")}</p>}
      </div>
    </section>
  );
}
