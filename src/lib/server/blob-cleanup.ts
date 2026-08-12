import {del,list} from '@vercel/blob';
import {sql} from './db';

const prefixes=['excel/','product-images/'];

export async function blobStorageAudit(removeOrphans=false){
  const q=sql();
  const [reports,jobs,products,database]=await Promise.all([
    q`SELECT blob_url FROM paint_reports WHERE blob_url IS NOT NULL`,
    q`SELECT blob_url FROM paint_import_jobs WHERE blob_url IS NOT NULL`,
    q`SELECT image_url FROM paint_products WHERE image_url LIKE '%blob.vercel-storage.com/%'`,
    q`SELECT pg_database_size(current_database())::float8 AS bytes`
  ]);
  const referenced=new Set<string>([
    ...reports.map((row:any)=>String(row.blob_url||'')),
    ...jobs.map((row:any)=>String(row.blob_url||'')),
    ...products.map((row:any)=>String(row.image_url||''))
  ].filter(Boolean));
  const blobs:any[]=[];
  for(const prefix of prefixes){
    let cursor:string|undefined;
    do{
      const page=await list({prefix,cursor,limit:1000});
      blobs.push(...page.blobs);
      cursor=page.hasMore?page.cursor:undefined;
    }while(cursor);
  }
  // La helt ferske filer ligge. Det beskytter opplastinger som er mellom Blob
  // og databaseoppdatering akkurat idet kontrollen kjører.
  const cutoff=Date.now()-60*60*1000;
  const orphaned=blobs.filter(blob=>!referenced.has(blob.url)&&new Date(blob.uploadedAt).getTime()<cutoff);
  if(removeOrphans&&orphaned.length){
    for(let i=0;i<orphaned.length;i+=100)await del(orphaned.slice(i,i+100).map(blob=>blob.url));
  }
  const bytes=(items:any[])=>items.reduce((sum,item)=>sum+Number(item.size||0),0);
  return {databaseBytes:Number(database[0]?.bytes||0),totalFiles:blobs.length,totalBytes:bytes(blobs),referencedFiles:blobs.length-orphaned.length,orphanFiles:orphaned.length,orphanBytes:bytes(orphaned),deletedFiles:removeOrphans?orphaned.length:0,deletedBytes:removeOrphans?bytes(orphaned):0};
}
