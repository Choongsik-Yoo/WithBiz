import {backend,check} from './backend';
import {reevaluate,PROMPT_VERSION} from '@withbiz/ai';
import {assessRules} from '@withbiz/matching';
import {announcementStatus,type Announcement,type Company} from '@withbiz/shared';
// Optional paid analysis is opt-in; rule candidates work without provider credentials.
if(!process.env.ANTHROPIC_API_KEY||!process.env.ANTHROPIC_MODEL){console.log('AI matching skipped: provider/model not configured');process.exit(0);}
const db=backend();const {data:companies,error}=await db.from('companies').select('*');check(error);
const {data:catalog,error:catalogError}=await db.from('announcements').select('*').eq('visibility','published').order('collected_at',{ascending:false}).limit(1000);check(catalogError);
for(const company of (companies??[]) as Company[]){
 const candidates=(catalog as Announcement[]).filter(a=>['open','closing','unknown'].includes(announcementStatus(a))).map(a=>({a,rule:assessRules(company,a)})).filter(x=>!x.rule.excluded).sort((a,b)=>b.rule.priority-a.rule.priority).slice(0,20);
 for(const {a}of candidates){
  const model=process.env.ANTHROPIC_MODEL!;const existing=await db.from('match_results').select('id').eq('company_id',company.id).eq('announcement_id',a.id).eq('company_version',company.profile_version).eq('announcement_revision',a.revision).eq('model',model).eq('prompt_version',PROMPT_VERSION).limit(1);check(existing.error);if(existing.data?.length)continue;
  const budget=await db.rpc('reserve_ai_budget',{p_usd:0.25});check(budget.error);if(!budget.data){console.log('Monthly AI budget reached');process.exit(0);}
  const match=await reevaluate(a,company,process.env.ANTHROPIC_API_KEY!,model);
  const result=await db.from('match_results').upsert({company_id:company.id,announcement_id:a.id,company_version:company.profile_version,announcement_revision:a.revision,model,prompt_version:PROMPT_VERSION,score:match.score,reasons:match.reasons,unknown_conditions:match.unknown,excluded:match.excluded},{onConflict:'company_id,announcement_id,company_version,announcement_revision,model,prompt_version'});check(result.error);
 }
}
