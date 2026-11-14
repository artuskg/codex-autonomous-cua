import assert from "node:assert/strict";
import test from "node:test";
import { inventoryMarker, parseInventoryResult } from "../scripts/smoke-inventory.mjs";

const result = `${inventoryMarker}{"apps":true,"browsers":true}`;

test("accepts inventory after a coalesced SDK warning", () => {
  assert.deepEqual(parseInventoryResult([
    "  WARN  [Statsig] SDK initialization has not completed. Reason: Loading:Unrecognized\n" + result,
  ]), { apps: true, browsers: true });
});

test("accepts an isolated result and CRLF diagnostics", () => {
  assert.deepEqual(parseInventoryResult(["documentation", result]), { apps: true, browsers: true });
  assert.deepEqual(parseInventoryResult(["warning\r\n" + result + "\r\n"]), { apps: true, browsers: true });
});

test("requires a unique marked result rather than JSON in documentation", () => {
  assert.equal(parseInventoryResult(['{"apps":true,"browsers":true}']), null);
  assert.equal(parseInventoryResult([result, result]), null);
});

test("rejects malformed or unsuccessful inventory results", () => {
  for (const value of ["broken", "null", "{}", '{"apps":true,"browsers":false}', '{"apps":"true","browsers":true}']) {
    assert.equal(parseInventoryResult([inventoryMarker + value]), null);
  }
});
