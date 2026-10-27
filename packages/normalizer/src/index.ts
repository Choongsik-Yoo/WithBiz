import { createHash } from 'node:crypto';
import { REGIONS, isValidDate, safeUrl, type Announcement, type Category } from '@withbiz/shared';
export type RawRecord=Record<string,unknown>;
const str=(r:RawRecord,k:string)=>r[k]==null?'':String(r[k]);
export function plainText(html:string):string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<\/(p|div|li|h\d)>|<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'')
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/g,(_,k:string)=>({nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[k]!))
    .replace(/&#(\d+);/g,(_,n:string)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):'')
    .replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
}
export function parsePeriod(text:string):{start:string|null;end:string|null;kind:Announcement['deadline_kind']} {
  const candidates=[...text.matchAll(/(20\d{2})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})|(20\d{2})(\d{2})(\d{2})/g)].map(m=>`${m[1]??m[4]}-${(m[2]??m[5]).padStart(2,'0')}-${(m[3]??m[6]).padStart(2,'0')}`).filter(isValidDate);
  if(candidates.length>=2&&candidates[0]<=candidates[1])return {start:candidates[0],end:candidates[1],kind:'fixed'};
  if(/예산.*소진|소진.*시/.test(text))return {start:null,end:null,kind:'budget_exhausted'};
  if(/상시|연중/.test(text))return {start:null,end:null,kind:'open'};
  return {start:null,end:null,kind:'unknown'};
}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function normalize(source:string,r:RawRecord,now=new Date()):Omit<Announcement,'id'|'revision'|'updated_at'|'visibility'|'ai_summary'|'ai_model'|'ai_prompt_version'> & {external_id:string;raw:RawRecord} {
  const k=source==='kstartup';
  const title=plainText(str(r,k?'biz_pbanc_nm':'pblancNm'));
  const external_id=str(r,k?'pbanc_sn':'pblancId');
  const source_url=safeUrl(str(r,k?'biz_aply_url':'pblancUrl'));
  if(!title||!external_id||!source_url)throw new Error('INVALID_RECORD_REQUIRED_FIELDS');
  const agency=plainText(str(r,k?'pbanc_ntrp_nm':'jrsdInsttNm'))||'기관 확인 필요';
  const summary_text=plainText(str(r,k?'pbanc_ctnt':'bsnsSumryCn'));
  const field=str(r,k?'supt_biz_clsfc':'pldirSportRealmLclasCodeNm')||'기타';
  const tags=str(r,k?'supt_regin':'hashtags').split(',').map(s=>s.trim());
  const titleRegion=title.match(/^\[([^\]]+)\]/)?.[1]??'';
  const regions=REGIONS.filter(region=>tags.some(t=>t===region||t.startsWith(region)&&t.length<=7)||titleRegion.startsWith(region));
  const nationwide=tags.includes('전국')||k&&str(r,'supt_regin')==='전국';
  const period=parsePeriod(k?`${str(r,'pbanc_rcpt_bgng_dt')} ~ ${str(r,'pbanc_rcpt_end_dt')}`:str(r,'reqstBeginEndDe'));
  let category:Category=field==='창업'?'startup':/소상공인/.test(str(r,'trgetNm'))?'small_business':/투자/.test(field)?'investment':/R&D|연구개발/.test(field)?'rnd':'business';
  if(k)category='startup';
  if(r._web&&['startup','business','rnd','investment','small_business'].includes(String(r._category)))category=r._category as Category;
  const attachments=r._web&&Array.isArray(r._attachments)?r._attachments.filter((x:any)=>safeUrl(x.url)) as {name:string;url:string}[]:[{name:str(r,'fileNm')||'첨부파일',url:str(r,'flpthNm')},{name:str(r,'printFileNm')||'공고문',url:str(r,'printFlpthNm')}].filter(x=>safeUrl(x.url));
  const family=r._web?(source==='semas'?'sbiz24':source):k?'kstartup':'bizinfo';
  const base={canonical_key:`${family}:${external_id}`,title,agency,operator:plainText(str(r,k?'sprv_inst':'excInsttNm'))||null,
    category,fields:[field],regions:nationwide?['전국']:regions,region_estimated:!k,
    apply_start:period.start,apply_end:period.end,apply_end_at:null,deadline_kind:period.kind,
    deadline_text:k?`${str(r,'pbanc_rcpt_bgng_dt')} ~ ${str(r,'pbanc_rcpt_end_dt')}`:str(r,'reqstBeginEndDe'),
    source_code:source,source_url,summary_text,source_created_at:toTimestamp(str(r,'creatPnttm')),source_updated_at:toTimestamp(str(r,'updtPnttm')),attachments};
  return {...base,collected_at:now.toISOString(),content_hash:hash({...base,source_code:undefined}),dedup_hash:hash([title.replace(/[\s\[\]().·ㆍ]/g,''),agency,period.end]),external_id,raw:r};
}
function toTimestamp(v:string):string|null {if(!v)return null;const s=v.replace(' ','T')+(/[Z+]/.test(v)?'':'+09:00');const d=new Date(s);return Number.isNaN(d.getTime())?null:d.toISOString();}
