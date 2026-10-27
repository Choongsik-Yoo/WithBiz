import { supabase } from './supabase';
import type {Announcement,Bookmark,Company,CompanyInput,Source,NoticeSettings} from '@withbiz/shared';
const listColumns='id,canonical_key,title,agency,operator,category,fields,regions,region_estimated,apply_start,apply_end,apply_end_at,deadline_kind,deadline_text,source_code,source_url,collected_at,source_created_at,source_updated_at,updated_at,revision,visibility,ai_model';
export async function getCatalog():Promise<Announcement[]> {
  const all:Announcement[]=[];
  for(let page=0;page<20;page++){
    const {data,error}=await supabase.from('announcements').select(listColumns).eq('visibility','published').order('source_created_at',{ascending:false,nullsFirst:false}).order('id').range(page*500,page*500+499);
    if(error)throw new Error('공고를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    all.push(...(data??[]) as unknown as Announcement[]);
    if(!data||data.length<500)return all;
  }
  throw new Error('목록이 너무 큽니다. 서버 검색 연결이 필요합니다.');
}
export async function getAnnouncement(id:string):Promise<Announcement> {
  const {data,error}=await supabase.from('announcements').select('*').eq('id',id).eq('visibility','published').single();
  if(error||!data)throw new Error('공고를 찾을 수 없거나 공개가 중지되었습니다.');return data as Announcement;
}
export async function getSources():Promise<Source[]> {const {data,error}=await supabase.from('sources').select('*').order('code');if(error)throw new Error('출처 정보를 불러오지 못했습니다.');return data??[];}
export interface MemberData {companies:Company[];bookmarks:Bookmark[];settings:NoticeSettings|null;role:string;matches:MatchResult[]}
export interface MatchResult {company_id:string;announcement_id:string;company_version:number;announcement_revision:number;score:number|null;reasons:string[];unknown_conditions:string[];created_at:string;excluded:boolean}
export async function getMember(userId:string):Promise<MemberData> {
  const [c,b,s,r,m]=await Promise.all([
    supabase.from('companies').select('*').eq('owner_id',userId).order('updated_at',{ascending:false}),
    supabase.from('bookmarks').select('*').eq('user_id',userId),
    supabase.from('notification_settings').select('*').eq('user_id',userId).maybeSingle(),
    supabase.rpc('my_role'),
    supabase.from('match_results').select('*'),
  ]);
  if(c.error||b.error||s.error||r.error||m.error)throw new Error('내 정보를 불러오지 못했습니다. 다시 로그인하거나 재시도해 주세요.');
  return {companies:c.data??[],bookmarks:b.data??[],settings:s.data,role:r.data??'user',matches:m.data??[]};
}
export async function saveCompany(input:CompanyInput,id?:string,version?:number) {
  const {data,error}=await supabase.rpc('save_company',{company_data:input,company_id:id??null,expected_version:version??null});
  if(error)throw new Error(error.message.includes('VERSION_CONFLICT')?'다른 창에서 수정한 내용이 있습니다. 새로고침 후 저장하세요.':'기업 정보 저장에 실패했습니다. 입력값과 로그인 상태를 확인하세요.');
  return data;
}
export async function setBookmark(userId:string,announcementId:string,save:boolean) {
  const q=save?supabase.from('bookmarks').upsert({user_id:userId,announcement_id:announcementId},{onConflict:'user_id,announcement_id',ignoreDuplicates:true}):supabase.from('bookmarks').delete().eq('user_id',userId).eq('announcement_id',announcementId);
  const {error}=await q;if(error)throw new Error('관심 공고 저장에 실패했습니다. 다시 시도해 주세요.');
}
export async function saveMemo(userId:string,announcementId:string,memo:string) {const {error}=await supabase.from('bookmarks').update({memo}).eq('user_id',userId).eq('announcement_id',announcementId);if(error)throw new Error('메모를 저장하지 못했습니다.');}
export async function saveNoticeSettings(settings:NoticeSettings) {const {error}=await supabase.from('notification_settings').upsert(settings);if(error)throw new Error('알림 설정을 저장하지 못했습니다.');}
export async function getNotifications() {const {data,error}=await supabase.from('notifications').select('id,status,kind,delivery_date,sent_at,last_error_code').order('created_at',{ascending:false}).limit(20);if(error)throw new Error('알림 이력을 불러오지 못했습니다.');return data??[];}
