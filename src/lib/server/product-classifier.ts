export type Classification={area?:string;subgroup?:string;confidence:'high'|'medium'|'low';reason:string};

const norm=(value:unknown)=>String(value||'').toLocaleUpperCase('nb-NO').replace(/[^A-ZÆØÅ0-9]+/g,' ').replace(/\s+/g,' ').trim();
const has=(text:string,rx:RegExp)=>rx.test(text);

export function classifyProduct(input:{area?:string;subgroup?:string;category?:string;sourceName?:string;websiteName?:string;displayName?:string;supplier?:string}):Classification{
  const currentArea=String(input.area||'').trim();
  const currentTag=String(input.subgroup||'').trim();
  if(currentArea&&currentTag)return{area:currentArea,subgroup:currentTag,confidence:'high',reason:'Kategori fulgte rapportdata'};
  const text=norm([input.websiteName,input.displayName,input.sourceName,input.category,input.supplier].filter(Boolean).join(' '));
  if(!text)return{area:currentArea||undefined,subgroup:currentTag||undefined,confidence:'low',reason:'Ingen tekstgrunnlag'};

  if(has(text,/TERRASSEMALING|DEKKENDE TERRASSE/))return{area:'terrace',subgroup:'Terrassemaling',confidence:'high',reason:'Produktnavnet angir terrassemaling'};
  if(has(text,/TERRASSEBEIS|TREOLJE|TERRASSE OLJE|TYRILIN TERRASSE/)){
    const oil=has(text,/OLJEBASERT|ALKYD|TYRILIN|TREOLJE(?!.*VANNTYNNET)/);
    return{area:'terrace',subgroup:oil?'Oljebasert':'Vanntynnet',confidence:oil?'medium':'high',reason:'Produktnavnet angir terrasseprodukt'};
  }

  if(has(text,/MURMALING|GRUNNMUR|DRYTECH|MUR ORIGINAL|PREMIUM MUR|MUR AKRYL/))return{area:'exterior',subgroup:'Murmaling',confidence:'high',reason:'Produktnavnet angir murmaling'};
  if(has(text,/VINDU|DØR|DOR|D&V|D V/) && has(text,/MALING|DRYGOLIN|FUTURA|SUPERIOR|OLJE/))return{area:'exterior',subgroup:'Vindu / Dør',confidence:'high',reason:'Produktnavnet angir vindu- eller dørmaling'};
  if(has(text,/DRYGOLIN|TREBITT|FUTURA|NORDLYS|SUPERIOR|OLJEDEKKBEIS|OLJEMALING|OLJEBEIS|UTEMALING|FASADE|EKSTERIØR|EKSTERIOR/))return{area:'exterior',subgroup:'Maling / Dekkbeis / Beis',confidence:'high',reason:'Produktnavnet angir eksteriørmaling eller beis'};

  if(has(text,/SPARKEL/))return{area:'interior',subgroup:'Sparkel',confidence:'high',reason:'Produktnavnet angir sparkel'};
  if(has(text,/GRUNNING|HEFTGRUNN|KVIST.*SPERR|SPERR.*GRUNN/))return{area:'interior',subgroup:'Grunning',confidence:'medium',reason:'Produktnavnet angir grunning'};
  if(has(text,/TAKMALING|TAK MALING|TAK$/))return{area:'interior',subgroup:'Tak',confidence:'high',reason:'Produktnavnet angir takmaling'};
  if(has(text,/TRE.*PANEL|PANEL.*TRE|LIST.*DØR|GULVMALING|GULV MALING/))return{area:'interior',subgroup:'Tre & Panel',confidence:'medium',reason:'Produktnavnet angir tre, panel eller gulv'};
  if(has(text,/LAKK|OLJE TIL GULV|GULVLAKK/))return{area:'interior',subgroup:'Lakk',confidence:'high',reason:'Produktnavnet angir lakk'};
  if(has(text,/SUPER.?MATT|PURE COLOR|LADY MINERALS/))return{area:'interior',subgroup:'Supermatt',confidence:'medium',reason:'Produktnavnet angir supermatt overflate'};
  if(has(text,/SILKEMATT|SILKE MATT|GLANS 10|GLANS 15/))return{area:'interior',subgroup:'Silkematt',confidence:'medium',reason:'Produktnavnet angir silkematt overflate'};
  if(has(text,/MATT|VEGGMALING|VEGG MALING/))return{area:'interior',subgroup:'Matt',confidence:'medium',reason:'Produktnavnet angir matt veggmaling'};

  if(has(text,/PENSEL|PENSELSETT|FLATPENSEL|RINGPENSEL/))return{area:'tools',subgroup:'Pensler',confidence:'high',reason:'Produktnavnet angir pensel'};
  if(has(text,/RULL|RULLESETT|MALERULL/))return{area:'tools',subgroup:'Ruller',confidence:'high',reason:'Produktnavnet angir rull'};
  if(has(text,/MASKERINGSTAPE|BYGNINGSTAPE|MALERTAPE|TAPE/))return{area:'tools',subgroup:'Tape',confidence:'high',reason:'Produktnavnet angir tape'};
  if(has(text,/DEKKEPAPP|DEKKEFILT|MASKERINGSFOLIE|PLASTFOLIE|TILDEKNING/))return{area:'tools',subgroup:'Tildekning',confidence:'high',reason:'Produktnavnet angir tildekning'};
  if(has(text,/HUSVASK|KRAFTVASK|SOPP.*ALGE|RENS|VASK/))return{area:'tools',subgroup:'Rensemidler',confidence:'medium',reason:'Produktnavnet angir vask eller rensemiddel'};
  if(currentArea)return{area:currentArea,subgroup:currentTag||undefined,confidence:'low',reason:'Vareområde finnes, men tag kunne ikke bestemmes sikkert'};
  return{confidence:'low',reason:'Kunne ikke klassifiseres sikkert'};
}
