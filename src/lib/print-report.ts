import { categoryForProduct, type DailyReport, type ProductRow } from './data';
import { aggregateDisplayProducts } from './display-products';
import { focusEan, type FocusProduct } from './focus-products';
import { summarizeFocusProducts } from './focus-products-summary';
import { buildSalesGroups, type SalesGroup } from './sales-visuals';

export const REPORT_AREAS = [
  { id: 'exterior', name: 'Eksteriørmaling' },
  { id: 'interior', name: 'Interiørmaling' },
  { id: 'terrace', name: 'Terrasse' },
  { id: 'tools', name: 'Malerverktøy' },
  { id: 'focus', name: 'Fokusprodukter' },
  { id: 'total', name: 'Vareområde Maling' },
] as const;
export type ReportArea = typeof REPORT_AREAS[number]['id'];
export type ReportTotals = { revenue: number; profit: number; quantity: number; margin: number };
export type ReportStore = ReportTotals & { storeId: string; store: string; rank: number };

export function reportTotals(rows: Pick<ProductRow, 'revenue' | 'profit' | 'quantity'>[]): ReportTotals {
  const sum = rows.reduce((sum, row) => ({ revenue: sum.revenue + row.revenue, profit: sum.profit + row.profit, quantity: sum.quantity + row.quantity }), { revenue: 0, profit: 0, quantity: 0 });
  return { ...sum, margin: sum.revenue ? sum.profit / sum.revenue * 100 : 0 };
}

/** Keep every previously listed top category; show the remaining contribution explicitly. */
export function reportGroups(groups: SalesGroup[], limit: number): SalesGroup[] {
  if (groups.length <= limit) return groups;
  const remaining = reportTotals(groups.slice(limit));
  return [...groups.slice(0, limit), { name: 'Andre underkategorier', ...remaining, color: '#99a7b8' }];
}

export function buildPrintReport(report: DailyReport, selectedStoreId: string, focusProducts: FocusProduct[]) {
  const focusCodes = new Set(focusProducts.map(product => product.ean));
  const selectedRows = report.rows.filter(row => selectedStoreId === '__all__' || row.storeId === selectedStoreId);
  return REPORT_AREAS.map(area => {
    const inArea = (row: ProductRow) => area.id === 'total' || (area.id === 'focus' ? focusCodes.has(focusEan(row)) : (row.area || 'exterior') === area.id);
    const rows = selectedRows.filter(inArea);
    const byStore = new Map<string, ProductRow[]>();
    for (const row of report.rows.filter(inArea)) {
      const group = byStore.get(row.storeId) || []; group.push(row); byStore.set(row.storeId, group);
    }
    const stores: ReportStore[] = [...byStore.entries()].map(([storeId, group]) => ({ storeId, store: group[0].store, ...reportTotals(group), rank: 0 }))
      .sort((a, b) => b.margin - a.margin || a.store.localeCompare(b.store, 'nb')).map((store, index) => ({ ...store, rank: index + 1 }));
    const selectedRank = stores.findIndex(store => store.storeId === selectedStoreId);
    const regionalStores = selectedRank >= 5 ? [...stores.slice(0, 4), stores[selectedRank]] : stores.slice(0, 5);
    const categoryRows = area.id === 'total' ? buildSalesGroups(rows, 'total') : buildSalesGroups(rows.map(row => ({ ...row, subgroup: row.subgroup || row.category || categoryForProduct(row.product, row.rawName) || 'Ikke klassifisert' })), 'tools');
    const suppliers = buildSalesGroups(rows, 'exterior');
    // The three established paint suppliers remain visible even on a day with zero sales for one of them.
    for (const [name, color] of [['Infra', '#8061a6'], ['Butinox', '#3984c5'], ['Jotun', '#efbb43']]) {
      if (!suppliers.some(group => group.name === name)) suppliers.push({ name, color, revenue: 0, profit: 0, quantity: 0, margin: 0 });
    }
    suppliers.sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name, 'nb'));
    const products = aggregateDisplayProducts(rows, selectedStoreId !== '__all__').sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 5);
    return { ...area, rows, totals: reportTotals(rows), stores, regionalStores, selectedRank: selectedRank < 0 ? undefined : selectedRank + 1,
      suppliers, categories: reportGroups(categoryRows, area.id === 'tools' ? 7 : 6), allCategories: categoryRows, products,
      focus: area.id === 'focus' ? summarizeFocusProducts(focusProducts, rows) : undefined };
  });
}

export type PrintReportPage = ReturnType<typeof buildPrintReport>[number];
