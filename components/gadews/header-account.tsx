"use client";

import Link from "next/link";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { areaNames, identityLabel, type SessionIdentity } from "@/lib/accounts/display";
import { useLocale } from "./locale-provider";

export function HeaderAccount() {
  const { t } = useLocale();
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let request: AbortController | undefined;
    async function refresh() {
      request?.abort();
      const current = new AbortController();
      request = current;
      try {
        const response = await fetch("/api/accounts/session", { cache: "no-store", signal: current.signal });
        const next: SessionIdentity | null = response.ok ? await response.json() : null;
        if (!current.signal.aborted) {
          setIdentity(next);
          if (!next) setOpen(false);
        }
      } catch {
        if (!current.signal.aborted) {
          setIdentity(null);
          setOpen(false);
        }
      }
    }
    const refreshWhenVisible = () => { if (!document.hidden) void refresh(); };
    void refresh();
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("pageshow", refreshWhenVisible);
    window.addEventListener("gadews:session-changed", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const timer = window.setInterval(refreshWhenVisible, 60000);
    return () => {
      request?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshWhenVisible);
      window.removeEventListener("gadews:session-changed", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function logout() {
    setSigningOut(true);
    setLogoutFailed(false);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) throw new Error("logout");
      // Discard the entire authenticated view, including any in-memory account details.
      window.location.replace("/");
    } catch {
      setSigningOut(false);
      setLogoutFailed(true);
    }
  }

  if (!identity) return (
    <div className="site-account site-signin-links" aria-label={t("账号登录", "Sign in")}>
      <Link href="/login?entry=user"><UserRound size={16} aria-hidden="true" />{t("普通用户登录", "User login")}</Link>
      <Link href="/login?entry=admin"><ShieldCheck size={16} aria-hidden="true" />{t("管理员登录", "Admin login")}</Link>
    </div>
  );

  const approved = identity.active && identity.status === "active";
  const role = t(...identityLabel(identity.role, identity.status, identity.active));
  const country = areaNames[identity.country];
  const region = areaNames[identity.region];
  let scope = "";
  if (approved) {
    if (identity.role === "system") scope = t("系统维护", "System maintenance");
    else scope = [country && t(...country), identity.role !== "country" && region && t(...region)].filter(Boolean).join(" · ");
  }
  return (
    <div className="site-account site-identity" ref={root}>
      <button ref={trigger} className="site-identity-trigger" type="button"
        aria-expanded={open} aria-controls={open ? "site-account-panel" : undefined}
        onClick={() => { setOpen(!open); setLogoutFailed(false); }}>
        <UserRound size={17} aria-hidden="true" />
        <span className="site-identity-label"><strong>{role}</strong>{scope && <small>{scope}</small>}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && <div id="site-account-panel" className="site-account-panel">
        <strong className="site-account-name">{identity.username}</strong>
        {identity.active && identity.role !== "member" && (
          <Link href="/accounts#approvals" onClick={() => setOpen(false)}>{t("待审批申请", "Pending applications")}</Link>
        )}
        {identity.active && identity.role === "system" && (
          <Link href="/accounts#user-permissions" onClick={() => setOpen(false)}>{t("用户权限管理", "User permissions")}</Link>
        )}
        <Link href="/accounts" onClick={() => setOpen(false)}>{t("账号管理", "Account settings")}</Link>
        <button type="button" disabled={signingOut} onClick={logout}><LogOut size={16} aria-hidden="true" />
          {signingOut ? t("正在退出…", "Signing out…") : t("退出登录", "Sign out")}
        </button>
        {logoutFailed && <p role="alert">{t("退出失败，请重试。", "Could not sign out. Please retry.")}</p>}
      </div>}
    </div>
  );
}
