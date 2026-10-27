'use client';
import {Bookmark,ExternalLink,MapPin,ArrowUpRight} from 'lucide-react';
import {CATEGORIES,announcementStatus,STATUS_LABELS,dday,type Announcement} from '@withbiz/shared';
import {SOURCE_LABELS} from '@withbiz/shared';
import type {MatchResult} from '@/lib/data';
export function AnnouncementCard({a,saved,onSave,onOpen,match}:{a:Announcement;saved:boolean;onSave:()=>void;onOpen:()=>void;match?:MatchResult}) {
  const status=announcementStatus(a);
  return <article className="announcement-card">
    <div className="card-top"><div className="badge-row"><span className={`badge category-${a.category}`}>{CATEGORIES[a.category]}</span><span className="source-label">{SOURCE_LABELS[a.source_code]??a.source_code}</span></div><span className={`badge deadline ${status==='closing'?'danger':status==='closed'?'neutral':'soft'}`}>{dday(a)}</span></div>
    <h3><button className="title-button" onClick={onOpen}>{a.title}</button></h3>
    <p className="agency">{a.agency}{a.operator&&a.operator!==a.agency?` · ${a.operator}`:''}</p>
    <div className="card-meta"><span><MapPin size={14}/>{a.regions.join(' · ')||'지역 확인 필요'}{a.region_estimated&&a.regions.length>0?<small>추정</small>:null}</span><span>{a.fields.join(' · ')}</span></div>
    {match&&match.score!==null?<div className="match-note"><strong>AI 적합도 {match.score}점</strong><span>{match.reasons[0]}</span></div>:null}
    <div className="card-footer"><span className={`status-label ${status}`}>{STATUS_LABELS[status]}</span><div className="card-actions"><a href={a.source_url} target="_blank" rel="noopener noreferrer" aria-label={`${a.title} 원문 새 창`} title="공고 원문"><ExternalLink size={17}/></a><button className={`icon-button ${saved?'is-saved':''}`} aria-label={`${saved?'관심 해제':'관심 저장'}: ${a.title}`} aria-pressed={saved} onClick={onSave}><Bookmark size={18} fill={saved?'currentColor':'none'}/></button><button className="icon-button" onClick={onOpen} aria-label={`${a.title} 상세 보기`}><ArrowUpRight size={19}/></button></div></div>
  </article>;
}
