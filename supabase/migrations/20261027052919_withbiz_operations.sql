alter table private.processing_jobs add column payload jsonb not null default '{}';
create function private.request_collection(p_source text) returns uuid language plpgsql security definer set search_path='' as $$
declare jid uuid;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if p_source not in ('mss','bizinfo','kstartup') then raise exception 'INVALID_SOURCE';end if;
 insert into private.processing_jobs(user_id,kind,payload) values(auth.uid(),'collect',jsonb_build_object('source',p_source)) returning id into jid;
 return jid;
end $$;
revoke all on function private.request_collection(text) from public,anon;
grant execute on function private.request_collection(text) to authenticated;
create function public.request_collection(p_source text) returns uuid language sql security invoker set search_path='' as $$select private.request_collection(p_source);$$;
revoke all on function public.request_collection(text) from public,anon;
grant execute on function public.request_collection(text) to authenticated;
create function public.record_collection_failure(p_source text,p_code text) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into private.collection_runs(source_code,status,error_code) values(p_source,'failed',left(p_code,100));
 update public.sources set last_error=left(p_code,100) where code=p_source;
end $$;
revoke all on function public.record_collection_failure(text,text) from public,anon,authenticated;
grant execute on function public.record_collection_failure(text,text) to service_role;
create function public.reserve_ai_budget(p_usd numeric) returns boolean language plpgsql security invoker set search_path='' as $$
declare allowed boolean:=false; current_month date:=date_trunc('month',now() at time zone 'Asia/Seoul')::date;
begin
 if p_usd<=0 or p_usd>1 then raise exception 'INVALID_RESERVATION';end if;
 insert into private.ai_usage(month) values(current_month) on conflict do nothing;
 update private.ai_usage set reserved_usd=reserved_usd+p_usd where month=current_month and reserved_usd+p_usd<=budget_usd returning true into allowed;
 return coalesce(allowed,false);
end $$;
revoke all on function public.reserve_ai_budget(numeric) from public,anon,authenticated;
grant execute on function public.reserve_ai_budget(numeric) to service_role;
