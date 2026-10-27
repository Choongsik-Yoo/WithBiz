import { z } from 'zod';
export const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'] as const;
export const FIELDS = ['금융','기술','인력','수출','내수','창업','경영','투자','교육','기타'] as const;
export const CATEGORIES = { startup:'창업', business:'기업지원', rnd:'R&D', investment:'투자', small_business:'소상공인' } as const;
export type Category = keyof typeof CATEGORIES;
export type AnnouncementStatus = 'upcoming'|'open'|'closing'|'closed'|'unknown';
export const STATUS_LABELS = {upcoming:'접수예정',open:'접수중',closing:'마감임박',closed:'마감',unknown:'기간 확인 필요'};
export interface Announcement {
  id:string; canonical_key:string; title:string; agency:string; operator:string|null; category:Category;
  fields:string[]; regions:string[]; region_estimated:boolean;
  apply_start:string|null; apply_end:string|null; apply_end_at:string|null;
  deadline_kind:'fixed'|'open'|'budget_exhausted'|'unknown'; deadline_text:string;
  source_code:string; source_url:string; summary_text:string;
  collected_at:string; source_created_at:string|null; source_updated_at:string|null; updated_at:string;
  content_hash:string; dedup_hash:string; revision:number; visibility:'published'|'hidden';
  ai_summary:AiSummary|null; ai_model:string|null; ai_prompt_version:string|null;
  attachments:{name:string;url:string}[];
}
export interface AiSummary { target:string; benefits:string; scale:string; documents:string[]; cautions:string[]; confidence:number }
export const AiSummarySchema = z.object({ target:z.string(),benefits:z.string(),scale:z.string(),documents:z.array(z.string()),cautions:z.array(z.string()),confidence:z.number().min(0).max(1) });
export const CompanySchema = z.object({
  name:z.string().trim().min(1,'기업명을 입력하세요').max(100), biz_type:z.enum(['법인','개인']), size:z.enum(['소상공인','소기업','중기업']),
  sido:z.enum(REGIONS), sigungu:z.string().max(50).default(''), ksic_codes:z.array(z.string().regex(/^\d{2,5}$/, 'KSIC 코드는 2~5자리 숫자입니다')).max(10).default([]),
  founded_on:z.string().refine(v=>!v||isValidDate(v),'설립일을 확인하세요').default(''),
  revenue_band:z.string().max(50).default(''), employees:z.number().int().min(0).max(100000).nullable().default(null),
  owner_traits:z.array(z.string().max(30)).max(10).default([]),certifications:z.array(z.string().max(30)).max(20).default([]),
  interests:z.array(z.string().max(30)).max(20).default([]),needs:z.array(z.string().max(30)).max(20).default([]),
});
export type CompanyInput = z.infer<typeof CompanySchema>;
export type Company = CompanyInput & {id:string;owner_id:string;profile_version:number;updated_at:string};
export interface Bookmark { user_id:string;announcement_id:string;memo:string;created_at:string;updated_at:string }
export interface Source {code:string;name:string;homepage_url:string;priority:number;scope:string;connection_note:string;is_active:boolean;last_success_at:string|null;last_error:string|null}
export interface NoticeSettings {user_id:string;email_enabled:boolean;deadline_offsets:number[];weekly_enabled:boolean;change_enabled:boolean}
export function kstDate(now:Date=new Date()):string {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get=(key:string)=>parts.find(p=>p.type===key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function isValidDate(value:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function daysUntil(end:string|null,today=kstDate()):number|null {
  if(!end||!isValidDate(end)||!isValidDate(today))return null;
  return Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
}
export function announcementStatus(a:Pick<Announcement,'apply_start'|'apply_end'|'apply_end_at'|'deadline_kind'>,now:Date=new Date()):AnnouncementStatus {
  const today=kstDate(now), d=daysUntil(a.apply_end,today);
  if(a.apply_end_at&&Date.parse(a.apply_end_at)<=now.getTime())return 'closed';
  if(d!==null&&d<0)return 'closed';
  if(a.apply_start&&a.apply_start>today)return 'upcoming';
  if(d!==null)return d<=7?'closing':'open';
  return a.deadline_kind==='open'||a.deadline_kind==='budget_exhausted'?'open':'unknown';
}
export function dday(a:Pick<Announcement,'apply_end'|'deadline_kind'>,today=kstDate()):string {
  const d=daysUntil(a.apply_end,today);
  if(d===null)return a.deadline_kind==='open'?'상시':a.deadline_kind==='budget_exhausted'?'예산 소진 시':'마감일 미정';
  return d<0?'마감':d===0?'오늘 마감':`D-${d}`;
}
export function endsThisWeek(a:Pick<Announcement,'apply_end'>,today=kstDate()):boolean {
  if(!a.apply_end)return false;
  const day=new Date(today+'T00:00:00Z').getUTCDay();
  const sunday=new Date(Date.parse(today+'T00:00:00Z')+((7-day)%7)*86400000).toISOString().slice(0,10);
  return a.apply_end>=today&&a.apply_end<=sunday;
}
export function safeUrl(value:string):string|null {
  try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.toString():null;}catch{return null;}
}
export function companyCompleteness(c:Partial<CompanyInput>|null):number {
  if(!c)return 0;const values=[c.name,c.biz_type,c.size,c.sido,c.ksic_codes?.length,c.founded_on,c.revenue_band,c.employees!==null&&c.employees!==undefined,c.interests?.length,c.needs?.length];
  return Math.round(values.filter(Boolean).length/values.length*100);
}

export const SOURCE_LABELS:Record<string,string>={mss:'중기부',bizinfo:'기업마당',kstartup:'K-Startup',ntis:'NTIS',smtech:'SMTECH',sbiz24:'소상공인24',semas:'소진공',nipa:'NIPA',kocca:'KOCCA',ccei:'창조경제혁신센터',technopark:'테크노파크',tips:'TIPS',kvic:'한국벤처투자'};
