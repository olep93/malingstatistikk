import type {ProductRow} from './data';
import {focusEan,type FocusProduct} from './focus-products';

export function summarizeFocusProducts(products:FocusProduct[],rows:ProductRow[]){
  const byEan=new Map<string,{quantity:number;revenue:number;profit:number;hasRows:boolean;image?:string;supplier?:string;subgroup?:string;productKey?:string}>();
  const wanted=new Set(products.map(product=>product.ean));
  for(const row of rows){
    const ean=focusEan(row);
    if(!wanted.has(ean))continue;
    const item=byEan.get(ean)||{quantity:0,revenue:0,profit:0,hasRows:false};
    item.quantity+=row.quantity;item.revenue+=row.revenue;item.profit+=row.profit;item.hasRows=true;
    if(!item.image&&row.image)item.image=row.image;
    item.supplier=row.supplier;item.subgroup=row.subgroup;item.productKey=row.productKey;
    byEan.set(ean,item);
  }
  const items=products.map(product=>{
    const sales=byEan.get(product.ean)||{quantity:0,revenue:0,profit:0,hasRows:false};
    return {...product,...sales,margin:sales.revenue?sales.profit/sales.revenue*100:0};
  }).sort((a,b)=>b.revenue-a.revenue||a.name.localeCompare(b.name,'nb'));
  const totals=items.reduce((sum,item)=>({quantity:sum.quantity+item.quantity,revenue:sum.revenue+item.revenue,profit:sum.profit+item.profit}),{quantity:0,revenue:0,profit:0});
  return {items,totals,margin:totals.revenue?totals.profit/totals.revenue*100:0,selling:items.filter(item=>item.quantity>0).length};
}
