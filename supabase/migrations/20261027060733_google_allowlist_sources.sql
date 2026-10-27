-- The only initial operator is explicitly designated by the owner.
create table private.allowed_users (
 email text primary key check(email=lower(trim(email)) and email ~ '^[a-z0-9._%+-]+@gmail\.com$'),
 display_name text not null default '' check(length(display_name)<=100),
 is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table private.allowed_users enable row level security;
revoke all on private.allowed_users from public,anon,authenticated;
grant all on private.allowed_users to service_role;
insert into private.allowed_users(email,display_name) values('csyoo22@gmail.com','관리자');

create function private.can_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and coalesce(auth.jwt()->'amr','[]'::jsonb) @> '[{"method":"oauth"}]'::jsonb
 and exists(
  select 1 from auth.users u join auth.identities i on i.user_id=u.id and i.provider='google'
  join private.allowed_users a on a.email=lower(u.email) and a.is_active
  where u.id=(select auth.uid()) and u.email_confirmed_at is not null
  and lower(i.identity_data->>'email')=a.email and i.identity_data->>'email_verified'='true'
 );
$$;
revoke all on function private.can_access() from public,anon;
grant execute on function private.can_access() to authenticated;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private.can_access() and exists(select 1 from auth.users where id=(select auth.uid()) and lower(email)='csyoo22@gmail.com');
$$;
create function public.access_status() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('allowed',private.can_access(),'role',case when private.is_admin() then 'admin' else 'user' end);
$$;
revoke all on function public.access_status() from public,anon;
grant execute on function public.access_status() to authenticated;

-- Restrictive policies compose with the existing ownership and visibility policies.
revoke all on public.announcements,public.announcement_sources from anon;
do $$declare t text;begin
 foreach t in array array['sources','announcements','announcement_sources','profiles','companies','bookmarks','notification_settings','match_results','notifications'] loop
 execute format('create policy approved_google_only on public.%I as restrictive for all to authenticated using ((select private.can_access())) with check ((select private.can_access()))',t);
 end loop;
end $$;
-- SECURITY DEFINER company writes also enforce the allow-list.
create function private.guard_company_access() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and not private.can_access() then raise exception 'ACCESS_DENIED';end if;
 return new;
end $$;
revoke all on function private.guard_company_access() from public,anon,authenticated;
create trigger approved_company_write before insert or update on public.companies for each row execute function private.guard_company_access();

create function private.manage_allowed_users(p_action text,p_email text default null,p_name text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare email_value text:=lower(trim(p_email));
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_action not in ('list','allow','revoke') then raise exception 'INVALID_ACTION';end if;
 if p_action<>'list' then
  if email_value is null or email_value !~ '^[a-z0-9._%+-]+@gmail\.com$' then raise exception 'GMAIL_REQUIRED';end if;
  if email_value='csyoo22@gmail.com' and p_action='revoke' then raise exception 'OWNER_PROTECTED';end if;
  insert into private.allowed_users(email,display_name,is_active,created_by) values(email_value,left(trim(coalesce(p_name,'')),100),p_action='allow',auth.uid())
  on conflict(email) do update set display_name=case when excluded.display_name='' then private.allowed_users.display_name else excluded.display_name end,is_active=excluded.is_active,updated_at=now();
  insert into private.audit_logs(actor_user_id,action,details) values(auth.uid(),'user_access_'||p_action,jsonb_build_object('email',email_value));
 end if;
 return (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]') from private.allowed_users a);
end $$;
revoke all on function private.manage_allowed_users(text,text,text) from public,anon;
grant execute on function private.manage_allowed_users(text,text,text) to authenticated;
create function public.manage_allowed_users(p_action text,p_email text default null,p_name text default '') returns jsonb language sql security invoker set search_path='' as $$select private.manage_allowed_users(p_action,p_email,p_name);$$;
revoke all on function public.manage_allowed_users(text,text,text) from public,anon;
grant execute on function public.manage_allowed_users(text,text,text) to authenticated;

alter table public.sources add column priority smallint not null default 3 check(priority between 1 and 3);
alter table public.sources add column scope text not null default '';
alter table public.sources add column connection_note text not null default '';
update public.sources set priority=1,scope=case when code='kstartup' then '창업지원' else '기업지원 전반' end;
insert into public.sources(code,name,homepage_url,priority,scope,connection_note,last_error) values
 ('ntis','NTIS 국가R&D 사업공고','https://www.ntis.go.kr',2,'R&D','공식 공고/API 제공 방식 확인 후 수집 연결','CONNECTION_PENDING'),
 ('smtech','SMTECH 중소기업기술정보진흥원','https://www.smtech.go.kr',2,'중소기업 R&D','기술개발 사업 공고 수집 연결 준비','CONNECTION_PENDING'),
 ('sbiz24','소상공인24','https://www.sbiz24.kr',2,'소상공인','지원사업 통합 공고 수집 연결 준비','CONNECTION_PENDING'),
 ('semas','소상공인시장진흥공단','https://www.semas.or.kr',2,'소상공인','소상공인24와 중복 공고를 통합할 예정','CONNECTION_PENDING'),
 ('nipa','NIPA 정보통신산업진흥원','https://www.nipa.kr',3,'분야·지역 특화','ICT·디지털 지원사업 수집 연결 준비','CONNECTION_PENDING'),
 ('kocca','KOCCA 한국콘텐츠진흥원','https://www.kocca.kr',3,'분야·지역 특화','콘텐츠 지원사업 수집 연결 준비','CONNECTION_PENDING'),
 ('ccei','창조경제혁신센터','https://ccei.creativekorea.or.kr',3,'분야·지역 특화','지역 센터별 창업 공고 수집 연결 준비','CONNECTION_PENDING'),
 ('technopark','지역 테크노파크 · 한국테크노파크진흥회','https://technopark.or.kr',3,'분야·지역 특화','전국 테크노파크 공고 수집 연결 준비','CONNECTION_PENDING'),
 ('tips','TIPS 투자·창업 프로그램','https://jointips.or.kr',3,'투자','팁스 공고·운영사 정보 연결 준비','CONNECTION_PENDING'),
 ('kvic','한국벤처투자 투자 프로그램','https://www.kvic.or.kr',3,'투자','투자사업·출자사업 공지 연결 준비','CONNECTION_PENDING');

create or replace function private.ingest_catalog(records jsonb,p_source text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; aid uuid; old_hash text; old_canonical text; added integer:=0; changed integer:=0; total integer:=0;
begin
 if not exists(select 1 from public.sources where code=p_source) or jsonb_typeof(records)<>'array' then raise exception 'INVALID_INGEST'; end if;
 if jsonb_array_length(records)=0 then raise exception 'ZERO_RECORDS'; end if;
 for item in select jsonb_array_elements(records) loop
  aid:=null;old_hash:=null;
  select a.id,a.content_hash,a.canonical_key into aid,old_hash,old_canonical from public.announcements a where a.canonical_key=item->>'canonical_key' or a.dedup_hash=item->>'dedup_hash' order by (a.canonical_key=item->>'canonical_key') desc limit 1 for update;
  if aid is null then
   insert into public.announcements(canonical_key,title,agency,operator,category,fields,regions,region_estimated,apply_start,apply_end,deadline_kind,deadline_text,source_code,source_url,summary_text,collected_at,source_created_at,source_updated_at,content_hash,dedup_hash,attachments)
   values(item->>'canonical_key',item->>'title',item->>'agency',item->>'operator',item->>'category',array(select jsonb_array_elements_text(item->'fields')),array(select jsonb_array_elements_text(item->'regions')),(item->>'region_estimated')::boolean,
    nullif(item->>'apply_start','')::date,nullif(item->>'apply_end','')::date,item->>'deadline_kind',coalesce(item->>'deadline_text',''),p_source,item->>'source_url',item->>'summary_text',(item->>'collected_at')::timestamptz,
    nullif(item->>'source_created_at','')::timestamptz,nullif(item->>'source_updated_at','')::timestamptz,item->>'content_hash',item->>'dedup_hash',coalesce(item->'attachments','[]')) returning id into aid;
   added:=added+1;
  elsif old_hash is distinct from item->>'content_hash' and old_canonical=item->>'canonical_key' then
   update public.announcements set title=item->>'title',agency=item->>'agency',operator=item->>'operator',category=item->>'category',fields=array(select jsonb_array_elements_text(item->'fields')),regions=array(select jsonb_array_elements_text(item->'regions')),region_estimated=(item->>'region_estimated')::boolean,
    apply_start=nullif(item->>'apply_start','')::date,apply_end=nullif(item->>'apply_end','')::date,deadline_kind=item->>'deadline_kind',deadline_text=coalesce(item->>'deadline_text',''),summary_text=item->>'summary_text',source_url=item->>'source_url',source_code=p_source,
    collected_at=(item->>'collected_at')::timestamptz,source_updated_at=nullif(item->>'source_updated_at','')::timestamptz,updated_at=now(),content_hash=item->>'content_hash',dedup_hash=item->>'dedup_hash',attachments=coalesce(item->'attachments','[]'),revision=revision+1,ai_summary=null,ai_model=null,ai_prompt_version=null where id=aid;
   changed:=changed+1;
  else
   update public.announcements set collected_at=(item->>'collected_at')::timestamptz where id=aid;
  end if;
  insert into public.announcement_sources(source_code,external_id,announcement_id,original_url,last_seen_at) values(p_source,item->>'external_id',aid,item->>'source_url',now()) on conflict(source_code,external_id) do update set announcement_id=excluded.announcement_id,original_url=excluded.original_url,last_seen_at=excluded.last_seen_at;
  insert into private.announcement_raw(source_code,external_id,announcement_id,payload,payload_hash) values(p_source,item->>'external_id',aid,item->'raw',item->>'content_hash') on conflict do nothing;
  total:=total+1;
 end loop;
 update public.sources set last_success_at=now(),last_error=null where code=p_source;
 insert into private.collection_runs(source_code,status,fetched_count,new_count,changed_count) values(p_source,'success',total,added,changed);
 return jsonb_build_object('received',total,'new',added,'changed',changed);
end $$;

