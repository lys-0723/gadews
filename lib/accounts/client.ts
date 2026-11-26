export const accountMessages: Record<string, [string, string]> = {
  invalid_request: [
    "请核对用户名、密码、辖区或输入格式。",
    "Check the username, password, jurisdiction or input.",
  ],
  invalid_login: ["用户名、密码有误或账号已停用。", "Invalid credentials or disabled account."],
  name_taken: ["此用户名已使用。", "This username is already in use."],
  login_required: ["请重新登录。", "Please sign in."],
  model_denied: ["模型使用权未获分配。", "Model access has not been granted."],
  out_of_scope: [
    "此分配超出你的管理范围，请刷新。",
    "This assignment is outside your scope. Refresh and try again.",
  ],
  record_denied: ["没有这条记录的读取权限。", "You do not have access to this record."],
  store_unavailable: [
    "账号服务暂不可用，请联系维护人员核对存储配置。",
    "Account storage is unavailable. Contact the operator.",
  ],
  not_configured: [
    "模型服务未配置，仍可运行规则演示。",
    "The model service is not configured. The rule preview remains available.",
  ],
  rate_limited: ["操作较频繁，请稍后再试。", "Too many attempts. Please try again later."],
};
export async function accountApi(action?: string, input?: unknown) {
  const response = await fetch(
    "/api/accounts",
    action
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, input }),
          cache: "no-store",
        }
      : { cache: "no-store" },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.code ?? "unavailable");
  return data;
}
