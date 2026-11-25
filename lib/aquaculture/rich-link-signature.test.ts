import assert from "node:assert/strict";
import {
  constants,
  generateKeyPairSync,
  privateDecrypt,
} from "node:crypto";
import test from "node:test";
import {
  buildJavaMapString,
  createRichLinkSignature,
  md5Hex,
} from "./rich-link-signature";

test("buildJavaMapString matches Java TreeMap.toString ordering", () => {
  assert.equal(
    buildJavaMapString({
      page: 1,
      startTime: "2026-03-09",
      appId: "Research:Example",
      limit: 10,
      endTime: "2026-03-09",
    }),
    "{appId=Research:Example, endTime=2026-03-09, limit=10, page=1, startTime=2026-03-09}"
  );
});

test("createRichLinkSignature encrypts the MD5 text with RSA PKCS#1 v1.5", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const params = { appId: "Research:Example", page: 1, limit: 10 };
  const signature = createRichLinkSignature(
    params,
    publicKey.export({ type: "spki", format: "pem" }).toString()
  );
  const decrypted = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(signature, "base64")
  ).toString("utf8");

  assert.equal(decrypted, md5Hex(buildJavaMapString(params)));
});

test("canonical params ignore empty values but retain zero and false", () => {
  assert.equal(buildJavaMapString({ z: undefined, b: false, a: 0, empty: "", none: null }), "{a=0, b=false}");
  assert.equal(md5Hex("{a=0, b=false}"), md5Hex(buildJavaMapString({ b: false, a: 0 })));
});
