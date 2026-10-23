/**
 * Underkategori ut fra produktnavnet for områdene der varegruppen ikke avgjør den. Brukes både av
 * importen (parser.ts) og av den automatiske rettingen (product-classifier.ts), så de er enige.
 * BI-navnene er forkortet ("BX TERR.BEIS", "INFRA TERR.B 3ÅR"), så mønstrene dekker begge former.
 * Gir undefined når navnet ikke sier noe; da gjelder DEFAULT_SUBGROUP.
 */
export function subgroupFromName(area:string,text:string):string|undefined{
  const n=text.toUpperCase();
  if(area==="terrace"){
    if(/TERRASSEMALING|MALING TERRASSE|DEKKENDE TERRASSE/.test(n))return "Terrassemaling";
    if(/(BUTINOX|\bBX\b).*TERR(?:ASSE)?\.?\s*BEIS|INFRA.*TERR(?:ASSE)?\.?\s*(?:BEIS|B\b).*3\s*ÅR|JOTUN.*TRANSPARENT.*TERR|TREBITT.*TERR.*FERDIGBL|INFRA.*TREOLJE/.test(n))return "Vanntynnet";
    if(/TERRASSEBEIS|TERR(?:ASSE)?\.?\s*B(?:EIS)?\b|TERRASSEOLJE|ROYALOLJE|TYRILIN/.test(n))return "Oljebasert";
    return undefined;
  }
  if(area==="interior"){
    // Grunning før "TRE"/"TAK": "TRESTJ SPERREGRUNNING" og "JOTUN KVIST-SPER.GR" er grunning.
    if(/GRUNN|SPER\.?\s*GR|SPERREGR|HEFTGR|PRIMER/.test(n))return "Grunning";
    if(/\bTAK\b|TAKMAL|TAK\s*(?:&|OG|\/)\s*VEGG/.test(n))return "Tak";
    if(/SUPER\s*MATT|PURE COLOR/.test(n))return "Supermatt";
    if(/SILKEMATT|KLASSISK SM/.test(n))return "Silkematt";
    if(/\bTRE\b|TRESTJ|GULVM|PANEL|\bLIST|\bDØR|\bDOR\b/.test(n))return "Tre & Panel";
    if(/\bMATT\b|VEGG/.test(n))return "Matt";
    return undefined;
  }
  if(area==="tools"){
    // Maskeringsblad er et skjære-/hjelpeverktøy, ikke maskeringstape.
    if(/MASKERINGSTAPE|MASK\.?\s*TAPE|MALERTAPE|PRECISION TAPE|SCOTCH.*TAPE/.test(n))return "Tape";
    if(/DEKK|TILDEKN|PLAST|FOLIE|PAPP|DUK|MASKERINGSPAPIR/.test(n))return "Tildekning";
    if(/PENSEL|STREKP|KOST|FORDRIVER/.test(n))return "Pensler";
    if(/RULL|MINIR|BØYLE|RULLESETT|MALERULL/.test(n))return "Ruller";
    return undefined;
  }
  return undefined;
}

/** Underkategorien når navnet ikke avgjør den. */
export const DEFAULT_SUBGROUP:Record<string,string>={terrace:"Oljebasert",interior:"Matt",tools:"Diverse"};
