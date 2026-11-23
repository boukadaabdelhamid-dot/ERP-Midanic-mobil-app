import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminRetoursQueryKey,
  getAdminRetoursUrl,
} from "../../../lib/erp-api-client-react/src/admin-retours-query.ts";
import {
  getCustomerDetailQueryKey,
  getCustomerDetailUrl,
} from "../../../lib/erp-api-client-react/src/customer-detail-query.ts";
import { parseContactMoneyAmount } from "../lib/contact-money-operation.ts";

test("customer details request only that customer's returns", () => {
  const params = { clientUserId: 42, limit: 20 };
  assert.equal(getAdminRetoursUrl(params), "/api/admin/retours?clientUserId=42&limit=20");
  assert.deepEqual(getAdminRetoursQueryKey(params), ["/api/admin/retours", params]);
  assert.notDeepEqual(getAdminRetoursQueryKey(), getAdminRetoursQueryKey(params));
});

test("the full returns list keeps its existing unfiltered URL and cache key", () => {
  assert.equal(getAdminRetoursUrl(), "/api/admin/retours");
  assert.deepEqual(getAdminRetoursQueryKey(), ["/api/admin/retours"]);
});

test("mobile customer detail requests a small history without notes", () => {
  const params = { ordersLimit: 20, includeNotes: false };
  assert.equal(
    getCustomerDetailUrl(7, params),
    "/api/erp/customers/7?ordersLimit=20&includeNotes=false",
  );
  assert.deepEqual(getCustomerDetailQueryKey(7, params), ["/api/erp/customers/7", params]);
});

test("contact money amounts accept local decimal separators and Arabic digits", () => {
  assert.equal(parseContactMoneyAmount("١٢٣٫٤٥"), 123.45);
  assert.equal(parseContactMoneyAmount("۱۲۳,۴۰"), 123.4);
  assert.equal(parseContactMoneyAmount("1 250,5"), 1250.5);
});

test("contact money amounts reject invalid, nonpositive, or over-precise values", () => {
  assert.equal(parseContactMoneyAmount("0"), null);
  assert.equal(parseContactMoneyAmount("-10"), null);
  assert.equal(parseContactMoneyAmount("12.345"), null);
  assert.equal(parseContactMoneyAmount("abc"), null);
});
