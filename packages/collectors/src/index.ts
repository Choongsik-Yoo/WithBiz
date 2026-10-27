import {createWebCollector,WEB_SOURCES,type WebSourceCode} from './web';
export {WEB_SOURCES,parseWebList,WebCollectionError} from './web';
export type SourceCode='mss'|'bizinfo'|'kstartup'|WebSourceCode;
export interface Collector { code:SourceCode;fetchList(page:number,size:number):Promise<{records:Record<string,unknown>[];total:number}>;fetchDetail(record:Record<string,unknown>):Promise<Record<string,unknown>>;toRaw(record:Record<string,unknown>):Record<string,unknown> }
export class CollectionError extends Error {constructor(public code:string,public retryable=false){super(code);}}
export function createCollector(code:SourceCode,key:string):Collector {
  if(code in WEB_SOURCES)return createWebCollector(code as WebSourceCode);
  if(!key)throw new CollectionError('CONNECTION_REQUIRED');
  return {code,toRaw:r=>r,fetchDetail:async r=>r,async fetchList(page,size){
    const u=new URL(code==='mss'?'https://apis.data.go.kr/1421000/bizinfo/pblancBsnsService':code==='bizinfo'?'https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do':'https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01');
    const params=code==='mss'?{serviceKey:key,dataType:'json',pageNo:String(page),numOfRows:String(size)}:code==='bizinfo'?{crtfcKey:key,dataType:'json',searchCnt:'10000',pageIndex:String(page),pageUnit:String(size)}:{serviceKey:key,returnType:'json',page:String(page),perPage:String(size)};
    for(const [k,v]of Object.entries(params))u.searchParams.set(k,v);
    const j=await request(u);
    if(j.reqErr)throw new CollectionError('PROVIDER_AUTH_OR_REQUEST_ERROR');
    if(j.OpenAPI_ServiceResponse)throw new CollectionError('PROVIDER_AUTH_ERROR');
    if(code==='bizinfo'){
      if(!Array.isArray(j.jsonArray))throw new CollectionError('INVALID_SCHEMA');
      return {records:j.jsonArray,total:Number(j.jsonArray[0]?.totCnt??0)};
    }
    if(code==='mss'){
      const response=j.response;if(!response?.header||!response.body)throw new CollectionError('INVALID_SCHEMA');
      const resultCode=String(response.header.resultCode);
      if(resultCode==='03'&&Number(response.body.totalCount)===0)return {records:[],total:0};
      if(!['00','0'].includes(resultCode))throw new CollectionError('PROVIDER_BUSINESS_ERROR');
      const item=response.body.items?.item;
      return {records:Array.isArray(item)?item:item?[item]:[],total:Number(response.body.totalCount)};
    }
    const data=Array.isArray(j.data)?j.data:j.data?.data;
    if(!Array.isArray(data))throw new CollectionError('INVALID_SCHEMA');
    return {records:data,total:Number(j.totalCount??data.length)};
  }};
}
async function request(url:URL):Promise<Record<string,any>> {
  for(let attempt=0;attempt<3;attempt++){
    try {
      const r=await fetch(url,{signal:AbortSignal.timeout(25000),redirect:'error'});
      if(!r.ok)throw new CollectionError(`HTTP_${r.status}`,r.status===429||r.status>=500);
      try{return await r.json();}catch{throw new CollectionError('INVALID_JSON');}
    }catch(error){
      const e=error instanceof CollectionError?error:new CollectionError('NETWORK_OR_TIMEOUT',true);
      if(!e.retryable||attempt===2)throw e;
      await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));
    }
  }
  throw new CollectionError('RETRIES_EXHAUSTED');
}
