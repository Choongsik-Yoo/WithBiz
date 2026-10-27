create function public.finish_collection_requests(p_source text,p_success boolean) returns void language sql security invoker set search_path='' as $$
 update private.processing_jobs set state=case when p_success then 'done' else 'failed' end,updated_at=now(),error_code=case when p_success then null else 'COLLECTION_FAILED' end where kind='collect' and state='queued' and payload->>'source'=p_source;
$$;
revoke all on function public.finish_collection_requests(text,boolean) from public,anon,authenticated;
grant execute on function public.finish_collection_requests(text,boolean) to service_role;
