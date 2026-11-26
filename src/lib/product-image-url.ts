import type { ProductRow } from './data';
import { appPath } from './base-path';

export function productImageUrl(row:ProductRow){return appPath(row.image||`/api/product-image?${new URLSearchParams({product:row.product,supplier:row.supplier,size:row.size||"",ean:row.ean||"",itemNo:row.itemNo||"",key:row.productKey||[row.supplier,row.product,row.size||""].join("|"),v:"5"}).toString()}`)}
