'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BarChart3, Coins, ImageOff, Layers3, Package, Percent, Target, Trophy } from 'lucide-react';
import type { DailyReport, Period, ProductRow } from '@/lib/data';
import { appPath } from '@/lib/base-path';
import type { FocusProduct } from '@/lib/focus-products';
import { buildPrintReport, type PrintReportPage } from '@/lib/print-report';
import { marginTone } from '@/lib/presentation';
import type { SalesGroup } from '@/lib/sales-visuals';
import { productSubtitle } from '@/lib/display-products';

const number = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
const money = (n: number) => `${Math.round(n).toLocaleString('nb-NO')} kr`;
const pct = (n: number) => `${n.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const cleanName = (name: string) => name.replace(/^Obs Bygg\s+/i, '').replace(/^X\s+/, '');
const image = (row: ProductRow) => appPath(row.image || `/api/product-image?${new URLSearchParams({ product: row.product, supplier: row.supplier, size: row.size || '', ean: row.ean || '', itemNo: row.itemNo || '', key: row.productKey || '' })}`);

function ReportImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="prImageMissing" aria-label="Produktbilde mangler"><ImageOff /></span> : <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

function ReportStat({ label, value, note, icon, featured }: { label: string; value: string; note: string; icon: ReactNode; featured?: boolean }) {
  return <article className={`prStat${featured ? ' prFeatured' : ''}`}><div><span>{label}</span>{icon}</div><strong>{value}</strong><small>{note}</small></article>;
}

function ReportPanel({ title, subtitle, icon, children, className = '' }: { title: string; subtitle: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`prPanel ${className}`}><header><div><h2>{title}</h2><p>{subtitle}</p></div>{icon}</header>{children}</section>;
}

function GroupRows({ groups, totalRevenue }: { groups: SalesGroup[]; totalRevenue: number }) {
  const maximum = Math.max(1, ...groups.map(group => Math.abs(group.revenue)));
  return <div className={`prGroupRows${groups.length > 6 ? ' prDenseGroups' : ''}`}>{groups.map(group => <div className="prGroup" key={group.name} style={{ '--pr-group-color': group.color } as CSSProperties}><div className="prGroupTitle"><b>{group.name}</b><strong>{pct(totalRevenue ? group.revenue / totalRevenue * 100 : 0)}</strong></div><div className="prTrack"><i style={{ width: `${Math.abs(group.revenue) / maximum * 100}%`, background: group.revenue < 0 ? '#b5554a' : undefined }} /></div><div className="prGroupValues"><span>{money(group.revenue)}</span><span className={group.profit < 0 ? 'prNegative' : 'prPositive'}>{money(group.profit)}</span><b className={`prTone-${marginTone(group.margin)}`}>{pct(group.margin)}</b></div></div>)}</div>;
}

function RegionTable({ page, storeName, national }: { page: PrintReportPage; storeName: string; national: boolean }) {
  return <ReportPanel title="Regionsrangering" subtitle="Topp 5 etter fortjenesteprosent" icon={<Trophy />} className="prRegion"><table><thead><tr><th>#</th><th>Varehus</th><th>Omsetning</th><th>Fortjeneste</th><th>Fortj. %</th></tr></thead><tbody>{page.regionalStores.map(store => <tr key={store.storeId} className={!national && store.rank === page.selectedRank ? 'prFocusStore' : ''}><td><b>{store.rank}</b></td><th>{cleanName(store.store)}</th><td>{money(store.revenue)}</td><td className={store.profit < 0 ? 'prNegative' : 'prPositive'}>{money(store.profit)}</td><td className={`prTone-${marginTone(store.margin)}`}><b>{pct(store.margin)}</b></td></tr>)}</tbody></table>{!page.regionalStores.length && <div className="prEmpty">Ingen registrerte salg i dette vareområdet.</div>}<p className="prRegionNote">{national ? 'Varehusene rangeres på vektet fortjenesteprosent.' : page.selectedRank ? `${storeName} er markert på sin faktiske plass ${page.selectedRank}.` : `${storeName} har ingen registrerte salg i området.`}</p></ReportPanel>;
}

function ProductList({ products }: { products: ProductRow[] }) {
  return <div className="prProductList">{products.map((row, index) => <article key={`${row.productKey || row.product}-${index}`}><b className="prProductRank">{String(index + 1).padStart(2, '0')}</b><ReportImage key={image(row)} src={image(row)} /><div className="prProductName"><b>{row.product}</b><small>{row.supplier}{productSubtitle(row) ? ` · ${productSubtitle(row)}` : ''}</small></div><div className="prProductNumbers"><b>{money(row.revenue)}</b><small>{number(row.quantity)} {row.area === 'tools' ? 'stk.' : 'spann'}</small><span className={row.profit < 0 ? 'prNegative' : 'prPositive'}>{money(row.profit)} fortj.</span><strong className={`prTone-${marginTone(row.margin)}`}>{pct(row.margin)}</strong></div></article>)}{!products.length && <div className="prEmpty">Ingen registrerte produkter i valgt periode.</div>}</div>;
}

function ToolsMetrics({ page }: { page: PrintReportPage }) {
  const lowest = [...page.allCategories].filter(group => group.revenue > 0).sort((a, b) => a.margin - b.margin)[0];
  return <ReportPanel title="Nøkkeltall for verktøy" subtitle="Praktiske styringsmål" icon={<Package />} className="prToolsMetrics"><dl><div><dt>Snitt omsetning per enhet</dt><dd>{money(page.totals.quantity ? page.totals.revenue / page.totals.quantity : 0)}</dd></div><div><dt>Snitt fortjeneste per enhet</dt><dd>{money(page.totals.quantity ? page.totals.profit / page.totals.quantity : 0)}</dd></div><div><dt>Største kategori på omsetning</dt><dd>{page.allCategories[0]?.name || 'Ingen salg'}</dd></div><div><dt>Lavest fortjenesteprosent</dt><dd>{lowest?.name || 'Ingen salg'}{lowest && <small>{pct(lowest.margin)}</small>}</dd></div></dl></ReportPanel>;
}

function FocusContent({ page }: { page: PrintReportPage }) {
  const focus = page.focus!;
  const sellingShare = focus.items.length ? focus.selling / focus.items.length * 100 : 0;
  const top = [...focus.items].filter(item => item.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const maximum = Math.max(1, ...top.map(item => item.profit));
  // One physical A4 page is retained even if the configured focus list grows beyond its original 20 items.
  const listed = focus.items.slice(0, 24);
  return <><div className="prFocusVisuals"><ReportPanel title="Topp 5 fokusvarer" subtitle="Rangert etter fortjeneste" icon={<BarChart3 />}><ol className="prFocusBars">{top.map((item, index) => <li key={item.ean}><span>{String(index + 1).padStart(2, '0')}</span><ReportImage key={item.image || item.ean} src={appPath(item.image || `/api/product-image?${new URLSearchParams({ product: item.name, ean: item.ean, itemNo: item.ean, supplier: item.supplier || '', key: item.productKey || `focus|${item.ean}` })}`)} /><div><div><b>{item.name}</b><strong>{money(item.profit)}</strong></div><i><em style={{ width: `${item.profit / maximum * 100}%` }} /></i></div></li>)}</ol>{!top.length && <div className="prEmpty">Ingen fokusvarer med positiv fortjeneste i valget.</div>}</ReportPanel><ReportPanel title="Salg i fokusutvalget" subtitle="Positivt antall solgt netto" icon={<Target />} className="prFocusCoverage"><div className="prDonut"><svg viewBox="0 0 180 180" role="img" aria-label={`${focus.selling} av ${focus.items.length} fokusvarer har positivt nettosalg`}><circle cx="90" cy="90" r="65" fill="none" stroke="#edf1f5" strokeWidth="17" /><circle cx="90" cy="90" r="65" fill="none" stroke="#e9964d" strokeWidth="17" strokeDasharray={`${sellingShare / 100 * 408.4} 408.4`} transform="rotate(-90 90 90)" /></svg><strong>{number(sellingShare)}<small>%</small></strong></div><div className="prFocusLegend"><span>Varer med positivt nettosalg<b>{focus.selling}</b></span><span>Null eller negativt nettosalg<b>{focus.items.length - focus.selling}</b></span></div><p>Salgsdata viser ikke lagerbeholdning.</p></ReportPanel></div><ReportPanel title={focus.items.length > listed.length ? `Topp ${listed.length} fokusvarer etter omsetning` : 'Hele fokusutvalget'} subtitle={`${listed.length} av ${focus.items.length} varer · Alle inngår i nøkkeltallene`} className="prFocusTable"><table><thead><tr><th>Produkt</th><th>EAN</th><th>Antall</th><th>Omsetning</th><th>Fortjeneste</th><th>Fortj. %</th></tr></thead><tbody>{listed.map(item => <tr key={item.ean}><th>{item.name}</th><td>{item.ean}</td><td>{number(item.quantity)}</td><td>{money(item.revenue)}</td><td className={item.profit < 0 ? 'prNegative' : ''}>{money(item.profit)}</td><td>{pct(item.margin)}</td></tr>)}</tbody></table>{!listed.length && <div className="prEmpty">Fokuslisten er tom. Velg fokusvarer i Kontrollpanel.</div>}</ReportPanel></>;
}

export function PrintReportPack({ report, selectedStoreId, storeName, periodLabel, period, focusProducts }: { report: DailyReport; selectedStoreId: string; storeName: string; periodLabel: string; period: Period; focusProducts: FocusProduct[] }) {
  const pages = useMemo(() => buildPrintReport(report, selectedStoreId, focusProducts), [report, selectedStoreId, focusProducts]);
  const national = selectedStoreId === '__all__';
  return <div className="printReportPack paintPrintReport" aria-label="A4-rapport for alle vareområder">{pages.map((page, index) => {
    return <section className={`prPage${page.id === 'focus' ? ' prFocusPage' : ''}`} data-report-area={page.id} key={page.id}>
      <header className="prHeader"><div><span>OBS BYGG / SALGSRAPPORT</span><h1>{page.name}</h1><p>{storeName} <i />{periodLabel}</p></div><img src={appPath('/logos/obsbygg.png')} alt="Obs BYGG" /><b>{String(index + 1).padStart(2, '0')}<small> / {pages.length}</small></b></header>
      <section className="prStats"><ReportStat label="Omsetning" value={money(page.totals.revenue)} note={`${number(page.totals.quantity)} enheter solgt netto`} icon={<BarChart3 />} featured /><ReportStat label="Fortjeneste" value={money(page.totals.profit)} note="Bruttofortjeneste i perioden" icon={<Coins />} /><ReportStat label="Fortjenesteprosent" value={pct(page.totals.margin)} note={page.totals.revenue>0?`${({excellent:'Svært god margin',high:'God margin',medium:'Middels margin',low:'Lav margin',critical:'Svak margin'})[marginTone(page.totals.margin)]} · vektet margin`:'Ingen positiv netto omsetning'} icon={<Percent />} /><ReportStat label={page.id === 'focus' ? 'Varer med positivt salg' : page.id === 'tools' ? 'Solgte enheter' : national ? 'Varehus med salg' : 'Plassering i regionen'} value={page.id === 'focus' ? `${page.focus!.selling} / ${focusProducts.length}` : page.id === 'tools' ? number(page.totals.quantity) : national ? String(page.stores.length) : page.selectedRank ? `#${page.selectedRank} av ${page.stores.length}` : '–'} note={page.id === 'focus' ? 'Av det valgte fokusutvalget' : page.id === 'tools' ? `${money(page.totals.quantity ? page.totals.revenue / page.totals.quantity : 0)} i snitt per enhet` : national ? 'Med salg i valgt område' : 'Rangert på fortjenesteprosent'} icon={page.id === 'focus' ? <Target /> : <Trophy />} /></section>
      {page.id === 'focus' ? <FocusContent page={page} /> : <><div className="prMainGrid"><ReportPanel title={page.id === 'tools' ? 'Omsetning etter underkategori' : 'Leverandørmiks'} subtitle="Andel · omsetning · fortjeneste · fortjeneste %" icon={<BarChart3 />}><GroupRows groups={page.id === 'tools' ? page.categories : page.suppliers} totalRevenue={page.totals.revenue} /></ReportPanel>{page.id === 'tools' ? <ToolsMetrics page={page} /> : <ReportPanel title={page.id === 'total' ? 'Fordeling på vareområde' : 'Største underkategorier'} subtitle="Andel · omsetning · fortjeneste · fortjeneste %" icon={<Layers3 />}><GroupRows groups={page.categories} totalRevenue={page.totals.revenue} />{!page.categories.length && <div className="prEmpty">Ingen registrerte underkategorier i valget.</div>}</ReportPanel>}</div><div className="prBottomGrid"><ReportPanel title="Topp 5 produkter etter omsetning" subtitle="Samlet per produkt og størrelse" icon={<Package />}><ProductList products={page.products} /></ReportPanel><RegionTable page={page} storeName={storeName} national={national} /></div></>}
      <footer className="prFooter"><span>Obs BYGG · Malingstatistikk</span><span>{period} · {storeName}</span><b>{page.name} / {index + 1} av {pages.length}</b></footer>
    </section>;
  })}</div>;
}
