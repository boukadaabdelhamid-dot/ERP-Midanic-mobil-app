export type SearchableSupplier = {
  id: number;
  name: string;
  city?: string | null;
  wilaya?: string | null;
  commune?: string | null;
  address?: string | null;
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
}

/** Search does not reorder, mutate, select, or deselect any supplier. */
export function filterSuppliers<T extends SearchableSupplier>(suppliers: T[], search: string): T[] {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  if (!terms.length) return suppliers;
  return suppliers.filter((supplier) => {
    const text = normalize([
      supplier.name, supplier.wilaya, supplier.commune, supplier.city, supplier.address,
    ].filter(Boolean).join(" "));
    return terms.every((term) => text.includes(term));
  });
}

export function supplierSearchLocation(supplier: SearchableSupplier): string {
  const parts = [supplier.commune?.trim() || supplier.city?.trim(), supplier.wilaya?.trim()];
  return [...new Set(parts.filter((part): part is string => !!part))].join(" · ");
}

/** Fetch every page: a missing result in the first 500 is not "not found". */
export async function loadSupplierPages<T extends SearchableSupplier>(
  fetchPage: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
): Promise<T[]> {
  const suppliers = new Map<number, T>();
  const limit = 500;
  let fetched = 0;
  for (let page = 1; ; page++) {
    const result = await fetchPage(page, limit);
    if (!Array.isArray(result.data) || !Number.isFinite(result.total) || result.total < 0) {
      throw new Error("Invalid supplier list response");
    }
    fetched += result.data.length;
    for (const supplier of result.data) suppliers.set(supplier.id, supplier);
    if (fetched >= result.total) return [...suppliers.values()];
    if (!result.data.length) throw new Error("Incomplete supplier list response");
  }
}
