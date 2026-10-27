create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

create table public.sources (
 code text primary key, name text not null, homepage_url text not null,
 is_active boolean not null default false, last_success_at timestamptz, last_error text
);
insert into public.sources values
 ('mss','중소벤처기업부 · 기업마당','https://www.bizinfo.go.kr',true,null,null),
 ('bizinfo','기업마당 직접 API','https://www.bizinfo.go.kr',false,null,'STANDBY'),
 ('kstartup','K-Startup','https://www.k-startup.go.kr',false,null,'CONNECTION_PENDING');

create table public.announcements (
 id uuid primary key default gen_random_uuid(), canonical_key text not null unique,
 title text not null check(length(title) between 1 and 1000), agency text not null, operator text,
 category text not null check(category in ('startup','business','rnd','investment','small_business')),
 fields text[] not null default '{}', regions text[] not null default '{}', region_estimated boolean not null default true,
 apply_start date, apply_end date, apply_end_at timestamptz,
 deadline_kind text not null check(deadline_kind in ('fixed','open','budget_exhausted','unknown')), deadline_text text not null default '',
 source_code text not null references public.sources(code), source_url text not null check(source_url like 'https://%'),
 summary_text text not null default '', attachments jsonb not null default '[]',
 collected_at timestamptz not null default now(), source_created_at timestamptz, source_updated_at timestamptz,
 updated_at timestamptz not null default now(), revision integer not null default 1 check(revision>0),
 content_hash text not null, dedup_hash text not null, visibility text not null default 'published' check(visibility in ('published','hidden')),
 ai_summary jsonb, ai_model text, ai_prompt_version text,
 check(apply_start is null or apply_end is null or apply_start<=apply_end)
);
create table public.announcement_sources (
 source_code text not null references public.sources(code), external_id text not null,
 announcement_id uuid not null references public.announcements(id) on delete cascade,
 original_url text not null, last_seen_at timestamptz not null default now(),
 primary key(source_code,external_id)
);
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade, name text not null default '', created_at timestamptz not null default now()
);
create table private.user_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'user' check(role in ('user','dealer','admin'))
);
create table private.consent_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 consent_type text not null, document_version text not null, accepted boolean not null, created_at timestamptz not null default now()
);
create table public.companies (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 100), biz_type text not null check(biz_type in ('법인','개인')),
 size text not null check(size in ('소상공인','소기업','중기업')), sido text not null, sigungu text not null default '',
 ksic_codes text[] not null default '{}', founded_on date, revenue_band text not null default '', employees integer check(employees>=0 and employees<=100000),
 owner_traits text[] not null default '{}', certifications text[] not null default '{}', interests text[] not null default '{}', needs text[] not null default '{}',
 profile_version integer not null default 1 check(profile_version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.bookmarks (
 user_id uuid not null references auth.users(id) on delete cascade, announcement_id uuid not null references public.announcements(id) on delete cascade,
 memo text not null default '' check(length(memo)<=2000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,announcement_id)
);
create table public.notification_settings (
 user_id uuid primary key references auth.users(id) on delete cascade, email_enabled boolean not null default false,
 deadline_offsets smallint[] not null default '{7,3,1}' check(deadline_offsets <@ array[7,3,1]::smallint[] and cardinality(deadline_offsets)<=3),
 weekly_enabled boolean not null default false, change_enabled boolean not null default false
);
create table public.match_results (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 announcement_id uuid not null references public.announcements(id) on delete cascade,
 company_version integer not null, announcement_revision integer not null,
 score integer check(score between 0 and 100), reasons jsonb not null default '[]', unknown_conditions jsonb not null default '[]',
 excluded boolean not null default false, model text not null, prompt_version text not null,
 created_at timestamptz not null default now(), unique(company_id,announcement_id,company_version,announcement_revision,model,prompt_version)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null, delivery_date date not null,
 status text not null check(status in ('queued','sending','sent','failed','unknown','cancelled')),
 idempotency_key text not null unique, provider_message_id text, sent_at timestamptz, last_error_code text, created_at timestamptz not null default now()
);
create table private.collection_runs (
 id uuid primary key default gen_random_uuid(), source_code text not null references public.sources(code), status text not null,
 fetched_count integer not null default 0, new_count integer not null default 0, changed_count integer not null default 0,
 error_code text, created_at timestamptz not null default now()
);
create table private.announcement_raw (
 id bigint generated always as identity primary key,
 source_code text not null, external_id text not null, announcement_id uuid not null references public.announcements(id) on delete cascade,
 payload jsonb not null, payload_hash text not null, fetched_at timestamptz not null default now(),
 unique(source_code,external_id,payload_hash)
);
create table private.processing_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
 company_id uuid references public.companies(id) on delete cascade, kind text not null, version integer,
 state text not null default 'queued', error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,kind,version)
);
create table private.audit_logs (
 id bigint generated always as identity primary key, actor_user_id uuid, action text not null, target_id uuid,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table private.ai_usage (
 month date primary key, reserved_usd numeric not null default 0, budget_usd numeric not null default 100
);
create table private.embeddings (
 kind text not null, entity_id uuid not null, entity_version integer not null, model text not null,
 dimensions integer not null, embedding jsonb not null, created_at timestamptz not null default now(),
 primary key(kind,entity_id,entity_version,model)
);

create index announcements_deadline_idx on public.announcements(apply_end,id) where visibility='published';
create index announcements_created_idx on public.announcements(source_created_at desc,id) where visibility='published';
create index announcements_regions_idx on public.announcements using gin(regions);
create index announcements_fields_idx on public.announcements using gin(fields);
create index announcement_sources_announcement_idx on public.announcement_sources(announcement_id);
create index companies_owner_idx on public.companies(owner_id);
create index bookmarks_announcement_idx on public.bookmarks(announcement_id);
create index match_company_idx on public.match_results(company_id,company_version,score desc);
create index match_announcement_idx on public.match_results(announcement_id);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create index raw_announcement_idx on private.announcement_raw(announcement_id);
create index jobs_user_idx on private.processing_jobs(user_id);
create index jobs_company_idx on private.processing_jobs(company_id);
create index jobs_state_idx on private.processing_jobs(state,created_at);

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.user_roles where user_id=(select auth.uid()) and role='admin');
$$;
revoke all on function private.is_admin() from public,anon;
grant execute on function private.is_admin() to authenticated;
create function public.my_role() returns text language sql stable security invoker set search_path='' as $$
 select case when private.is_admin() then 'admin' else 'user' end;
