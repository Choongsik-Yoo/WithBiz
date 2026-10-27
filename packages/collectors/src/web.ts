import {createHash} from 'node:crypto';
import {load,type CheerioAPI} from 'cheerio';
import type {Collector} from './index';
export const WEB_SOURCES={
 ntis:{name:'NTIS 국가R&D',url:'https://www.ntis.go.kr/rndgate/eg/un/ra/mng.do',category:'rnd',field:'기술'},
 smtech:{name:'중소기업기술정보진흥원',url:'https://www.smtech.go.kr/front/main/main.do',category:'rnd',field:'기술'},
 nipa:{name:'정보통신산업진흥원',url:'https://www.nipa.kr/home/2-2',category:'business',field:'기술'},
 kocca:{name:'한국콘텐츠진흥원',url:'https://www.kocca.kr/kocca/pims/list.do?menuNo=204104',category:'business',field:'경영'},
 ccei:{name:'창조경제혁신센터',url:'https://ccei.creativekorea.or.kr/service/business_list.do',category:'startup',field:'창업'},
 technopark:{name:'지역 테크노파크',url:'https://technopark.or.kr/www/linkBoard/list.do?mid=1012&type=P',category:'business',field:'기술'},
 tips:{name:'TIPS',url:'https://jointips.or.kr/contents/news/partner',category:'investment',field:'투자'},
 kvic:{name:'한국벤처투자',url:'https://www.kvic.or.kr/notice/kvic-notice/investment-project-notice',category:'investment',field:'투자'},
 sbiz24:{name:'소상공인시장진흥공단',url:'https://www.semas.or.kr/index.jsp',category:'small_business',field:'경영'},
 semas:{name:'소상공인시장진흥공단',url:'https://www.semas.or.kr/index.jsp',category:'small_business',field:'경영'},
} as const;
export type WebSourceCode=keyof typeof WEB_SOURCES;
interface Link {id:string;title:string;url:string;period?:string;agency?:string;created?:string;raw?:unknown;api?:string}
const text=(v:string)=>v.replace(/\s+/g,' ').trim();
const pause=()=>new Promise(resolve=>setTimeout(resolve,450));
export class WebCollectionError extends Error{constructor(public code:string){super(code);}}
async function request(url:string,options?:RequestInit):Promise<string>{
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw new WebCollectionError('UNSAFE_SOURCE_URL');
 const allowedHosts=['ntis.go.kr','smtech.go.kr','nipa.kr','kocca.kr','creativekorea.or.kr','technopark.or.kr','jointips.or.kr','kvic.or.kr','semas.or.kr','sbiz24.kr','btp.or.kr','dgtp.or.kr','gntp.or.kr','ctp.or.kr','gtp.or.kr','gjtp.or.kr','itp.or.kr','djtp.or.kr','utp.or.kr','sjtp.or.kr','gwtp.or.kr','cbtp.or.kr','jbtp.or.kr','jntp.or.kr','gbtp.or.kr','jejutp.or.kr','ptp.or.kr','gdtp.or.kr','wtp.or.kr'];
 if(!allowedHosts.some(host=>u.hostname===host||u.hostname.endsWith('.'+host)))throw new WebCollectionError('UNVERIFIED_SOURCE_HOST');
 for(let n=0;n<3;n++){try{const r=await fetch(u,{...options,headers:{'User-Agent':'WithBizAI/0.1 (+https://github.com/Choongsik-Yoo/WithBiz)',...options?.headers},signal:AbortSignal.timeout(20000)});if(!r.ok){if((r.status===429||r.status>=500)&&n<2){await new Promise(x=>setTimeout(x,1000*(n+1)));continue;}throw new WebCollectionError('HTTP_'+r.status);}const bytes=await r.arrayBuffer();if(bytes.byteLength>8_000_000)throw new WebCollectionError('PAGE_TOO_LARGE');return new TextDecoder(/charset\s*=\s*euc-kr/i.test(r.headers.get('content-type')??'')?'euc-kr':'utf8').decode(bytes);}catch(e){if(e instanceof WebCollectionError)throw e;if(n===2)throw new WebCollectionError('NETWORK_OR_TIMEOUT');await pause();}}
 throw new WebCollectionError('FETCH_FAILED');
}
function httpsUrl(value:string,base:string):string|null{try{const u=new URL(value.replace(/;jsessionid=[^?&#/]*/gi,''),base);if(u.protocol==='http:')u.protocol='https:';return u.protocol==='https:'&&!u.username&&!u.password?u.toString():null;}catch{return null;}}
function add(rows:Link[],entry:Link){if(entry.title.length>5&&entry.title.length<1000&&!rows.some(r=>r.id===entry.id))rows.push(entry);}
export function parseWebList(code:WebSourceCode,html:string):Link[]{
 const config=WEB_SOURCES[code],$=load(html),rows:Link[]=[];
 if(code==='tips'){
  const match=html.match(/window\.CmsBoardRuntime\.mount\(document\.getElementById\('[^']+'\),(\{[\s\S]*?\})\);<\/script>/);if(!match)throw new WebCollectionError('INVALID_TIPS_SCHEMA');const embedded=load(JSON.parse(match[1]).html);
  embedded('[data-post-id][data-bbs-id="1321"], [data-post-id][data-bbs-id="1301"]').each((_,e)=>{const a=embedded(e),id=a.attr('data-post-id')!,bbs=a.attr('data-bbs-id')!;add(rows,{id,title:text(a.find('.news-row-title').text()),url:`${config.url}?postId=${id}&bbsId=${bbs}`,created:text(a.find('.news-row-date').text()),api:`https://jointips.or.kr/api/cms/bbs/${bbs}/board/public/${id}`});});return rows;
 }
 $('a').each((_,e)=>{const a=$(e),href=a.attr('href')??'',click=a.attr('onclick')??'',row=a.closest('tr,li'),title=text(code==='smtech'?a.attr('title')??a.text():a.text());let id='',url:string|null=null;
  if(code==='nipa'&&/\/home\/2-2\/\d+$/.test(href)){id=href.split('/').pop()!;url=httpsUrl(href,config.url);}
  if(code==='kocca'&&href.includes('/pims/view.do')){url=httpsUrl(href,config.url);id=url?new URL(url).searchParams.get('intcNo')??'':'';if(url)url=`https://www.kocca.kr/kocca/pims/view.do?intcNo=${id}&menuNo=204104`;}
  if(code==='smtech'&&href.includes('notice02_detail.do')){url=httpsUrl(href,config.url);if(url){const u=new URL(url);id=(u.searchParams.get('ancmId')??'')+'-'+(u.searchParams.get('dtlAncmSn')??'1');for(const k of ['buclYy','searchCondition','searchKeyword','pageIndex'])u.searchParams.delete(k);url=u.toString();}}
  if(code==='ntis'){const m=click.match(/fn_view\('(\d+)'\)/);if(m){id=m[1];url=`https://www.ntis.go.kr/rndgate/eg/un/ra/view.do?roRndUid=${id}`;}}
  if(code==='kvic'){const m=href.match(/board_view\((\d+)\)/);if(m){id=m[1];url=`${config.url}?pageNo=1&searchType=all&searchWord=&id=${id}`;}}
  if(code==='technopark'&&/updateRdcnt\('(\d+)'\)/.test(click)){id=click.match(/updateRdcnt\('(\d+)'\)/)![1];url=httpsUrl(href,config.url);}
  if((code==='sbiz24'||code==='semas')&&/sbiz24\.kr\/#\/pbanc\/\d+/.test(href)){id=href.match(/\/pbanc\/(\d+)/)![1];url=href;}
  if(!id||!url||/채용|합격자|평가위원|선정결과|결과안내|입찰/.test(title))return;
  const cells=row.find('td').map((_,x)=>text($(x).text())).get(),dates=text(row.text()).match(/20\d{2}[-.]\d{2}[-.]\d{2}/g)??[];
  add(rows,{id,title:title.replace(/^사업공고\s*/, '').replace(/\s*D\s*-\s*\d+$|\s*신청마감$/,''),url,period:code==='ntis'?`${cells[4]??''} ~ ${cells[5]??''}`:undefined,agency:code==='ntis'?cells[3]:undefined,created:dates.length===1?dates[0]:undefined});
 });return rows;
}
function content($:CheerioAPI):string{
 $('script,style,nav,header,footer,.satisfaction,.contents_info,.gnb,.lnb').remove();
 for(const selector of ['.board_cont','.board-view-content','.board-view','.boardView','.view_cont','.bbs_view','#subcontent','#contents','.contents','.content','main','body']){const n=$(selector).first();if(n.text().trim().length>80)return text(n.text()).slice(0,45000);}
 return '';
}
export function createWebCollector(code:WebSourceCode):Collector{
 const config=WEB_SOURCES[code];return {code,fetchDetail:async r=>r,toRaw:r=>r,async fetchList(page,size){
  // Latest official listing per source; bounded crawl never recursively follows arbitrary URLs.
  if(page>1)return {records:[],total:0};let links:Link[]=[];
  if(code==='ccei'){const body=await request('https://ccei.creativekorea.or.kr/service/business_list.json',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({pn:'1',sPtime:'now',pagePerContents:String(Math.min(size,30))}).toString()});const j=JSON.parse(body);if(!Array.isArray(j.result?.list))throw new WebCollectionError('INVALID_CCEI_SCHEMA');links=j.result.list.map((r:Record<string,string>)=>({id:String(r.SEQ),title:r.PROGRAM_TITLE,url:`https://ccei.creativekorea.or.kr/service/business_view.do?seq=${r.SEQ}`,agency:`${r.CD_NM2} 창조경제혁신센터`,period:`${r.C_SDATE} ~ ${r.C_EDATE}`,created:r.REG_DATE?.slice(0,10),raw:r}));}
  else links=parseWebList(code,await request(config.url));
  if(!links.length)throw new WebCollectionError('ZERO_RECORDS_OR_CHANGED_SCHEMA');const records:Record<string,unknown>[]=[];
  for(const link of links.slice(0,Math.min(size,30))){await pause();let summary='',detailState='complete',period=link.period??'';let attachments:{name:string;url:string}[]=[];
   // SEMAS publishes the official Sbiz24 announcement index; no private or protected endpoint is used.
   if(code==='sbiz24'||code==='semas'){summary=link.title+'\n소상공인시장진흥공단 공식 홈페이지에 게시된 소상공인24 연계 공고입니다. 상세 지원내용과 접수기간은 원문에서 확인하세요.';detailState='official_index';}
   else try{if(link.api){const j=JSON.parse(await request(link.api));if(j.code!==200||j.data?.secretYn==='Y')throw new WebCollectionError('PRIVATE_OR_INVALID_POST');summary=content(load(j.data.contents??''));link.created=j.data.regdate?.slice(0,10);}
    else{const html=await request(link.url),$=load(html);summary=content($);attachments=$('a[href]').map((_,e)=>({name:text($(e).text()),url:httpsUrl($(e).attr('href')??'',link.url)??''})).get().filter(x=>x.name&&x.url&&/\.pdf|\.hwp|\.zip|다운로드|첨부파일/.test(x.name+' '+x.url)).slice(0,12);}
    if(!summary||summary.length<30)throw new WebCollectionError('EMPTY_DETAIL');
   }catch(e){detailState=e instanceof WebCollectionError?e.code:'DETAIL_FAILED';summary=link.title+'\n공식 목록에서 수집했습니다. 상세 본문을 불러오지 못해 지원내용과 접수기간은 원문 확인이 필요합니다.';}
   if(!period)period=summary.match(/(?:신청기간|접수기간|접수일|신청접수)[\s:：]{0,10}(20\d{2}[\s\S]{0,120})/)?.[1]??'';
   records.push({_web:true,_category:config.category,_attachments:attachments,pblancId:link.id,pblancNm:link.title,pblancUrl:link.url,jrsdInsttNm:link.agency??config.name,pldirSportRealmLclasCodeNm:config.field,reqstBeginEndDe:period,bsnsSumryCn:summary,creatPnttm:link.created?.replaceAll('.','-')?link.created.replaceAll('.','-')+' 00:00:00':'',_provenance:{listing:config.url,detail_state:detailState},_original:link.raw??null});
  }return {records,total:records.length};
 }};
}
