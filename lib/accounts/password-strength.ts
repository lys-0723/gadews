export function evaluatePassword(password: string) {
  const length = Array.from(password).length;
  const longEnough = length >= 7;
  const withinLimit = password.length <= 128;
  const hasUppercase = /[A-Z]/.test(password);
  const hasSpecial = /[\p{P}\p{S}]/u.test(password);
  const valid = longEnough && withinLimit && hasUppercase && hasSpecial;

  let strength: "weak" | "medium" | "strong" = "weak";
  if (valid) {
    strength = length >= 12 && /[a-z]/.test(password) && /[0-9]/.test(password) ? "strong" : "medium";
  }

  return { longEnough, withinLimit, hasUppercase, hasSpecial, valid, strength };
}
