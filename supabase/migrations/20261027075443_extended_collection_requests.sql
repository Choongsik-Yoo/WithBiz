create or replace function private.request_collection(p_source text) returns uuid language plpgsql security definer set search_path='' as $$
declare jid uuid;
begin
 if not private.is_admin() then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.sources where code=p_source and is_active) then raise exception 'INACTIVE_OR_UNKNOWN_SOURCE';end if;
 insert into private.processing_jobs(user_id,kind,payload) values(auth.uid(),'collect',jsonb_build_object('source',p_source)) returning id into jid;
 return jid;
end $$;

