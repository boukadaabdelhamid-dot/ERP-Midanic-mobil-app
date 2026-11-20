export type ManufacturingRole = "raw_material" | "finished_good";

export function canShowProductionClassification(isFactory: boolean, hasPermission: boolean): boolean {
  return isFactory && hasPermission;
}

export function productionProductFields(isFactory: boolean, values: {
  price: string;
  manufacturingRole: ManufacturingRole;
  isExposed: boolean;
}, canManageManufacturingRole = isFactory) {
  return {
    price: values.price.trim().replace(",", ".") || (isFactory ? "0" : ""),
    isExposed: isFactory && values.manufacturingRole === "raw_material" ? false : values.isExposed,
    ...(isFactory && canManageManufacturingRole ? { manufacturingRole: values.manufacturingRole } : {}),
  };
}
