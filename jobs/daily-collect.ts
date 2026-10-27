import {createCollector,type SourceCode,CollectionError} from '@withbiz/collectors';
import {normalize} from '@withbiz/normalizer';
import {backend,check} from './backend';
const db=backend();const source=(process.env.COLLECTION_SOURCE||'mss') as SourceCode;
if(!['mss','bizinfo','kstartup'].includes(source))throw Error('INVALID_SOURCE');
const key=process.env[source==='mss'?'MSS_API_KEY':source==='bizinfo'?'BIZINFO_API_KEY':'KSTARTUP_API_KEY'];
if(!key){console.log('Collection skipped: provider key not configured');process.exit(0);}
try{const collector=createCollector(source,key);let total=0;
 for(let page=1;page<=100;page++){
  const batch=await collector.fetchList(page,100);if(!batch.records.length)break;
  const records=batch.records.map(raw=>normalize(source,raw));
  const result=await db.rpc('ingest_catalog',{records,p_source:source});check(result.error);total+=records.length;
  console.log({source,page,received:records.length,result:result.data});if(page*100>=batch.total)break;
 }
 if(!total)throw new CollectionError('ZERO_RECORDS');
 check((await db.rpc('finish_collection_requests',{p_source:source,p_success:true})).error);
}catch(e){const code=e instanceof CollectionError?e.code:'COLLECTION_FAILED';await db.rpc('record_collection_failure',{p_source:source,p_code:code});await db.rpc('finish_collection_requests',{p_source:source,p_success:false});console.error(code);process.exitCode=1;}
