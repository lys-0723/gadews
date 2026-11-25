import assert from "node:assert/strict";
import test from "node:test";
import { shouldAutoplayMedia } from "./media-policy";

test("ecological footage autoplays only on visible desktop without static preferences", () => {
  const normal = { visible: true, hidden: false, narrow: false, reducedMotion: false, saveData: false, userPaused: false };
  assert.equal(shouldAutoplayMedia(normal), true);
  for (const key of ["hidden", "narrow", "reducedMotion", "saveData", "userPaused"] as const) assert.equal(shouldAutoplayMedia({ ...normal, [key]: true }), false, key);
  assert.equal(shouldAutoplayMedia({ ...normal, visible: false }), false);
});
