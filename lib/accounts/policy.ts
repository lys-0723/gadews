export const roles = ["system", "country", "region", "member"] as const;
export type Role = (typeof roles)[number];
export const models = ["wsd-v1.0", "tilapia-demo-score-v0.1", "knowledge-chat-v1"] as const;
export type Model = (typeof models)[number];
export const areas = { A: ["east", "west"], B: ["north"] } as const;
export type Country = keyof typeof areas;
export const catalog = [
  { id: "E-01", country: "A", region: "east", model: "wsd-v1.0" },
  { id: "W-01", country: "A", region: "west", model: "wsd-v1.0" },
  { id: "E-02", country: "A", region: "east", model: "tilapia-demo-score-v0.1" },
  { id: "N-01", country: "B", region: "north", model: "tilapia-demo-score-v0.1" },
] as const;
export type Sample = (typeof catalog)[number];
export interface Account {
  id: string;
  username: string;
  country: Country;
  region: string;
  role: Role;
  requested: Role;
  status: "pending" | "active" | "disabled";
  parent: string | null;
  models: Model[];
  records: string[];
}
export class AccountError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
type Scope = Pick<Account, "country" | "region">;
export function sameArea(actor: Scope & Pick<Account, "role">, target: Scope) {
  return (
    actor.role === "system" ||
    (actor.country === target.country && (actor.role === "country" || actor.region === target.region))
  );
}
export function childRole(role: Role): Role | undefined {
  return ({ system: "country", country: "region", region: "member", member: undefined } as const)[role];
}
export function isApprovalParent(parent: Scope & Pick<Account, "role">, applicant: Scope & Pick<Account, "requested">) {
  return childRole(parent.role) === applicant.requested && sameArea(parent, applicant);
}
export function canApprove(actor: Account, applicant: Account) {
  return actor.id !== applicant.id && applicant.requested !== "system" && applicant.status === "pending" &&
    (actor.role === "system" || isApprovalParent(actor, applicant));
}
export function canManage(actor: Account, target: Account) {
  if (actor.id === target.id || !childRole(actor.role) || !sameArea(actor, target)) return false;
  return target.status === "pending"
    ? target.requested === childRole(actor.role)
    : target.parent === actor.id && (actor.role === "system" || childRole(actor.role) === target.role);
}
export function access(account: Account, accounts: Account[]) {
  let current = account;
  let allowed = [...account.models];
  let active = account.status === "active";
  while (active && current.role !== "system") {
    const parent = accounts.find((item) => item.id === current.parent);
    if (
      !parent ||
      (parent.role !== "system" && childRole(parent.role) !== current.role) ||
      !sameArea(parent, current) ||
      parent.status !== "active"
    ) {
      active = false;
      break;
    }
    if (parent.role !== "system") allowed = allowed.filter((model) => parent.models.includes(model));
    current = parent;
  }
  const assignable = active ? (account.role === "system" ? [...models] : allowed) : [];
  const usable = active && account.role !== "system" ? allowed : [];
  const readable = active
    ? catalog.filter(
        (record) =>
          account.country === record.country &&
          account.region === record.region &&
          (account.role === "region" || (account.role === "member" && account.records.includes(record.id))),
      )
    : [];
  return { active, assignable, usable, readable };
}
