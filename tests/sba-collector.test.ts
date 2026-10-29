import {describe,it,expect} from 'vitest';
import {parseWebList,parseSbaDetail} from '@withbiz/collectors';
import {normalize} from '@withbiz/normalizer';
describe('SBA official announcements',()=>{
 it('reads the outer ASP.NET row and receipt dates, ignoring nested rows and malformed IDs',()=>{
  const html=`<table><tr class="grid_list"><td><input id="GridView1_new_displayId_0" value="4E62240D-ABD2-F111-B404-D4F5EF4A1E33"></td><td><table><tr><td><a class="posting">2026년 중동 규격 컨설팅 수혜기업 모집</a></td></tr><tr><td>행사기간 2027-01-01</td></tr></table></td><td><span id="GridView1_lb_receipt_start_0">2026-10-28</span><span id="GridView1_lb_receipt_end_0">2026-11-09</span></td></tr><tr class="grid_list"><td><input id="GridView1_new_displayId_1" value="javascript:alert(1)"><a class="posting">잘못된 공고 식별자</a></td></tr></table>`;
  const rows=parseWebList('sba',html);expect(rows).toHaveLength(1);expect(rows[0].url).toBe('https://www.sba.seoul.kr/Pages/BusinessApply/PostingDetail.aspx?p=0&mid=4e62240d-abd2-f111-b404-d4f5ef4a1e33');
  const a=normalize('sba',{_web:true,pblancId:rows[0].id,pblancNm:rows[0].title,pblancUrl:rows[0].url,reqstBeginEndDe:rows[0].period});expect(a.apply_end).toBe('2026-11-09');expect(a.canonical_key).toMatch(/^sba:/);expect(a.regions).toEqual([]);
 });
 it('extracts publisher image alt text, receipt dates and official attachment links without site navigation',()=>{
  const d=parseSbaDetail(`<nav>로그인 누리집지도</nav><span id="new_dt_receipt_start">2026-10-28</span><span id="new_dt_receipt_end">2026-11-09</span><div id="new_ntxt_description"><img alt="지원 대상은 중동 진출 희망 기업이며 전문 컨설팅 기업당 최대 1500만원을 지원합니다."><script>bad()</script></div><a id="new_txt_fileupload_1" href="https://smc.sba.kr/AttachFiles/2026/공고문.hwp">공고문.hwp</a><a id="new_txt_fileupload_2" href="javascript:bad()">위험 링크</a>`, 'https://www.sba.seoul.kr/Pages/BusinessApply/PostingDetail.aspx');
  expect(d.summary).toContain('1500만원');expect(d.summary).not.toContain('누리집지도');expect(d.summary).not.toContain('bad()');expect(d.period).toBe('2026-10-28 ~ 2026-11-09');expect(d.attachments).toHaveLength(1);
 });
 it('marks image-only details without alt text for original-document review',()=>{expect(parseSbaDetail('<span id="new_name">2026년 SBA 모집 공고</span><div id="new_ntxt_description"><img src="poster.jpg"></div>','https://www.sba.seoul.kr/').detailState).toBe('official_detail_metadata');});
});
