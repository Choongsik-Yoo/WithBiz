-- Transaction-only server-side fixtures. No real Google account is impersonated or persisted.
begin;
do $$declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();begin
 perform set_config('withbiz.test_approved',a::text,true);perform set_config('withbiz.test_denied',b::text,true);
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(a,'withbiz-approved-fixture@gmail.com',now(),'{}'),(b,'withbiz-denied-fixture@gmail.com',now(),'{"email":"csyoo22@gmail.com","role":"admin"}');
 insert into auth.identities(user_id,provider_id,provider,identity_data) values(a,a::text,'google','{"email":"withbiz-approved-fixture@gmail.com","email_verified":true}'),(b,b::text,'google','{"email":"withbiz-denied-fixture@gmail.com","email_verified":true}');
 insert into private.allowed_users(email) values('withbiz-approved-fixture@gmail.com');
end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('withbiz.test_approved'),'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','oauth')))::text,true);
do $$begin
 if not private.can_access() then raise exception 'TEST_FAILED_APPROVED';end if;
 if (select count(*) from public.announcements)=0 then raise exception 'TEST_FAILED_CATALOG';end if;
 if private.is_admin() then raise exception 'TEST_FAILED_ADMIN_ESCALATION';end if;
 begin perform public.manage_allowed_users('allow','fake@gmail.com','');raise exception 'TEST_FAILED_USER_MANAGES_LIST';exception when others then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('withbiz.test_approved'),'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','password')))::text,true);
do $$begin if private.can_access() then raise exception 'TEST_FAILED_PASSWORD_BYPASS';end if;end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('withbiz.test_denied'),'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','oauth')),'user_metadata',jsonb_build_object('email','csyoo22@gmail.com','role','admin'))::text,true);
do $$begin
 if private.can_access() or private.is_admin() then raise exception 'TEST_FAILED_UNREGISTERED_OR_METADATA_SPOOF';end if;
 if (select count(*) from public.announcements)<>0 then raise exception 'TEST_FAILED_DATA_EXPOSED';end if;
 begin perform public.save_company('{"name":"forbidden","sido":"서울","biz_type":"법인","size":"소기업"}');raise exception 'TEST_FAILED_RPC_BYPASS';exception when others then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
end $$;
set local role postgres;
update private.allowed_users set is_active=false where email='withbiz-approved-fixture@gmail.com';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('withbiz.test_approved'),'role','authenticated','amr',jsonb_build_array(jsonb_build_object('method','oauth')))::text,true);
do $$begin if private.can_access() or (select count(*) from public.announcements)<>0 then raise exception 'TEST_FAILED_REVOKE';end if;end $$;
select 'PASS: approved Google, unregistered denial, password denial, metadata spoof denial, RPC denial, revocation, non-admin list denial' as result;
rollback;
