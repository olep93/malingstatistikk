import { PDFDocument, StandardFonts, PrintScaling, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { DailyReport, Period, ProductRow } from './data';
import type { FocusProduct } from './focus-products';
import { buildPrintReport, type PrintReportPage } from './print-report';
import { productSubtitle } from './display-products';
import { marginTone } from './presentation';
import type { SalesGroup } from './sales-visuals';

export type PdfProductImage = Pick<ProductRow, 'product' | 'size' | 'ean' | 'itemNo' | 'productKey' | 'image'> & { supplier: string };
export type PdfImageSource = { id: string; product?: PdfProductImage };
export type PrintPdfInput = {
  report: DailyReport; selectedStoreId: string; storeName: string; periodLabel: string; period: Period; focusProducts: FocusProduct[];
  loadImage?: (source: PdfImageSource) => Promise<Uint8Array | undefined>;
  fonts?: { regular: Uint8Array; bold: Uint8Array };
};

const MM = 72 / 25.4;
const A4 = [210 * MM, 297 * MM] as const;
const C = { navy: '#18334e', text: '#355673', muted: '#7e91a4', border: '#dce5ee', track: '#edf2f6', green: '#287d65', red: '#b25c4d', orange: '#e99a53', gold: '#a48246', white: '#ffffff' };
const color = (hex: string) => { const value = hex.replace('#', ''); return rgb(parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255); };
// Helvetica's WinAnsi character set includes Norwegian letters, but not the mathematical minus sign.
const clean = (value: string) => String(value).normalize('NFC').replace(/[\u2212\u2011]/g, '-').replace(/[\u00a0\u202f]/g, ' ').replace(/[^\u0020-\u007e\u00a0-\u00ff\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u20ac\u2122]/g, ' ');
const money = (n: number) => `${Math.round(n).toLocaleString('nb-NO')} kr`;
const number = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
const pct = (n: number) => `${n.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const tone = (margin: number) => ({ excellent: C.green, high: C.green, medium: C.gold, low: C.red, critical: C.red })[marginTone(margin)];
const marginLabel = (margin: number) => ({ excellent: 'Svært god margin', high: 'God margin', medium: 'Middels margin', low: 'Lav margin', critical: 'Svak margin' })[marginTone(margin)];
const imageId = (row: PdfProductImage) => row.image || [row.productKey, row.ean, row.product, row.supplier, row.size].join('|');
const focusTop = (page: PrintReportPage) => [...(page.focus?.items || [])].filter(item => item.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 5);
const focusImage = (item: ReturnType<typeof focusTop>[number]): PdfProductImage => ({ product: item.name, supplier: item.supplier || '', size: '', ean: item.ean, itemNo: item.ean, productKey: item.productKey, image: item.image });

type TextOptions = { size?: number; minSize?: number; bold?: boolean; color?: string; width?: number; align?: 'left' | 'right' | 'center'; lines?: number };

class Sheet {
  constructor(readonly page: PDFPage, readonly regular: PDFFont, readonly bold: PDFFont, readonly images: Map<string, PDFImage>) {}
  box(x: number, y: number, w: number, h: number, fill = C.white, border = C.border, radius = 2.5) {
    const r = radius;
    this.page.drawSvgPath(`M ${r} 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${h-r} Q ${w} ${h} ${w-r} ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`, { x: x * MM, y: A4[1] - y * MM, scale: MM, color: color(fill), borderColor: color(border), borderWidth: 0.22 });
  }
  line(x1: number, y1: number, x2: number, y2: number, stroke = C.border, thickness = 0.2) {
    this.page.drawLine({ start: { x: x1 * MM, y: A4[1] - y1 * MM }, end: { x: x2 * MM, y: A4[1] - y2 * MM }, thickness: thickness * MM, color: color(stroke) });
  }
  text(value: string, x: number, y: number, options: TextOptions = {}) {
    const font = options.bold ? this.bold : this.regular;
    const valueText = clean(value);
    const max = (options.width ?? 190) * MM;
    const maxLines = options.lines || 1;
    let size = options.size || 7;
    const minSize = options.minSize || size;
    const wrap = (fontSize: number) => {
      const lines: string[] = [];
      let line = '';
      for (const word of valueText.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && font.widthOfTextAtSize(next, fontSize) > max) { lines.push(line); line = word; } else line = next;
      }
      if (line) lines.push(line);
      return lines.length ? lines : [''];
    };
    let lines = wrap(size);
    while ((lines.length > maxLines || lines.some(line => font.widthOfTextAtSize(line, size) > max)) && size > minSize) { size = Math.max(minSize, size - 0.2); lines = wrap(size); }
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += '…'; }
    lines.forEach((line, index) => {
      while (font.widthOfTextAtSize(line, size) > max && line.length > 1) line = line.slice(0, -2) + '…';
      const width = font.widthOfTextAtSize(line, size);
      const left = x * MM + (options.align === 'right' ? max - width : options.align === 'center' ? (max - width) / 2 : 0);
      const top = y * MM + index * size * 1.3;
      if (left < 0 || left + width > A4[0] + 0.1 || top + size > A4[1] - 20) throw new Error('Rapportinnholdet passer ikke på A4-siden.');
      this.page.drawText(line, { x: left, y: A4[1] - top - size, size, font, color: color(options.color || C.text) });
    });
  }
  image(id: string, x: number, y: number, w: number, h: number) {
    const img = this.images.get(id);
    if (!img) { this.box(x + 1, y + 1, w - 2, h - 2, '#f5f8fb', C.border, 1); return; }
    const scale = Math.min(w * MM / img.width, h * MM / img.height);
    const width = img.width * scale, height = img.height * scale;
    this.page.drawImage(img, { x: x * MM + (w * MM - width) / 2, y: A4[1] - (y + h) * MM + (h * MM - height) / 2, width, height });
  }
  panel(x: number, y: number, w: number, h: number, title: string, subtitle: string) {
    this.box(x, y, w, h);
    this.text(title, x + 3.6, y + 3.8, { size: 9, minSize: 7.5, bold: true, width: w - 7.2 });
    this.text(subtitle, x + 3.6, y + 9.2, { size: 5.8, minSize: 5.3, color: C.muted, width: w - 7.2 });
  }
  groups(groups: SalesGroup[], revenue: number, x: number, y: number, w: number, h: number) {
    const rowH = Math.min(13, h / Math.max(1, groups.length));
    const dense = rowH < 10;
    const scale = Math.min(1, rowH / 8.2);
    const barY = (dense ? 3.2 : 3.7) * scale, barH = (dense ? 1.25 : 1.5) * scale, valuesY = (dense ? 5.6 : 6.3) * scale;
    const maximum = Math.max(1, ...groups.map(group => Math.abs(group.revenue)));
    groups.forEach((group, index) => {
      const top = y + index * rowH;
      this.text(group.name, x, top, { size: (dense ? 6.4 : 7) * scale, minSize: 5.3 * scale, bold: true, width: w - 16 });
      this.text(pct(revenue ? group.revenue / revenue * 100 : 0), x + w - 16, top, { size: 6.4 * scale, minSize: 5 * scale, bold: true, width: 16, align: 'right' });
      this.box(x, top + barY, w, barH, C.track, C.track, Math.min(0.7, barH / 2));
      const bar = Math.abs(group.revenue) / maximum * w;
      if (bar > 0.1) this.box(x, top + barY, bar, barH, group.revenue < 0 ? C.red : group.color, group.revenue < 0 ? C.red : group.color, Math.min(0.7, bar / 2, barH / 2));
      this.text(money(group.revenue), x, top + valuesY, { size: 5.9 * scale, minSize: 5 * scale, color: C.muted, width: w * 0.36 });
      this.text(money(group.profit), x + w * 0.36, top + valuesY, { size: 5.9 * scale, minSize: 5 * scale, color: group.profit < 0 ? C.red : C.green, width: w * 0.32, align: 'center' });
      this.text(pct(group.margin), x + w * 0.70, top + valuesY, { size: 6.2 * scale, minSize: 5 * scale, bold: true, color: tone(group.margin), width: w * 0.30, align: 'right' });
    });
  }
}

function drawProducts(sheet: Sheet, page: PrintReportPage, y: number) {
  const x = 10, w = 100, h = 104;
  sheet.panel(x, y, w, h, 'Topp 5 produkter etter omsetning', 'Samlet per produkt og størrelse');
  if (!page.products.length) sheet.text('Ingen registrerte produkter i valgt periode.', x + 4, y + 23, { size: 7, color: C.muted, width: w - 8, lines: 2 });
  page.products.forEach((row, index) => {
    const top = y + 17 + index * 16.1;
    if (index) sheet.line(x + 3.5, top - 0.7, x + w - 3.5, top - 0.7, C.track);
    sheet.text(String(index + 1).padStart(2, '0'), x + 3.5, top + 5, { size: 5.8, color: C.muted, width: 4 });
    sheet.image(imageId(row), x + 8.5, top + 1, 11, 12.5);
    sheet.text(row.product, x + 22, top + 2.7, { size: 7, minSize: 5.8, bold: true, width: 44, lines: 3 });
    sheet.text([row.supplier, productSubtitle(row)].filter(Boolean).join(' · '), x + 22, top + 12.2, { size: 5.6, minSize: 5.1, color: C.muted, width: 44 });
    const right = x + w - 27.5;
    sheet.text(money(row.revenue), right, top + 0.6, { size: 7.3, minSize: 5.6, bold: true, width: 24, align: 'right' });
    sheet.text(`${number(row.quantity)} ${row.area === 'tools' ? 'stk.' : 'spann'}`, right, top + 4.4, { size: 5.8, width: 24, align: 'right', color: C.muted });
    sheet.text(`${money(row.profit)} fortj.`, right, top + 8, { size: 5.7, minSize: 5, width: 24, align: 'right', color: row.profit < 0 ? C.red : C.green });
    sheet.text(pct(row.margin), right, top + 11.4, { size: 6.7, width: 24, align: 'right', bold: true, color: tone(row.margin) });
  });
}

function drawRegion(sheet: Sheet, page: PrintReportPage, y: number, input: PrintPdfInput) {
  const x = 113, w = 87;
  sheet.panel(x, y, w, 104, 'Regionsrangering', 'Topp 5 etter fortjenesteprosent');
  const columns = [{ x: x + 3.5, w: 5, name: '#' }, { x: x + 8.5, w: 20, name: 'Varehus' }, { x: x + 28.5, w: 20, name: 'Omsetning' }, { x: x + 48.5, w: 20, name: 'Fortjeneste' }, { x: x + 68.5, w: 15, name: 'Fortj. %' }];
  columns.forEach((col, i) => sheet.text(col.name, col.x, y + 17, { size: 5.2, width: col.w, color: C.muted, align: i > 1 ? 'right' : 'left' }));
  sheet.line(x + 3.5, y + 22, x + w - 3.5, y + 22);
  page.regionalStores.forEach((store, index) => {
    const top = y + 23 + index * 11.4;
    const isFocus = input.selectedStoreId !== '__all__' && store.rank === page.selectedRank;
    if (isFocus) sheet.box(x + 3.3, top, w - 6.6, 10.8, '#fff4e7', '#fff4e7', 0);
    const values = [String(store.rank), store.store.replace(/^Obs Bygg\s+/i, '').replace(/^X\s+/, ''), money(store.revenue), money(store.profit), pct(store.margin)];
    columns.forEach((col, i) => sheet.text(values[i], col.x, top + 3.5, { size: i === 1 ? 6.2 : 6, minSize: 5, width: col.w, lines: i === 1 ? 2 : 1, align: i > 1 ? 'right' : 'left', bold: i === 1 || i === 4, color: i === 4 ? tone(store.margin) : i === 3 ? (store.profit < 0 ? C.red : C.green) : isFocus && i === 1 ? '#966934' : C.text }));
    sheet.line(x + 3.5, top + 11.2, x + w - 3.5, top + 11.2, C.track);
  });
  if (!page.regionalStores.length) sheet.text('Ingen registrerte salg i dette vareområdet.', x + 4, y + 28, { size: 7, color: C.muted, width: w - 8, lines: 2 });
  sheet.line(x + 3.5, y + 94, x + w - 3.5, y + 94);
  const note = input.selectedStoreId === '__all__' ? 'Varehusene rangeres på vektet fortjenesteprosent.' : page.selectedRank ? `${input.storeName} er markert på sin faktiske plass ${page.selectedRank}.` : `${input.storeName} har ingen registrerte salg i området.`;
  sheet.text(note, x + 3.5, y + 97, { size: 5.7, minSize: 5, width: w - 7, color: C.muted, lines: 2 });
}

function drawOrdinary(sheet: Sheet, page: PrintReportPage, input: PrintPdfInput) {
  const y = 62, h = 92;
  const tools = page.id === 'tools';
  sheet.panel(10, y, 97, h, tools ? 'Omsetning etter underkategori' : 'Leverandørmiks', 'Andel · omsetning · fortjeneste · fortjeneste %');
  sheet.groups(tools ? page.categories : page.suppliers, page.totals.revenue, 13.5, y + 18, 90, h - 23);
  if (tools) {
    sheet.panel(110, y, 90, h, 'Nøkkeltall for verktøy', 'Praktiske styringsmål');
    const lowest = [...page.allCategories].filter(group => group.revenue > 0).sort((a, b) => a.margin - b.margin)[0];
    const metrics = [
      ['Snitt omsetning per enhet', money(page.totals.quantity ? page.totals.revenue / page.totals.quantity : 0)],
      ['Snitt fortjeneste per enhet', money(page.totals.quantity ? page.totals.profit / page.totals.quantity : 0)],
      ['Største kategori på omsetning', page.allCategories[0]?.name || 'Ingen salg'],
      ['Lavest fortjenesteprosent', lowest?.name || 'Ingen salg'],
    ];
    metrics.forEach(([label, value], index) => {
      const top = y + 18 + index * 16.8;
      sheet.text(label, 114, top, { size: 6.4, color: C.muted, width: 82 });
      sheet.text(value, 114, top + 5.2, { size: 11, minSize: 8, bold: true, width: 82 });
      if (index < 3) sheet.line(114, top + 14, 196, top + 14, C.track);
      if (index === 3 && lowest) sheet.text(pct(lowest.margin), 114, top + 11.5, { size: 7, color: tone(lowest.margin), width: 82 });
    });
  } else {
    sheet.panel(110, y, 90, h, page.id === 'total' ? 'Fordeling på vareområde' : 'Største underkategorier', 'Andel · omsetning · fortjeneste · fortjeneste %');
    sheet.groups(page.categories, page.totals.revenue, 113.5, y + 18, 83, h - 23);
    if (!page.categories.length) sheet.text('Ingen registrerte underkategorier i valget.', 114, y + 28, { size: 7, color: C.muted, width: 82, lines: 2 });
  }
  drawProducts(sheet, page, 157);
  drawRegion(sheet, page, 157, input);
}

function drawFocus(sheet: Sheet, page: PrintReportPage) {
  const focus = page.focus!;
  const y = 62;
  sheet.panel(10, y, 113, 68, 'Topp 5 fokusvarer', 'Rangert etter fortjeneste');
  sheet.panel(126, y, 74, 68, 'Salg i fokusutvalget', 'Positivt antall solgt netto');
  const top = focusTop(page), maximum = Math.max(1, ...top.map(item => item.profit));
  top.forEach((item, index) => {
    const rowY = y + 18 + index * 9.1;
    sheet.text(String(index + 1).padStart(2, '0'), 14, rowY + 1, { size: 5.7, color: C.muted, width: 4 });
    sheet.image(imageId(focusImage(item)), 19, rowY, 6, 6);
    sheet.text(item.name, 27, rowY, { size: 6.7, minSize: 5.2, bold: true, width: 69 });
    sheet.text(money(item.profit), 98, rowY, { size: 6.8, minSize: 5.3, bold: true, width: 21, align: 'right' });
    sheet.box(27, rowY + 4.7, 92, 1.5, C.track, C.track, 0.7);
    const width = item.profit / maximum * 92;
    if (width > 0.1) sheet.box(27, rowY + 4.7, width, 1.5, C.orange, C.orange, Math.min(0.7, width / 2));
  });
  if (!top.length) sheet.text('Ingen fokusvarer med positiv fortjeneste.', 14, y + 24, { size: 7, width: 104, color: C.muted, lines: 2 });
  const share = focus.items.length ? focus.selling / focus.items.length : 0;
  const cx = 163, cy = y + 33, radius = 12;
  sheet.page.drawCircle({ x: cx * MM, y: A4[1] - cy * MM, size: radius * MM, borderWidth: 3 * MM, borderColor: color(C.track) });
  if (share > 0) {
    const steps = Math.max(2, Math.ceil(share * 160));
    const points: string[] = [];
    for (let i = 0; i <= steps; i++) { const angle = -Math.PI / 2 + i / steps * share * Math.PI * 2; points.push(`${13.5 + Math.cos(angle) * 13.5} ${13.5 + Math.sin(angle) * 13.5}`); }
    for (let i = steps; i >= 0; i--) { const angle = -Math.PI / 2 + i / steps * share * Math.PI * 2; points.push(`${13.5 + Math.cos(angle) * 10.5} ${13.5 + Math.sin(angle) * 10.5}`); }
    sheet.page.drawSvgPath(`M ${points.join(' L ')} Z`, { x: (cx - 13.5) * MM, y: A4[1] - (cy - 13.5) * MM, scale: MM, color: color(C.orange) });
  }
  sheet.text(`${number(share * 100)} %`, cx - 16, cy - 4, { size: 19, minSize: 14, bold: true, width: 32, align: 'center' });
  sheet.text('Varer med positivt nettosalg', 130, y + 49, { size: 5.9, width: 60, color: C.muted });
  sheet.text(String(focus.selling), 190, y + 49, { size: 6.2, bold: true, width: 6, align: 'right' });
  sheet.text('Null eller negativt nettosalg', 130, y + 54, { size: 5.9, width: 60, color: C.muted });
  sheet.text(String(focus.items.length - focus.selling), 190, y + 54, { size: 6.2, bold: true, width: 6, align: 'right' });
  sheet.line(130, y + 59, 196, y + 59, C.track);
  sheet.text('Salgsdata viser ikke lagerbeholdning.', 130, y + 61, { size: 5.4, width: 66, color: C.muted });
  const listed = focus.items.slice(0, 24);
  sheet.panel(10, 133, 190, 128, listed.length < focus.items.length ? `Topp ${listed.length} fokusvarer etter omsetning` : 'Hele fokusutvalget', `${listed.length} av ${focus.items.length} varer · Alle inngår i nøkkeltallene`);
  const columns = [{ x: 14, w: 63, name: 'Produkt' }, { x: 77, w: 37, name: 'EAN' }, { x: 114, w: 13, name: 'Antall' }, { x: 127, w: 25, name: 'Omsetning' }, { x: 152, w: 25, name: 'Fortjeneste' }, { x: 177, w: 19, name: 'Fortj. %' }];
  sheet.box(13.5, 150, 183, 6.5, '#eff4f8', '#eff4f8', 0);
  columns.forEach((col, index) => sheet.text(col.name, col.x, 152, { size: 5.9, width: col.w - (index > 1 ? 1.5 : 0), align: index > 1 ? 'right' : 'left', color: C.muted }));
  const rowH = Math.min(4.8, 99 / Math.max(1, listed.length));
  listed.forEach((item, index) => {
    const top = 158 + index * rowH;
    const values = [item.name, item.ean, number(item.quantity), money(item.revenue), money(item.profit), pct(item.margin)];
    columns.forEach((col, i) => sheet.text(values[i], col.x, top, { size: i === 1 ? 6 : 6.5, minSize: 5.2, width: col.w - (i > 1 ? 1.5 : 0), align: i > 1 ? 'right' : 'left', color: item.profit < 0 && i === 4 ? C.red : i === 1 ? C.muted : C.text }));
    sheet.line(13.5, top + rowH - 0.7, 196.5, top + rowH - 0.7, C.track, 0.15);
  });
  if (!listed.length) sheet.text('Fokuslisten er tom. Velg fokusvarer i Kontrollpanel.', 14, 164, { size: 7, color: C.muted, width: 182 });
}

/** A real six-page PDF: browsers and printer margins cannot reflow or add report pages. */
export async function createPrintReportPdf(input: PrintPdfInput): Promise<Uint8Array> {
  const pages = buildPrintReport(input.report, input.selectedStoreId, input.focusProducts);
  const doc = await PDFDocument.create();
  doc.setTitle(`Malingsrapport - ${input.storeName} - ${input.periodLabel}`);
  doc.setAuthor('Obs BYGG'); doc.setCreator('Malingstatistikk'); doc.setLanguage('nb-NO');
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  if (input.fonts) doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(input.fonts?.regular || StandardFonts.Helvetica, { subset: true });
  const bold = await doc.embedFont(input.fonts?.bold || StandardFonts.HelveticaBold, { subset: true });
  const images = new Map<string, PDFImage>();
  if (input.loadImage) {
    const sources = new Map<string, PdfImageSource>([['logo', { id: 'logo' }]]);
    pages.forEach(page => {
      page.products.forEach(row => sources.set(imageId(row), { id: imageId(row), product: row }));
      focusTop(page).forEach(item => { const row = focusImage(item); sources.set(imageId(row), { id: imageId(row), product: row }); });
    });
    const queue = [...sources.values()]; let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (cursor < queue.length) {
        const source = queue[cursor++];
        try {
          const data = await input.loadImage!(source);
          if (!data?.length) continue;
          images.set(source.id, data[0] === 0x89 && data[1] === 0x50 ? await doc.embedPng(data) : await doc.embedJpg(data));
        } catch { /* A missing image must not remove a product or prevent a report. */ }
      }
    }));
  }
  pages.forEach((page, index) => {
    const sheet = new Sheet(doc.addPage([...A4]), regular, bold, images);
    sheet.text('OBS BYGG / SALGSRAPPORT', 10, 12, { size: 6.5, bold: true, color: C.muted, width: 140 });
    sheet.text(page.name, 10, 18, { size: 22, minSize: 18, bold: true, color: C.navy, width: 146 });
    sheet.text(`${input.storeName} · ${input.periodLabel}`, 10, 28.2, { size: 6.9, minSize: 6, color: C.muted, width: 146 });
    if (images.has('logo')) sheet.image('logo', 165, 11, 19, 18);
    else { sheet.box(165, 11, 19, 18, '#003c79', '#003c79', 0); sheet.text('Obs', 166, 12.5, { size: 19, bold: true, color: C.white, width: 17, align: 'center' }); sheet.text('BYGG', 166, 20, { size: 12, bold: true, color: C.white, width: 17, align: 'center' }); }
    sheet.text(String(index + 1).padStart(2, '0'), 189, 16, { size: 16, width: 11, align: 'right' });
    sheet.text(`/ ${pages.length}`, 189, 24, { size: 6, color: C.muted, width: 11, align: 'right' });
    sheet.line(10, 33, 200, 33);
    const national = input.selectedStoreId === '__all__';
    const stat4 = page.id === 'focus' ? ['Varer med positivt salg', `${page.focus!.selling} / ${input.focusProducts.length}`, 'Av det valgte fokusutvalget'] : page.id === 'tools' ? ['Solgte enheter', number(page.totals.quantity), `${money(page.totals.quantity ? page.totals.revenue / page.totals.quantity : 0)} i snitt per enhet`] : national ? ['Varehus med salg', String(page.stores.length), 'Med salg i valgt område'] : ['Plassering i regionen', page.selectedRank ? `#${page.selectedRank} av ${page.stores.length}` : '–', 'Rangert på fortjenesteprosent'];
    const stats = [['Omsetning', money(page.totals.revenue), `${number(page.totals.quantity)} enheter solgt netto`], ['Fortjeneste', money(page.totals.profit), 'Bruttofortjeneste i perioden'], ['Fortjenesteprosent', pct(page.totals.margin), page.totals.revenue > 0 ? `${marginLabel(page.totals.margin)} · vektet margin` : 'Ingen positiv netto omsetning'], stat4];
    stats.forEach(([label, value, note], i) => {
      const x = 10 + i * 48.25;
      sheet.box(x, 36, 45.25, 23, i === 0 ? C.navy : C.white, i === 0 ? C.navy : C.border);
      sheet.text(label, x + 3.2, 39.5, { size: 6.4, minSize: 5.4, bold: true, color: i === 0 ? '#c9d8e7' : C.muted, width: 38.85 });
      sheet.text(value, x + 3.2, 45, { size: 15, minSize: 9, bold: true, color: i === 0 ? C.white : C.navy, width: 38.85 });
      sheet.text(note, x + 3.2, 53.5, { size: 5.8, minSize: 5, color: i === 0 ? '#c1d2e2' : C.muted, width: 38.85 });
    });
    if (page.id === 'focus') drawFocus(sheet, page); else drawOrdinary(sheet, page, input);
    sheet.line(10, 265, 200, 265);
    sheet.text('Obs BYGG · Malingstatistikk', 10, 268, { size: 5.7, color: C.muted, width: 62 });
    sheet.text(`${input.period} · ${input.storeName}`, 73, 268, { size: 5.7, minSize: 5, color: C.muted, width: 64, align: 'center' });
    sheet.text(`${page.name} / ${index + 1} av ${pages.length}`, 139, 268, { size: 5.7, minSize: 5, bold: true, color: C.muted, width: 61, align: 'right' });
  });
  return doc.save();
}
