import {
  constants,
  createHash,
  publicEncrypt,
} from "node:crypto";

type SignableValue = string | number | boolean;

export type RichLinkSignatureParams = Record<
  string,
  SignableValue | null | undefined
>;

export function buildJavaMapString(params: RichLinkSignatureParams): string {
  const entries = Object.entries(params)
    .filter((entry): entry is [string, SignableValue] => {
      const value = entry[1];
      return value !== undefined && value !== null && value !== "";
    })
    .sort(([left], [right]) => {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });

  return `{${entries.map(([key, value]) => `${key}=${value}`).join(", ")}}`;
}

export function md5Hex(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex");
}

export function normalizePublicKey(publicKey: string): string {
  const normalized = publicKey.trim().replace(/\\n/g, "\n");
  if (normalized.includes("BEGIN PUBLIC KEY")) return normalized;

  const compact = normalized.replace(/\s+/g, "");
  const lines = compact.match(/.{1,64}/g)?.join("\n") ?? compact;
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

export function createRichLinkSignature(
  params: RichLinkSignatureParams,
  publicKey: string
): string {
  const digest = md5Hex(buildJavaMapString(params));
  return publicEncrypt(
    {
      key: normalizePublicKey(publicKey),
      padding: constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(digest, "utf8")
  ).toString("base64");
}
