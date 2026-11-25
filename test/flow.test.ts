import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHandheldFlow } from "../lib/flow";

describe("handheld scan flow", () => {
  it("treats the take page as a focused screen", () => {
    assert.equal(isHandheldFlow("/scan"), false);
    assert.equal(isHandheldFlow("/items/11111111-1111-4111-8111-111111111111/take"), true);
    assert.equal(isHandheldFlow("/items/11111111-1111-4111-8111-111111111111/take/"), true);
  });

  it("leaves the rest of the app in the normal frame", () => {
    assert.equal(isHandheldFlow("/"), false);
    assert.equal(isHandheldFlow("/items/11111111-1111-4111-8111-111111111111"), false);
    assert.equal(isHandheldFlow("/items/11111111-1111-4111-8111-111111111111/label"), false);
    assert.equal(isHandheldFlow("/ledger"), false);
  });
});
