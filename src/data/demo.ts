export type Supplier = "Infra" | "Butinox" | "Jotun";
export type ProductRow = { name: string; supplier: Supplier; size: string; quantity: number; revenue: number; profit: number; margin: number };
export type StoreRow = { store: string; revenue: number; profit: number; margin: number };

export const report = {
  date: "11.07.2026",
  store: "Tønsberg",
  revenue: 148420,
  profit: 53680,
  margin: 36.2,
  regionRank: 1,
  changes: { revenue: 8.4, profit: 11.2, margin: 0.9, rank: 2 },
};

export const suppliers = [
  { name: "Infra" as Supplier, revenue: 75620, profit: 28940, margin: 38.3, share: 51, quantity: 47 },
  { name: "Butinox" as Supplier, revenue: 47210, profit: 17100, margin: 36.2, share: 32, quantity: 29 },
  { name: "Jotun" as Supplier, revenue: 25590, profit: 7640, margin: 29.9, share: 17, quantity: 14 },
];

export const stores: StoreRow[] = [
  { store: "Tønsberg", revenue: 148420, profit: 53680, margin: 36.2 },
  { store: "Sandefjord", revenue: 129870, profit: 44620, margin: 34.4 },
  { store: "Larvik", revenue: 113450, profit: 40210, margin: 35.4 },
  { store: "Kongsberg", revenue: 99840, profit: 32940, margin: 33.0 },
  { store: "Mjøndalen", revenue: 91420, profit: 31800, margin: 34.8 },
];

export const products: ProductRow[] = [
  { name: "Infra Premium Dekkende", supplier: "Infra", size: "10 L", quantity: 16, revenue: 31984, profit: 12750, margin: 39.9 },
  { name: "Infra Premium Oljebeis", supplier: "Infra", size: "9 L", quantity: 13, revenue: 24687, profit: 9180, margin: 37.2 },
  { name: "Infra Grunning", supplier: "Infra", size: "10 L", quantity: 9, revenue: 12591, profit: 4810, margin: 38.2 },
  { name: "Butinox Futura Dekkende", supplier: "Butinox", size: "9 L", quantity: 12, revenue: 26388, profit: 9780, margin: 37.1 },
  { name: "Butinox Futura Soft Look", supplier: "Butinox", size: "9 L", quantity: 8, revenue: 15192, profit: 5480, margin: 36.1 },
  { name: "Butinox Terrassebeis", supplier: "Butinox", size: "9 L", quantity: 5, revenue: 5630, profit: 1840, margin: 32.7 },
  { name: "Drygolin Nordic Extreme", supplier: "Jotun", size: "10 L", quantity: 7, revenue: 13993, profit: 4320, margin: 30.9 },
  { name: "Drygolin Power Clean", supplier: "Jotun", size: "10 L", quantity: 4, revenue: 7196, profit: 2150, margin: 29.9 },
  { name: "Trebitt Oljebeis", supplier: "Jotun", size: "9 L", quantity: 3, revenue: 4401, profit: 1170, margin: 26.6 },
];

export const history = [
  { date: "11.07.2026", revenue: 148420, margin: 36.2, rank: 1 },
  { date: "10.07.2026", revenue: 136900, margin: 35.3, rank: 2 },
  { date: "09.07.2026", revenue: 121780, margin: 34.9, rank: 2 },
  { date: "08.07.2026", revenue: 154100, margin: 36.8, rank: 1 },
  { date: "07.07.2026", revenue: 118220, margin: 35.1, rank: 3 },
];
