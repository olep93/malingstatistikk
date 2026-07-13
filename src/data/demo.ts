export type Supplier = "Infra" | "Butinox" | "Jotun";
export type Period = "dag" | "uke" | "måned";
export type SupplierResult = { name: Supplier; revenue: number; profit: number; margin: number; share: number };
export type StoreResult = { store: string; revenue: number; profit: number; margin: number; suppliers: SupplierResult[] };
export type Product = { name:string; supplier:Supplier; size:string; quantity:number; revenue:number; profit:number; margin:number };

export const report = {
  dateISO: "2026-07-12",
  date: "Søndag 12. juli 2026",
  store: "Tønsberg",
  revenue: 30558,
  profit: 8503,
  margin: 27.83,
  regionRank: 5,
  changes: { revenue: 0, profit: 0, margin: 0, rank: 0 },
};

const mk=(name:Supplier,revenue:number,profit:number,margin:number,total:number):SupplierResult=>({name,revenue,profit,margin,share:Number((revenue/total*100).toFixed(1))});
export const stores:StoreResult[]=[
 {store:"Tønsberg",revenue:30558,profit:8503,margin:27.83,suppliers:[mk("Infra",13667,4342,31.77,30558),mk("Butinox",7295,2249,30.83,30558),mk("Jotun",9596,1913,19.93,30558)]},
 {store:"Sandefjord",revenue:58054,profit:15665,margin:26.98,suppliers:[mk("Infra",11370,4101,36.07,58054),mk("Butinox",29638,9203,31.05,58054),mk("Jotun",17046,2361,13.85,58054)]},
 {store:"Skien",revenue:100834,profit:22850,margin:22.66,suppliers:[mk("Infra",7989,3018,37.78,100834),mk("Butinox",48218,15405,31.95,100834),mk("Jotun",44627,4427,9.92,100834)]},
 {store:"Mjøndalen",revenue:60028,profit:12438,margin:20.72,suppliers:[mk("Infra",11930,4443,37.24,60028),mk("Butinox",26120,7819,29.94,60028),mk("Jotun",21979,177,0.80,60028)]},
 {store:"Kongsberg",revenue:32323,profit:4586,margin:14.19,suppliers:[mk("Infra",428,252,58.90,32323),mk("Butinox",12915,3020,23.38,32323),mk("Jotun",18980,1314,6.92,32323)]},
];
export const suppliers=stores[0].suppliers;
export const regionTotals={revenue:281798,profit:64043,margin:22.73,suppliers:[mk("Infra",45384,16155,35.60,281798),mk("Butinox",124186,37697,30.36,281798),mk("Jotun",112229,10191,9.08,281798)]};

export const products:Product[]=[
 {name:"Infra Premium Residence",supplier:"Infra",size:"10 L",quantity:6,revenue:7194,profit:2450,margin:34.1},
 {name:"Infra Premium Dekkende",supplier:"Infra",size:"10 L",quantity:4,revenue:4396,profit:1320,margin:30.0},
 {name:"Infra Oljebeis",supplier:"Infra",size:"9 L",quantity:2,revenue:2077,profit:572,margin:27.5},
 {name:"Butinox Futura Dekkende",supplier:"Butinox",size:"9 L",quantity:3,revenue:3897,profit:1279,margin:32.8},
 {name:"Butinox Futura Soft Look",supplier:"Butinox",size:"9 L",quantity:2,revenue:2398,profit:730,margin:30.4},
 {name:"Butinox Terrassebeis",supplier:"Butinox",size:"9 L",quantity:1,revenue:1000,profit:240,margin:24.0},
 {name:"Drygolin Nordic Extreme",supplier:"Jotun",size:"10 L",quantity:4,revenue:5596,profit:1198,margin:21.4},
 {name:"Drygolin Power Clean",supplier:"Jotun",size:"10 L",quantity:2,revenue:2800,profit:520,margin:18.6},
 {name:"Trebitt Oljebeis",supplier:"Jotun",size:"9 L",quantity:1,revenue:1200,profit:195,margin:16.3},
];

export const history=[
 {date:"12.07.2026",dateISO:"2026-07-12",revenue:30558,margin:27.83,rank:5},
 {date:"11.07.2026",dateISO:"2026-07-11",revenue:42180,margin:29.4,rank:3},
 {date:"10.07.2026",dateISO:"2026-07-10",revenue:38740,margin:28.8,rank:4},
 {date:"09.07.2026",dateISO:"2026-07-09",revenue:51220,margin:31.1,rank:2},
];
