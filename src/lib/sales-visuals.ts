import type { ProductRow } from './data';

export type SalesGroup = { name: string; revenue: number; profit: number; quantity: number; margin: number; color: string };
const colors: Record<string, string> = {
  Infra: '#8061a6', Butinox: '#3984c5', Jotun: '#efbb43', Jordan: '#ea863c', 'Øvrig': '#91a0b4',
  Eksteriørmaling: '#345a87', Interiørmaling: '#34988c', Terrasse: '#c7a267', Malerverktøy: '#ec8b44',
};
const areaNames: Record<string, string> = { exterior: 'Eksteriørmaling', interior: 'Interiørmaling', terrace: 'Terrasse', tools: 'Malerverktøy' };
const palette = ['#345a87', '#34988c', '#ec8b44', '#8061a6', '#c7a267', '#91a0b4'];

/** Group the selected data once, keeping returns and every supplier in the totals. */
export function buildSalesGroups(rows: ProductRow[], area: string): SalesGroup[] {
  const groups = new Map<string, SalesGroup>();
  for (const row of rows) {
    const name = area === 'total' ? areaNames[row.area || 'exterior'] || 'Annet'
      : area === 'tools' ? row.subgroup || 'Ikke klassifisert' : row.supplier || 'Øvrig';
    const group = groups.get(name) || { name, revenue: 0, profit: 0, quantity: 0, margin: 0, color: '' };
    group.revenue += row.revenue; group.profit += row.profit; group.quantity += row.quantity;
    groups.set(name, group);
  }
  return [...groups.values()].sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name, 'nb'))
    .map((group, index) => ({ ...group, margin: group.revenue ? group.profit / group.revenue * 100 : 0, color: colors[group.name] || palette[index % palette.length] }));
}

export function weightedSalesMargin(stores: { revenue: number; profit: number }[]) {
  const total = stores.reduce((sum, store) => ({ revenue: sum.revenue + store.revenue, profit: sum.profit + store.profit }), { revenue: 0, profit: 0 });
  return total.revenue ? total.profit / total.revenue * 100 : 0;
}

/** Every net-selling product qualifies, including one sold unit. Returns alone have no sales margin to rank. */
export function highestMarginProduct(rows: ProductRow[]): ProductRow | undefined {
  return rows.reduce<ProductRow | undefined>((best, row) => {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0 || !Number.isFinite(row.revenue) || row.revenue <= 0 || !Number.isFinite(row.profit)) return best;
    const margin = row.profit / row.revenue * 100;
    if (!Number.isFinite(margin)) return best;
    if (!best || margin > best.margin || (margin === best.margin && row.profit > best.profit)) return { ...row, margin };
    return best;
  }, undefined);
}

export function salesCategoryLeaders(rows: ProductRow[]) {
  return Object.entries(areaNames).flatMap(([area, name]) => {
    const stores = new Map<string, { store: string; revenue: number; profit: number }>();
    for (const row of rows.filter(row => (row.area || 'exterior') === area)) {
      const store = stores.get(row.storeId) || { store: row.store, revenue: 0, profit: 0 };
      store.revenue += row.revenue; store.profit += row.profit; stores.set(row.storeId, store);
    }
    const leader = [...stores.values()].filter(store => store.revenue > 0)
      .sort((a, b) => b.profit / b.revenue - a.profit / a.revenue || a.store.localeCompare(b.store, 'nb'))[0];
    return leader ? [{ area, name, store: leader.store, margin: leader.profit / leader.revenue * 100, color: colors[name] }] : [];
  });
}
