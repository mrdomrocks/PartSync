import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { labelTarget, parseScannedItem } from "../lib/labels";

const id = "11111111-1111-4111-8111-111111111111";

describe("shelf labels", () => {
  it("builds a take link from the network address", () => {
    const target = labelTarget("http://192.168.1.20:4747/", "http://localhost:4747", id);
    assert.equal(target.url, `http://192.168.1.20:4747/items/${id}/take`);
    assert.equal(target.warning, null);
  });

  it("warns when the only address is this machine", () => {
    const target = labelTarget("", "http://127.0.0.1:4747", id);
    assert.equal(target.url, `http://127.0.0.1:4747/items/${id}/take`);
    assert.match(target.warning ?? "", /Setup has the address/);
  });

  it("reads an item id from a take link or an item link", () => {
    assert.equal(parseScannedItem(`http://192.168.1.20:4747/items/${id}/take`), id);
    assert.equal(parseScannedItem(`http://10.0.0.8:4747/items/${id}`), id);
    assert.equal(parseScannedItem(`http://10.0.0.8:4747/items/${id}/?x=1`), id);
    assert.equal(parseScannedItem(`/items/${id.toUpperCase()}/take`), id);
  });

  it("rejects codes that are not an item", () => {
    assert.equal(parseScannedItem("https://example.com"), null);
    assert.equal(parseScannedItem(`http://192.168.1.20:4747/items/${id}/label`), null);
    assert.equal(parseScannedItem(`http://192.168.1.20:4747/boms/${id}`), null);
    assert.equal(parseScannedItem("not a code"), null);
    assert.equal(parseScannedItem(""), null);
  });
});
