import assert from "node:assert/strict";
import test from "node:test";
import { getStoreTheme } from "../lib/store-theme.ts";

test("branches without server colors still receive distinct stable colors", () => {
  const first = getStoreTheme({ id: 1, kind: "store" });
  const second = getStoreTheme({ id: 2, kind: "store" });
  assert.notEqual(first.primary, second.primary);
  assert.deepEqual(first, getStoreTheme({ id: 1, kind: "store" }));
});

test("persisted ERP colors take precedence and factories retain their own palette", () => {
  assert.equal(
    getStoreTheme({ id: 2, kind: "store", navigationColor: "216 48% 18%" }).primary,
    "#182944",
  );
  assert.deepEqual(getStoreTheme({ id: 2, kind: "factory", navigationColor: "216 48% 18%" }), {
    primary: "#29483f", accent: "#d5b47e", isFactory: true,
  });
});
