insert into public.sources(code,name,homepage_url,is_active,priority,scope,connection_note)
values('sba','SBA 서울경제진흥원','https://www.sba.seoul.kr/Pages/BusinessApply/Posting.aspx',true,3,'서울·기업지원','공식 전체사업 목록·상세 본문·이미지 대체 텍스트·첨부 링크 수집')
on conflict(code) do update set name=excluded.name,homepage_url=excluded.homepage_url,is_active=excluded.is_active,priority=excluded.priority,scope=excluded.scope,connection_note=excluded.connection_note;
