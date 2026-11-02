/** Shared presentation rules for screen and print. */
export function marginTone(value:number){return value>=30?'excellent':value>=25?'high':value>=15?'medium':value>=10?'low':'critical'}
export function isoWeekKey(value:Date){
 const date=new Date(Date.UTC(value.getFullYear(),value.getMonth(),value.getDate()));
 date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));
 const year=date.getUTCFullYear();
 const week=Math.ceil(((date.getTime()-Date.UTC(year,0,1))/86400000+1)/7);
 return `${year}-W${String(week).padStart(2,'0')}`;
}
