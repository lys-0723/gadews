import type { Account, Role } from "./policy";

export const roleNames: Record<Role, [string, string]> = {
  system: ["超级管理员", "System administrator"],
  country: ["国家管理员", "Country administrator"],
  region: ["区域管理员", "Regional administrator"],
  member: ["普通用户", "Standard user"],
};

export const areaNames: Record<string, [string, string]> = {
  A: ["示例国甲", "Country A"],
  B: ["示例国乙", "Country B"],
  east: ["东区", "East"],
  west: ["西区", "West"],
  north: ["北区", "North"],
};

export type SessionIdentity = Pick<Account, "username" | "role" | "country" | "region" | "status"> & {
  active: boolean;
};

export function identityLabel(role: Role, status: Account["status"], active: boolean): [string, string] {
  if (status === "pending") return ["待审批", "Pending approval"];
  if (status === "rejected") return ["申请已拒绝", "Application rejected"];
  if (status === "disabled") return ["已停用", "Disabled"];
  return active ? roleNames[role] : ["权限暂不可用", "Access unavailable"];
}
