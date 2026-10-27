import { type Announcement,type CompanyInput } from '@withbiz/shared';
export interface EligibilityCheck { label:string;state:'met'|'unmet'|'unknown';reason:string }
export function assessRules(company:CompanyInput,a:Announcement):{excluded:boolean;checks:EligibilityCheck[];reasons:string[];priority:number} {
  const checks:EligibilityCheck[]=[];
  if(a.regions.includes('전국'))checks.push({label:'지역',state:'met',reason:'전국 공통 공고'});
  else if(!a.regions.length)checks.push({label:'지역',state:'unknown',reason:'공고의 지원 지역을 확인해야 합니다'});
  else if(a.regions.includes(company.sido))checks.push({label:'지역',state:'met',reason:`${company.sido} 소재 기업 조건과 일치`});
  else checks.push({label:'지역',state:a.region_estimated?'unknown':'unmet',reason:a.region_estimated?'추정 지역이 다릅니다. 원문 확인 필요':'공고 지원 지역과 기업 소재지가 다릅니다'});
  const overlap=a.fields.filter(f=>[...company.interests,...company.needs].includes(f));
  checks.push({label:'지원 분야',state:overlap.length?'met':'unknown',reason:overlap.length?`${overlap.join(', ')} 관심 분야와 일치`:'필요한 지원 내용인지 원문 확인 필요'});
  checks.push({label:'세부 자격',state:'unknown',reason:'업력·매출·업종·우대 조건은 공고 원문으로 확인'});
  return {excluded:checks.some(c=>c.state==='unmet'),checks,reasons:checks.filter(c=>c.state==='met').map(c=>c.reason),priority:overlap.length*10+(a.regions.includes(company.sido)?5:0)};
}
export function cosineSimilarity(a:number[],b:number[]):number {
  if(!a.length||a.length!==b.length||a.some(n=>!Number.isFinite(n))||b.some(n=>!Number.isFinite(n)))throw new Error('INCOMPATIBLE_EMBEDDINGS');
  let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}
  return aa&&bb?dot/Math.sqrt(aa*bb):0;
}
