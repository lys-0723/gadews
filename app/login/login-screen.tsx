"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Shield, UserRound } from "lucide-react";
import { StickyHeader } from "@/components/gadews/sticky-header";
import { useLocale } from "@/components/gadews/locale-provider";
import { accountApi, accountMessages } from "@/lib/accounts/client";
import { identityLabel, roleNames, type SessionIdentity } from "@/lib/accounts/display";
import styles from "./login.module.css";

export function LoginScreen({ entry }: { entry: "admin" | "user" }) {
  const { t } = useLocale();
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const admin = entry === "admin";

  useEffect(() => {
    const controller = new AbortController();
    async function readSession() {
      try {
        const response = await fetch("/api/accounts/session", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("store_unavailable");
        const current: SessionIdentity | null = await response.json();
        if (!controller.signal.aborted) setIdentity(current);
      } catch {
        if (!controller.signal.aborted) setError("store_unavailable");
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }
    void readSession();
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const input = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await accountApi("login", input);
      window.location.replace("/accounts");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await accountApi("logout");
      setIdentity(null);
      setShowPassword(false);
      window.dispatchEvent(new Event("gadews:session-changed"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <StickyHeader variant="dark" />
      <main className={styles.layout}>
        <aside className={styles.seascape}>
          <Image src="/images/pexels-pham-t-tri-139436170-16296413.jpg" alt="" fill sizes="(min-width: 810px) 50vw, 100vw" priority />
          <div className={styles.caption}>
            <span>{t("全球水产养殖", "Global Aquaculture")}</span>
            <span>{t("疫病早期预警系统", "Disease Early Warning System")}</span>
          </div>
        </aside>
        <section className={styles.panel} aria-labelledby="login-title">
          <div className={styles.formBox}>
            <h1 id="login-title">{identity ? t("当前账号", "Current account") : t("登录 GADEWS", "Sign in to GADEWS")}</h1>
            {checking ? <p role="status">{t("正在读取账号…", "Checking your session…")}</p> : identity ? (
              <>
                <p className={styles.identity}>
                  <strong>{identity.username}</strong>
                  <span>{t(...identityLabel(identity.role, identity.status, identity.active))}</span>
                </p>
                <Link className={styles.primary} href="/accounts">{t("进入账号工作区", "Open workspace")} <ArrowRight size={19} /></Link>
                <button type="button" className={styles.textButton} disabled={busy} onClick={signOut}>
                  {t("退出并切换账号", "Sign out to switch account")}
                </button>
              </>
            ) : (
              <>
                <nav className={styles.entries} aria-label={t("选择登录入口", "Select a sign-in entry")}>
                  <Link href="/login?entry=user" aria-current={!admin ? "page" : undefined}>
                    <UserRound size={18} aria-hidden />{t(...roleNames.member)}
                  </Link>
                  <Link href="/login?entry=admin" aria-current={admin ? "page" : undefined}>
                    <Shield size={18} aria-hidden />{t("管理员", "Administrator")}
                  </Link>
                </nav>
                <p className={styles.note}>{admin
                  ? t("适用于超级、国家及区域管理员。登录后按账号获批的身份和辖区进入工作区。", "For system, country and regional administrators. Your approved role and jurisdiction determine workspace access.")
                  : t("使用本站账号查看申请状态、获配的资料与模型。", "Use your GADEWS account to view your application, assigned records and models.")}</p>
                <form className={styles.form} onSubmit={submit}>
                  <label htmlFor="login-username">{t("用户名", "Username")}</label>
                  <input id="login-username" name="username" required autoCapitalize="none" spellCheck={false} maxLength={40} autoComplete="username" />
                  <label htmlFor="login-password">{t("密码", "Password")}</label>
                  <div className={styles.passwordField}>
                    <input id="login-password" name="password" type={showPassword ? "text" : "password"} required maxLength={128} autoComplete="current-password" />
                    <button className={styles.reveal} type="button" aria-label={showPassword ? t("隐藏密码", "Hide password") : t("显示密码", "Show password")} onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                    </button>
                  </div>
                  <button className={styles.primary} disabled={busy}>
                    {busy ? t("正在登录…", "Signing in…") : t("登录", "Sign in")} <ArrowRight size={19} aria-hidden />
                  </button>
                </form>
                <p className={styles.register}>{t("还没有账号？", "New to GADEWS?")}{" "}
                  <Link href="/accounts?mode=register">{t("注册账号", "Create an account")}</Link>
                </p>
              </>
            )}
            {error && <p role="alert" className={styles.error}>
              {t(...(accountMessages[error] ?? ["服务暂不可用，请重试。", "The service is unavailable. Try again."]))}
            </p>}
          </div>
        </section>
      </main>
    </div>
  );
}
