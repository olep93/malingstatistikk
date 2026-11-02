import type {ProductRow} from './data';
export type FocusProduct={ean:string;name:string};
export const DEFAULT_FOCUS_PRODUCTS:FocusProduct[]=[
['7071923766505','Perfect startpakke'],['7311490032413','Perfect 3pk'],['7311490032406','Perfect rull 18 cm'],['7311490050608','Ultimate rullesett 18 cm'],['7311490032147','Ultimate rull 18 cm'],['7311490032543','Jordan Perfect møbel og dør'],['7311490031225','Møbel og dør rull'],['7311490032550','Jordan Midi'],['7311490032390','Midi rull'],['7311490046267','Skrå pensel 35 mm'],['7311490046250','Skrå pensel 25 mm'],['7311490026030','Jordan Perfect pensel 50 mm'],['4042448150059','Maskeringsteip 25x25 mm'],['4042448150097','Maskeringsteip 25x38 mm'],['4042448816139','Maskeringsteip 50x50 mm'],['4042448479372','Easy cover 17x260 cm'],['7311490038538','Jordan wipes'],['7311490041590','Malingsklar'],['7311490031485','Slipebrett med borrelås'],['7311490028133','Jordan Perfect ergo forlengerskaft']
].map(([ean,name])=>({ean,name}));
export function focusEan(row:ProductRow){return String(row.ean||(/^\d{13}$/.test(row.itemNo)?row.itemNo:'')).trim()}
export function validateFocusProducts(value:unknown):value is FocusProduct[]{return Array.isArray(value)&&value.length<=200&&value.every(p=>p&&typeof p.ean==='string'&&/^\d{13}$/.test(p.ean)&&typeof p.name==='string'&&p.name.length<=160)&&new Set(value.map(p=>p.ean)).size===value.length}
