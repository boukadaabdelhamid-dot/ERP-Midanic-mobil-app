import assert from "node:assert/strict";
import test from "node:test";
import { filterSuppliers, loadSupplierPages, supplierSearchLocation } from "../lib/supplier-search.ts";

const suppliers = [
  { id: 1, name: "Étoile Fournitures", wilaya: "Béjaïa", commune: "Akbou", address: "12 Rue Centrale" },
  { id: 2, name: "مورد النور", wilaya: "وهران", commune: "السانية", address: null },
  { id: 3, name: "Legacy supplier", city: "Blida", wilaya: null, commune: null },
  { id: 4, name: "No location", city: null, wilaya: null, commune: null },
];

test("searches supplier names regardless of accents, case, or outer spaces", () => {
  assert.deepEqual(filterSuppliers(suppliers, "  ETOILE  ").map((s) => s.id), [1]);
});

test("searches wilaya, commune, address, and legacy city", () => {
  for (const term of ["bejaia", "Akbou", "centrale", "etoile akbou"]) {
    assert.deepEqual(filterSuppliers(suppliers, term).map((s) => s.id), [1]);
  }
  assert.deepEqual(filterSuppliers(suppliers, "بَلدية"), []);
  assert.deepEqual(filterSuppliers(suppliers, "وَهْرَان").map((s) => s.id), [2]);
  assert.deepEqual(filterSuppliers(suppliers, "النور السانية").map((s) => s.id), [2]);
  assert.deepEqual(filterSuppliers(suppliers, "blida").map((s) => s.id), [3]);
});

test("clearing the search restores the original order and supplier objects", () => {
  const original = structuredClone(suppliers);
  const selected = suppliers[0];
  assert.deepEqual(filterSuppliers(suppliers, "no match"), []);
  assert.strictEqual(filterSuppliers(suppliers, "  "), suppliers);
  assert.strictEqual(suppliers[0], selected, "filtering never changes the selected supplier object");
  assert.deepEqual(suppliers, original);
  assert.deepEqual(filterSuppliers(suppliers, "no location").map((s) => s.id), [4]);
});

test("formats locations safely for old records and suppresses duplicate place names", () => {
  assert.equal(supplierSearchLocation(suppliers[0]), "Akbou · Béjaïa");
  assert.equal(supplierSearchLocation(suppliers[2]), "Blida");
  assert.equal(supplierSearchLocation(suppliers[3]), "");
  assert.equal(supplierSearchLocation({ id: 5, name: "Test", commune: "Blida", wilaya: "Blida" }), "Blida");
});

test("search includes suppliers beyond the first page", async () => {
  const firstPage = Array.from({ length: 500 }, (_, index) => ({ id: index + 1, name: `Supplier ${index}` }));
  const lateSupplier = { id: 501, name: "Last supplier", commune: "Oran" };
  const calls = [];
  const all = await loadSupplierPages(async (page, limit) => {
    calls.push([page, limit]);
    return { data: page === 1 ? firstPage : [lateSupplier], total: 501 };
  });
  assert.equal(all.length, 501);
  assert.deepEqual(calls, [[1, 500], [2, 500]]);
  assert.deepEqual(filterSuppliers(all, "Oran"), [lateSupplier]);
});

test("empty lists finish normally; missing pages and network failures are not reported as no matches", async () => {
  assert.deepEqual(await loadSupplierPages(async () => ({ data: [], total: 0 })), []);
  await assert.rejects(loadSupplierPages(async () => ({ data: [], total: 1 })), /Incomplete supplier list/);
  await assert.rejects(loadSupplierPages(async () => { throw new Error("offline"); }), /offline/);
  await assert.rejects(loadSupplierPages(async () => ({ data: null, total: 1 })), /Invalid supplier list/);
});