$$;
revoke all on function public.my_role() from public,anon;
grant execute on function public.my_role() to authenticated;

do $$ declare t text; begin
 foreach t in array array['sources','announcements','announcement_sources','profiles','companies','bookmarks','notification_settings','match_results','notifications'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
 foreach t in array array['user_roles','consent_events','collection_runs','announcement_raw','processing_jobs','audit_logs','ai_usage','embeddings'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from anon,authenticated',t);
 end loop;
end $$;
grant select on public.sources,public.announcements,public.announcement_sources to anon,authenticated;
grant select on public.profiles,public.companies,public.bookmarks,public.notification_settings,public.match_results,public.notifications to authenticated;
grant insert,delete on public.bookmarks to authenticated;
grant update(memo) on public.bookmarks to authenticated;
grant insert,update on public.notification_settings to authenticated;
grant update(name) on public.profiles to authenticated;
grant update(visibility) on public.announcements to authenticated;
grant all on all tables in schema public,private to service_role;
grant usage,select on all sequences in schema private to service_role;
create policy sources_read on public.sources for select to anon,authenticated using(true);
create policy announcement_public on public.announcements for select to anon using(visibility='published');
create policy announcement_member on public.announcements for select to authenticated using(visibility='published' or (select private.is_admin()));
create policy announcement_admin_update on public.announcements for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy source_records_read on public.announcement_sources for select to anon,authenticated using(exists(select 1 from public.announcements a where a.id=announcement_id and a.visibility='published'));
create policy profiles_read on public.profiles for select to authenticated using((select auth.uid())=user_id);
create policy profiles_update on public.profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy companies_read on public.companies for select to authenticated using((select auth.uid())=owner_id);
create policy bookmarks_read on public.bookmarks for select to authenticated using((select auth.uid())=user_id);
create policy bookmarks_insert on public.bookmarks for insert to authenticated with check((select auth.uid())=user_id and exists(select 1 from public.announcements a where a.id=announcement_id and a.visibility='published'));
create policy bookmarks_update on public.bookmarks for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy bookmarks_delete on public.bookmarks for delete to authenticated using((select auth.uid())=user_id);
create policy settings_read on public.notification_settings for select to authenticated using((select auth.uid())=user_id);
create policy settings_insert on public.notification_settings for insert to authenticated with check((select auth.uid())=user_id);
create policy settings_update on public.notification_settings for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy matches_read on public.match_results for select to authenticated using(exists(select 1 from public.companies c where c.id=company_id and c.owner_id=(select auth.uid())));
create policy notifications_read on public.notifications for select to authenticated using((select auth.uid())=user_id);

create function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(user_id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name',''));
 insert into private.user_roles(user_id) values(new.id);
 insert into public.notification_settings(user_id) values(new.id);
 if new.raw_user_meta_data->>'terms_accepted'='true' then
  insert into private.consent_events(user_id,consent_type,document_version,accepted) values
  (new.id,'terms',coalesce(new.raw_user_meta_data->>'terms_version','unknown'),true),
  (new.id,'privacy',coalesce(new.raw_user_meta_data->>'privacy_version','unknown'),true),
  (new.id,'marketing',coalesce(new.raw_user_meta_data->>'terms_version','unknown'),coalesce(new.raw_user_meta_data->>'marketing_consent','false')='true');
 end if;
 return new;
end $$;
revoke all on function private.handle_new_user() from public,anon,authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure private.handle_new_user();

create function private.save_company(company_data jsonb, company_id uuid, expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.companies; job_id uuid; uid uuid:=(select auth.uid());
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if length(trim(company_data->>'name')) not between 1 and 100 or company_data->>'name' is null then raise exception 'INVALID_NAME'; end if;
 if company_data->>'sido' is null or not (company_data->>'sido'=any(array['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'])) then raise exception 'INVALID_REGION'; end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(company_data->'ksic_codes','[]')) t(v) where v !~ '^\d{2,5}$') then raise exception 'INVALID_KSIC'; end if;
 if company_id is null then
  insert into public.companies(owner_id,name,biz_type,size,sido,sigungu,ksic_codes,founded_on,revenue_band,employees,owner_traits,certifications,interests,needs)
  values(uid,trim(company_data->>'name'),company_data->>'biz_type',company_data->>'size',company_data->>'sido',coalesce(company_data->>'sigungu',''),
   array(select jsonb_array_elements_text(coalesce(company_data->'ksic_codes','[]'))),nullif(company_data->>'founded_on','')::date,coalesce(company_data->>'revenue_band',''),(company_data->>'employees')::integer,
   array(select jsonb_array_elements_text(coalesce(company_data->'owner_traits','[]'))),array(select jsonb_array_elements_text(coalesce(company_data->'certifications','[]'))),
   array(select jsonb_array_elements_text(coalesce(company_data->'interests','[]'))),array(select jsonb_array_elements_text(coalesce(company_data->'needs','[]')))) returning * into result;
 else
  update public.companies c set name=trim(company_data->>'name'),biz_type=company_data->>'biz_type',size=company_data->>'size',sido=company_data->>'sido',sigungu=coalesce(company_data->>'sigungu',''),
   ksic_codes=array(select jsonb_array_elements_text(coalesce(company_data->'ksic_codes','[]'))),founded_on=nullif(company_data->>'founded_on','')::date,revenue_band=coalesce(company_data->>'revenue_band',''),employees=(company_data->>'employees')::integer,
   owner_traits=array(select jsonb_array_elements_text(coalesce(company_data->'owner_traits','[]'))),certifications=array(select jsonb_array_elements_text(coalesce(company_data->'certifications','[]'))),
   interests=array(select jsonb_array_elements_text(coalesce(company_data->'interests','[]'))),needs=array(select jsonb_array_elements_text(coalesce(company_data->'needs','[]'))),profile_version=c.profile_version+1,updated_at=now()
   where c.id=company_id and c.owner_id=uid and c.profile_version=expected_version returning c.* into result;
  if result.id is null then raise exception 'VERSION_CONFLICT'; end if;
 end if;
 insert into private.processing_jobs(user_id,company_id,kind,version) values(uid,result.id,'match',result.profile_version) returning id into job_id;
 return jsonb_build_object('company',to_jsonb(result),'jobId',job_id,'status','queued');
end $$;
revoke all on function private.save_company(jsonb,uuid,integer) from public,anon;
grant execute on function private.save_company(jsonb,uuid,integer) to authenticated;
create function public.save_company(company_data jsonb, company_id uuid default null, expected_version integer default null) returns jsonb language sql security invoker set search_path='' as $$ select private.save_company(company_data,company_id,expected_version); $$;
revoke all on function public.save_company(jsonb,uuid,integer) from public,anon;
grant execute on function public.save_company(jsonb,uuid,integer) to authenticated;

create function private.ingest_catalog(records jsonb,p_source text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; aid uuid; old_hash text; added integer:=0; changed integer:=0; total integer:=0;
begin
 if p_source not in ('mss','bizinfo','kstartup') or jsonb_typeof(records)<>'array' then raise exception 'INVALID_INGEST'; end if;
 if jsonb_array_length(records)=0 then raise exception 'ZERO_RECORDS'; end if;
 for item in select jsonb_array_elements(records) loop
  aid:=null;old_hash:=null;
  select a.id,a.content_hash into aid,old_hash from public.announcements a where a.canonical_key=item->>'canonical_key' for update;
  if aid is null then
   insert into public.announcements(canonical_key,title,agency,operator,category,fields,regions,region_estimated,apply_start,apply_end,deadline_kind,deadline_text,source_code,source_url,summary_text,collected_at,source_created_at,source_updated_at,content_hash,dedup_hash,attachments)
   values(item->>'canonical_key',item->>'title',item->>'agency',item->>'operator',item->>'category',array(select jsonb_array_elements_text(item->'fields')),array(select jsonb_array_elements_text(item->'regions')),(item->>'region_estimated')::boolean,
    nullif(item->>'apply_start','')::date,nullif(item->>'apply_end','')::date,item->>'deadline_kind',coalesce(item->>'deadline_text',''),p_source,item->>'source_url',item->>'summary_text',(item->>'collected_at')::timestamptz,
    nullif(item->>'source_created_at','')::timestamptz,nullif(item->>'source_updated_at','')::timestamptz,item->>'content_hash',item->>'dedup_hash',coalesce(item->'attachments','[]')) returning id into aid;
   added:=added+1;
  elsif old_hash is distinct from item->>'content_hash' then
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
revoke all on function private.ingest_catalog(jsonb,text) from public,anon,authenticated;
grant execute on function private.ingest_catalog(jsonb,text) to service_role;
create function public.ingest_catalog(records jsonb,p_source text) returns jsonb language sql security invoker set search_path='' as $$select private.ingest_catalog(records,p_source);$$;
revoke all on function public.ingest_catalog(jsonb,text) from public,anon,authenticated;
grant execute on function public.ingest_catalog(jsonb,text) to service_role;

create function private.admin_status() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'FORBIDDEN'; end if;
 return jsonb_build_object('runs',(select coalesce(jsonb_agg(r),'[]') from (select * from private.collection_runs order by created_at desc limit 50)r),'users',(select count(*) from public.profiles),'companies',(select count(*) from public.companies),'jobs',(select coalesce(jsonb_agg(j),'[]') from (select id,kind,state,error_code,created_at from private.processing_jobs order by created_at desc limit 20)j));
end $$;
revoke all on function private.admin_status() from public,anon;
grant execute on function private.admin_status() to authenticated;
create function public.admin_status() returns jsonb language sql security invoker set search_path='' as $$select private.admin_status();$$;
revoke all on function public.admin_status() from public,anon;
grant execute on function public.admin_status() to authenticated;

create function private.audit_announcement() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.visibility is distinct from new.visibility then insert into private.audit_logs(actor_user_id,action,target_id,details) values(auth.uid(),'visibility_change',new.id,jsonb_build_object('before',old.visibility,'after',new.visibility));end if;
 return new;
end $$;
revoke all on function private.audit_announcement() from public,anon,authenticated;
create trigger announcement_visibility_audit after update on public.announcements for each row execute procedure private.audit_announcement();
