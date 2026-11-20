import assert from "node:assert/strict";
import test from "node:test";
import { productionProductFields } from "../lib/production-products.ts";

test("factory raw materials have no retail price and cannot be exposed for sale", () => {
  assert.deepEqual(productionProductFields(true, {
    price: "", manufacturingRole: "raw_material", isExposed: true,
  }), { price: "0", manufacturingRole: "raw_material", isExposed: false });
});

test("factory finished goods preserve their role and normalize decimal prices", () => {
  assert.deepEqual(productionProductFields(true, {
    price: " 12,50 ", manufacturingRole: "finished_good", isExposed: true,
  }), { price: "12.50", manufacturingRole: "finished_good", isExposed: true });
});

test("ordinary store product requests omit the manufacturing role", () => {
  assert.deepEqual(productionProductFields(false, {
    price: "25", manufacturingRole: "finished_good", isExposed: true,
  }), { price: "25", isExposed: true });
});
