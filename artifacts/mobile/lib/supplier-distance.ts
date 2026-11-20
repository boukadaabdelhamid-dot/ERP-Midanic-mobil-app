export type DeviceCoordinates = {
  latitude: number;
  longitude: number;
};

export type SupplierCoordinates = {
  latitude: number | null;
  longitude: number | null;
};

const EARTH_RADIUS_KM = 6371.0088;

function validCoordinates(point: DeviceCoordinates): boolean {
  return Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && point.longitude >= -180
    && point.longitude <= 180;
}

export function hasValidSupplierCoordinates(supplier: SupplierCoordinates): boolean {
  return typeof supplier.latitude === "number"
    && typeof supplier.longitude === "number"
    && validCoordinates({ latitude: supplier.latitude, longitude: supplier.longitude });
}

export function getSupplierDistanceKm(
  supplier: SupplierCoordinates,
  origin: DeviceCoordinates | null,
): number | null {
  if (!origin || !validCoordinates(origin)) return null;
  const latitude = supplier.latitude;
  const longitude = supplier.longitude;
  if (
    typeof latitude !== "number"
    || typeof longitude !== "number"
    || !validCoordinates({ latitude, longitude })
  ) {
    return null;
  }

  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(latitude - origin.latitude);
  const longitudeDelta = toRadians(longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const supplierLatitude = toRadians(latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(supplierLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function sortSuppliersByDistance<T extends SupplierCoordinates>(
  suppliers: readonly T[],
  origin: DeviceCoordinates | null,
): T[] {
  if (!origin || !validCoordinates(origin)) return [...suppliers];

  return [...suppliers].sort((a, b) => {
    const distanceA = getSupplierDistanceKm(a, origin);
    const distanceB = getSupplierDistanceKm(b, origin);
    if (distanceA == null) return distanceB == null ? 0 : 1;
    if (distanceB == null) return -1;
    return distanceA - distanceB;
  });
}

export function formatSupplierDistance(distanceKm: number, lang: string): string {
  if (distanceKm < 1) {
    const meters = Math.max(10, Math.round(distanceKm * 100) * 10);
    return `${meters} ${lang === "ar" ? "م" : "m"}`;
  }

  const distance = new Intl.NumberFormat(lang === "ar" ? "ar-DZ" : "fr-DZ", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(distanceKm);
  return `${distance} ${lang === "ar" ? "كم" : "km"}`;
}
