create or replace function private.can_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and coalesce(auth.jwt()->'amr','[]'::jsonb) @> '[{"method":"oauth"}]'::jsonb
 and exists(select 1 from auth.sessions s where s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=(select auth.uid()) and (s.not_after is null or s.not_after>now()))
 and exists(
  select 1 from auth.users u join auth.identities i on i.user_id=u.id and i.provider='google'
  join private.allowed_users a on a.email=lower(u.email) and a.is_active
  where u.id=(select auth.uid()) and u.email_confirmed_at is not null
  and lower(i.identity_data->>'email')=a.email and i.identity_data->>'email_verified'='true'
 );
$$;
