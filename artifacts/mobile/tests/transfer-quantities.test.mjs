import assert from "node:assert/strict";
import test from "node:test";
import { getTransferQuantities, getTransferActions } from "../hooks/use-transfer-status-actions.ts";

test("partial receipt keeps sent, received, and missing quantities separate", () => {
  assert.deepEqual(getTransferQuantities({ quantity: 10, receivedQuantity: 7 }), { sent: 10, received: 7, missing: 3 });
});

test("a recorded zero is not replaced with the sent quantity", () => {
  assert.deepEqual(getTransferQuantities({ quantity: 10, receivedQuantity: 0 }), { sent: 10, received: 0, missing: 10 });
});

test("legacy or pending receipts remain unknown instead of being invented", () => {
  for (const receivedQuantity of [null, undefined]) {
    assert.deepEqual(getTransferQuantities({ quantity: 10, receivedQuantity }), { sent: 10, received: null, missing: null });
  }
});

test("full and fractional receipts display accurate differences without floating-point residue", () => {
  assert.deepEqual(getTransferQuantities({ quantity: 5, receivedQuantity: 5 }), { sent: 5, received: 5, missing: 0 });
  assert.deepEqual(getTransferQuantities({ quantity: 0.3, receivedQuantity: 0.1 }), { sent: 0.3, received: 0.1, missing: 0.2 });
});

test("quantity presentation does not change receipt data or available actions", () => {
  const item = Object.freeze({ quantity: 2, receivedQuantity: 1 });
  getTransferQuantities(item);
  assert.deepEqual(item, { quantity: 2, receivedQuantity: 1 });
  assert.deepEqual(getTransferActions("in_transit", { isSource: true, isDestination: false, isAdmin: false }), []);
  assert.deepEqual(getTransferActions("in_transit", { isSource: false, isDestination: true, isAdmin: false }).map((a) => a.action), ["receive"]);
  assert.deepEqual(getTransferActions("received", { isSource: false, isDestination: true, isAdmin: true }), []);
});
