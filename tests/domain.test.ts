import {describe,it,expect} from 'vitest';
import {kstDate,announcementStatus,endsThisWeek,safeUrl,CompanySchema,type Announcement,type Company} from '@withbiz/shared';
import {parsePeriod,normalize,plainText} from '@withbiz/normalizer';
import {assessRules,cosineSimilarity} from '@withbiz/matching';
describe('Korean deadline boundaries',()=>{
 it('changes date at KST midnight',()=>{expect(kstDate(new Date('2026-10-27T15:00:00Z'))).toBe('2026-10-28');});
 it('keeps day-only deadlines open through the day, exact timestamps close immediately',()=>{const a={apply_start:null,apply_end:'2026-10-27',apply_end_at:null,deadline_kind:'fixed' as const};expect(announcementStatus(a,new Date('2026-10-27T14:59:59Z'))).toBe('closing');expect(announcementStatus(a,new Date('2026-10-27T15:00:00Z'))).toBe('closed');expect(announcementStatus({...a,apply_end_at:'2026-10-27T09:00:00Z'},new Date('2026-10-27T09:00:00Z'))).toBe('closed');});
 it('week ends Sunday and never includes past dates',()=>{expect(endsThisWeek({apply_end:'2026-11-01'},'2026-10-27')).toBe(true);expect(endsThisWeek({apply_end:'2026-11-02'},'2026-10-27')).toBe(false);expect(endsThisWeek({apply_end:'2026-10-26'},'2026-10-27')).toBe(false);});
});
describe('source normalization',()=>{
 it('parses real compact periods and rejects impossible days',()=>{expect(parsePeriod('20260201 ~ 20260228')).toEqual({start:'2026-02-01',end:'2026-02-28',kind:'fixed'});expect(parsePeriod('20260201 ~ 20260230').kind).toBe('unknown');expect(parsePeriod('예산 소진 시').kind).toBe('budget_exhausted');});
 it('deduplicates MSS and Bizinfo and ignores collection time/view counts',()=>{const r={pblancId:'P1',pblancNm:'[서울] 지원 공고',pblancUrl:'https://www.bizinfo.go.kr/a',jrsdInsttNm:'서울시',reqstBeginEndDe:'20261001 ~ 20261101',hashtags:'서울',bsnsSumryCn:'<p>지원 내용</p>'};const a=normalize('mss',r,new Date('2026-10-01')),b=normalize('bizinfo',{...r,inqireCo:99},new Date('2026-10-02'));expect(a.canonical_key).toBe(b.canonical_key);expect(a.content_hash).toBe(b.content_hash);expect(normalize('mss',{...r,bsnsSumryCn:'변경'}).content_hash).not.toBe(a.content_hash);});
 it('drops executable content and unsafe URLs',()=>{expect(plainText('<script>alert(1)</script><p>내용 &amp; 안내</p>')).toBe('내용 & 안내');expect(safeUrl('javascript:alert(1)')).toBeNull();expect(safeUrl('https://user:secret@example.com')).toBeNull();});
});
describe('matching uncertainty',()=>{
 const c={...CompanySchema.parse({name:'테스트 기업',biz_type:'법인',size:'소기업',sido:'서울'}),id:'c',owner_id:'u',profile_version:1,updated_at:''} as Company;
 it('does not exclude on estimated regional data',()=>{const a={regions:['부산'],region_estimated:true,fields:['기술']} as Announcement;expect(assessRules(c,a).excluded).toBe(false);expect(assessRules(c,{...a,region_estimated:false}).excluded).toBe(true);});
 it('checks embedding dimensions and zero vectors',()=>{expect(cosineSimilarity([1,0],[1,0])).toBe(1);expect(cosineSimilarity([0,0],[1,0])).toBe(0);expect(()=>cosineSimilarity([1],[1,0])).toThrow();});
});
