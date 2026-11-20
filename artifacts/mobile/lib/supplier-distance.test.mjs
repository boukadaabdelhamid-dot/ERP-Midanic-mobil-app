import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSupplierDistance,
  getSupplierDistanceKm,
  hasValidSupplierCoordinates,
  sortSuppliersByDistance,
} from "./supplier-distance.ts";

const origin = { latitude: 0, longitude: 0 };

test("calculates a great-circle distance from saved GPS coordinates", () => {
  const distance = getSupplierDistanceKm({ latitude: 0, longitude: 1 }, origin);
  assert.ok(distance !== null);
  assert.ok(Math.abs(distance - 111.195) < 0.1);
});

test("keeps GPS suppliers nearest-first and leaves suppliers without GPS visible at the end", () => {
  const suppliers = [
    { id: 1, latitude: 0, longitude: 0.1 },
    { id: 2, latitude: null, longitude: null },
    { id: 3, latitude: 0, longitude: 0.01 },
    { id: 4, latitude: null, longitude: null },
  ];

  assert.deepEqual(
    sortSuppliersByDistance(suppliers, origin).map((supplier) => supplier.id),
    [3, 1, 2, 4],
  );
  assert.deepEqual(
    sortSuppliersByDistance(suppliers, null).map((supplier) => supplier.id),
    [1, 2, 3, 4],
  );
});

test("does not calculate distances from invalid or missing GPS coordinates", () => {
  assert.equal(getSupplierDistanceKm({ latitude: null, longitude: null }, origin), null);
  assert.equal(getSupplierDistanceKm({ latitude: 91, longitude: 0 }, origin), null);
  assert.equal(hasValidSupplierCoordinates({ latitude: 0, longitude: 181 }), false);
});

test("formats short distances as meters and longer distances as kilometers", () => {
  assert.equal(formatSupplierDistance(0.5, "fr"), "500 m");
  assert.equal(formatSupplierDistance(2.345, "fr"), "2,3 km");
  assert.match(formatSupplierDistance(2, "ar"), /كم$/);
});
