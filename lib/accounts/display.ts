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
