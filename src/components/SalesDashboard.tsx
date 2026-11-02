'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Check, ChevronDown, Coins, Layers3, MapPin, Package, Percent, Trophy } from 'lucide-react';
import type { ProductRow } from '@/lib/data';
import { buildSalesGroups, salesCategoryLeaders, weightedSalesMargin } from '@/lib/sales-visuals';
import { marginTone } from '@/lib/presentation';
import { productSubtitle } from '@/lib/display-products';

type StoreValue = { storeId: string; store: string; revenue: number; profit: number; quantity: number; margin: number };
type Metric = 'revenue' | 'profit' | 'margin';
const amount = (n: number) => Math.round(n).toLocaleString('nb-NO');
const money = (n: number) => `${amount(n)} kr`;
const percent = (n: number) => `${n.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const cleanName = (name: string) => name.replace(/^Obs Bygg\s+/i, '').replace(/^X\s+/, '');

function Change({ value, suffix = '%', label }: { value?: number; suffix?: string; label: string }) {
  if (value === undefined || !Number.isFinite(value)) return null;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : ArrowRight;
  return <span className={`sdChange ${value > 0 ? 'sdUp' : value < 0 ? 'sdDown' : 'sdFlat'}`}><Icon size={13} />{value > 0 ? '+' : ''}{value.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} {suffix}<small>{label}</small></span>;
}

function Stat({ label, value, suffix, note, icon, featured, children }: { label: string; value: string; suffix?: string; note: string; icon: ReactNode; featured?: boolean; children?: ReactNode }) {
  return <article className={`sdStat${value.replace(/\D/g, '').length >= 9 ? ' sdHugeValue' : value.replace(/\D/g, '').length >= 7 ? ' sdLongValue' : ''}${featured ? ' sdFeatured' : ''}`}><div className="sdStatTop"><span>{label}</span><i>{icon}</i></div><strong aria-label={`${value}${suffix ? ` ${suffix}` : ''}`}><span>{value}</span>{suffix && <small>{suffix}</small>}</strong><p>{note}</p>{children}</article>;
}

export function SalesDashboard({ area, areaLabel, periodLabel, selected, previous, previousRank, stores, products, metric, setMetric, onProducts, onSelectStore, focusStoreId, allRows }: {
  area: string; areaLabel: string; periodLabel: string; selected: StoreValue; previous?: StoreValue; previousRank?: number;
  stores: StoreValue[]; products: ProductRow[]; metric: Metric; setMetric: (metric: Metric) => void; onProducts?: () => void; onSelectStore?: (id: string) => void; focusStoreId?: string; allRows?: ProductRow[];
}) {
  const [chartMetric, setChartMetric] = useState<'revenue' | 'profit'>('revenue');
  const [showAll, setShowAll] = useState(false);
  const national = selected.storeId === '__all__';
  const rankFocus = national ? focusStoreId : selected.storeId;
  const categoryLeaders = national ? salesCategoryLeaders(allRows || []) : [];
  const groups = buildSalesGroups(products, area);
  const supplierMode = area !== 'tools' && area !== 'total';
  const chartGroups = groups.slice(0, area === 'tools' ? 6 : groups.length);
  const chartMax = Math.max(1, ...chartGroups.map(group => Math.abs(group[chartMetric])));
  const positiveRevenue = groups.reduce((sum, group) => sum + Math.max(0, group.revenue), 0);
  const hasNegativeGroup = groups.some(group => group.revenue < 0);
  const largest = groups[0];
  const profitLeader = [...groups].filter(group => group.profit > 0).sort((a, b) => b.profit - a.profit)[0];
  const regionalMargin = weightedSalesMargin(stores);
  const marginRank = [...stores].sort((a, b) => b.margin - a.margin || a.store.localeCompare(b.store, 'nb')).findIndex(store => store.storeId === selected.storeId) + 1;
  const ranking = [...stores].sort((a, b) => b[metric] - a[metric] || a.store.localeCompare(b.store, 'nb'));
  const focusIndex = ranking.findIndex(store => store.storeId === rankFocus);
  const visibleRanking = showAll ? ranking : ranking.filter((_, index) => index < 5 || index === focusIndex);
  const rankingMax = Math.max(1, ...ranking.map(store => Math.abs(store[metric])));
  const topProducts = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const change = (key: 'revenue' | 'profit') => previous && previous[key] > 0 ? (selected[key] - previous[key]) / previous[key] * 100 : undefined;
  const positiveGroups = groups.filter(group => group.revenue > 0);

  return <div className="salesDashboard">
    <header className="sdHeading"><div><span className="sdEyebrow"><span />SALGSOVERSIKT / {areaLabel}</span><h1>{national ? 'Hele Norge' : cleanName(selected.store)}<span> / salgsoversikt</span></h1><p>{periodLabel}</p></div><div className="sdHeadingRight"><span className="sdDataStatus"><Check size={13} />Importerte salgsdata</span>{onProducts && <button className="sdButton" onClick={onProducts}>Utforsk produktene<ArrowRight size={16} /></button>}</div></header>

    <section className="sdStats" aria-label="Nøkkeltall for valgt periode">
      <Stat label="Omsetning" value={amount(selected.revenue)} suffix="kr" note={`${amount(selected.quantity)} enheter solgt netto`} icon={<BarChart3 size={19} />} featured><Change value={change('revenue')} label="mot forrige dag" /></Stat>
      <Stat label="Fortjeneste" value={amount(selected.profit)} suffix="kr" note="Etter varekostnad" icon={<Coins size={19} />}><Change value={change('profit')} label="mot forrige dag" /></Stat>
      <Stat label="Fortjenesteprosent" value={selected.margin.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} suffix="%" note="Vektet etter omsetning" icon={<Percent size={19} />}><span className={`sdTone sdTone-${marginTone(selected.margin)}`}>{selected.margin >= 30 ? 'Svært god margin' : selected.margin >= 25 ? 'God margin' : selected.margin >= 15 ? 'Middels margin' : selected.margin >= 10 ? 'Lav margin' : 'Svak margin'}</span></Stat>
      <Stat label={national ? 'Varehus med salg' : 'Plassering i regionen'} value={national ? amount(stores.length) : marginRank ? `#${marginRank}` : '–'} note={national ? 'I valgt område og periode' : marginRank ? `av ${stores.length} varehus · fortjeneste %` : 'Ingen salg i valgt område'} icon={national ? <MapPin size={19} /> : <Trophy size={19} />}>
        {!national && previousRank !== undefined && marginRank > 0 && <Change value={previousRank - marginRank} suffix="plasser" label="mot forrige dag" />}
      </Stat>
    </section>

    <section className="sdMainGrid">
      <article className="sdPanel sdPerformance"><header className="sdPanelHeading"><div><span className="sdEyebrow">{supplierMode ? 'LEVERANDØRBILDET' : 'SALGSMIKSEN'}</span><h2>{supplierMode ? 'Hvem driver salget?' : 'Hva driver salget?'}</h2><p>{supplierMode ? 'Alle leverandører i valgt område.' : area === 'total' ? 'Fordelt på de fire vareområdene.' : 'De seks største verktøykategoriene.'}</p></div><div className="sdToggle" aria-label="Velg måltall for salgsdiagram">{(['revenue', 'profit'] as const).map(key => <button key={key} aria-pressed={chartMetric === key} onClick={() => setChartMetric(key)}>{key === 'revenue' ? 'Omsetning' : 'Fortjeneste'}</button>)}</div></header>
        <div className="sdBars" role="list" aria-label={`${chartMetric === 'revenue' ? 'Omsetning' : 'Fortjeneste'} per ${supplierMode ? 'leverandør' : 'kategori'}`}>
          {chartGroups.map(group => <div className="sdBarRow" key={group.name} role="listitem" style={{ '--chart-color': group.color } as CSSProperties}><div className="sdBarIdentity"><i /><b>{group.name}</b><strong className={group[chartMetric] < 0 ? 'sdNegative' : ''}>{money(group[chartMetric])}</strong></div><div className="sdBarTrack"><span style={{ width: `${Math.abs(group[chartMetric]) / chartMax * 100}%`, background: group[chartMetric] < 0 ? '#c3554e' : undefined }} /></div><div className="sdBarMeta"><span>{amount(group.quantity)} enheter</span><span>Fortjeneste <b className={`sdText-${marginTone(group.margin)}`}>{percent(group.margin)}</b></span></div></div>)}
          {!groups.length && <p className="sdEmpty">Ingen salgslinjer i dette valget.</p>}
        </div>
        {profitLeader && <div className="sdInsight"><span><Coins size={17} /></span><p><b>{profitLeader.name}</b> bidrar med mest fortjeneste.<strong>{money(profitLeader.profit)}</strong></p><ArrowUpRight size={20} /></div>}
      </article>

      <article className="sdPanel sdMix"><header className="sdPanelHeading"><div><span className="sdEyebrow">FORDELING</span><h2>Andel av omsetningen</h2></div><Layers3 size={20} /></header><div className="sdDonut"><svg viewBox="0 0 220 220" role="img" aria-label={`Omsetningsfordeling. ${largest?.name || 'Ingen grupper'} har størst omsetning.`}><circle cx="110" cy="110" r="86" fill="none" stroke="#edf1f5" strokeWidth="24" />{positiveGroups.map((group, index) => {
          const share = group.revenue / (positiveRevenue || 1); const length = share * 540.35; const offset = positiveGroups.slice(0, index).reduce((sum, item) => sum + item.revenue, 0) / (positiveRevenue || 1) * 540.35;
          return <circle key={group.name} cx="110" cy="110" r="86" fill="none" stroke={group.color} strokeWidth="24" strokeDasharray={`${Math.max(0, length - (groups.length > 1 ? 3 : 0))} 540.35`} strokeDashoffset={-offset} transform="rotate(-90 110 110)" />;
        })}</svg><div><small>{largest && positiveRevenue ? largest.name : 'Ingen salg'}</small><strong>{positiveRevenue && largest ? Math.max(0, largest.revenue) / positiveRevenue * 100 < 1 ? '<1' : amount(Math.max(0, largest.revenue) / positiveRevenue * 100) : '0'}<em>%</em></strong><span>størst omsetningsandel</span></div></div>
        <ul className="sdLegend">{groups.map(group => <li key={group.name}><i style={{ background: group.color }} /><span>{group.name}</span><b>{positiveRevenue ? percent(Math.max(0, group.revenue) / positiveRevenue * 100) : '0,0 %'}</b></li>)}</ul>
        <p className="sdFinePrint">{hasNegativeGroup ? 'Diagrammet fordeler positiv omsetning. Negative grupper inngår i nøkkeltallene.' : 'Netto omsetning, inkludert returer.'}</p>
      </article>
    </section>

    <section className="sdLowerGrid">
      <article className="sdPanel sdRegion"><header className="sdPanelHeading"><div><span className="sdEyebrow">{national ? 'VAREHUSENE I NORGE' : 'DITT VAREHUS I REGIONEN'}</span><h2>{national ? 'Hvem ligger foran?' : 'Sammenlign resultatene'}</h2><p>{stores.length} varehus med salg i valgt periode.</p></div><label className="sdMetricSelect"><span>Ranger etter</span><select aria-label="Ranger varehus etter" value={metric} onChange={event => setMetric(event.target.value as Metric)}><option value="margin">Fortjeneste %</option><option value="profit">Fortjeneste kr</option><option value="revenue">Omsetning</option></select><ChevronDown size={14} /></label></header>
        <ol className="sdRanking">{visibleRanking.map(store => <li className={store.storeId === rankFocus ? 'sdIsFocus' : ''} key={store.storeId}><span className="sdPosition">{ranking.indexOf(store) + 1}</span><div className="sdRankContent"><div>{onSelectStore ? <button onClick={() => onSelectStore(store.storeId)}>{cleanName(store.store)}{store.storeId === rankFocus && <small>{national ? 'Ditt fokus' : 'Ditt varehus'}</small>}</button> : <b>{cleanName(store.store)}</b>}<strong className={store[metric] < 0 ? 'sdNegative' : ''}>{metric === 'margin' ? percent(store.margin) : money(store[metric])}</strong></div><div className="sdRankTrack"><span style={{ width: `${Math.abs(store[metric]) / rankingMax * 100}%`, background: store[metric] < 0 ? '#c3554e' : undefined }} /></div></div></li>)}</ol>
        {ranking.length > 5 && <button className="sdTextButton" onClick={() => setShowAll(!showAll)}>{showAll ? 'Vis færre varehus' : `Vis alle ${ranking.length} varehus`}<ChevronDown size={14} /></button>}
        <footer className="sdRegionFoot"><span>Vektet fortjeneste i {national ? 'Norge' : 'regionen'}</span><strong>{percent(regionalMargin)}</strong></footer>
      </article>

      <article className="sdPanel sdTopProducts"><header className="sdPanelHeading"><div><span className="sdEyebrow">VARER SOM SELGER</span><h2>Topp 5 på omsetning</h2><p>{national ? 'Samlet for hele Norge.' : `I ${cleanName(selected.store)} denne perioden.`}</p></div><Package size={20} /></header><ol className="sdTopList">{topProducts.map((product, index) => <li key={product.productKey || `${product.product}-${product.size}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{product.product}</b><small>{product.supplier}{productSubtitle(product) ? ` · ${productSubtitle(product)}` : ''} · {amount(product.quantity)} {product.area === 'tools' ? 'stk.' : 'spann'}</small></div><strong>{money(product.revenue)}</strong></li>)}</ol>{onProducts && <button className="sdProductLink" onClick={onProducts}>Se hele produktutvalget<ArrowRight size={16} /></button>}</article>
    </section>
    {categoryLeaders.length > 0 && <section className="sdNationalLeaders"><header><span className="sdEyebrow">KATEGORILEDERNE I NORGE</span><h2>Høyest fortjenesteprosent per vareområde</h2><p>Varehus med positiv netto omsetning i valgt periode.</p></header><div>{categoryLeaders.map(leader => <article key={leader.area} style={{ '--chart-color': leader.color } as CSSProperties}><span>{leader.name}</span><b>{cleanName(leader.store)}</b><strong>{percent(leader.margin)}</strong></article>)}</div></section>}
    <footer className="sdReportFoot"><span><Check size={14} />Basert på valgt import, varehus og periode</span><span>Fortjenesteprosent = fortjeneste / omsetning</span></footer>
  </div>;
}
