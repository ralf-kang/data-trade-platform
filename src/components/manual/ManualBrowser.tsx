'use client';

import { useMemo, useState, useEffect } from 'react';
import { BookOpen, Search, Info } from 'lucide-react';
import { MANUAL_GROUPS, searchSections, type ManualAudience, type ManualSection } from '@/lib/manual';

/**
 * 사용 매뉴얼 뷰어.
 * 좌측 목차 + 우측 본문. 검색어를 넣으면 목차 자체가 결과 목록으로 좁혀진다 —
 * 별도 검색 결과 화면을 두면 "찾은 뒤 다시 목차로 돌아가는" 왕복이 생긴다.
 */
export default function ManualBrowser({
  audience,
  initialSectionId,
}: {
  audience: ManualAudience;
  initialSectionId?: string;
}) {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | undefined>(initialSectionId);

  const sections = useMemo(() => searchSections(query, audience), [query, audience]);

  // 검색으로 목록이 바뀌었는데 현재 선택 항목이 목록에 없으면 첫 항목으로 옮긴다.
  useEffect(() => {
    if (sections.length === 0) return;
    if (!activeId || !sections.some((s) => s.id === activeId)) {
      setActiveId(sections[0].id);
    }
  }, [sections, activeId]);

  const active: ManualSection | undefined = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* 목차 */}
      <aside className="w-full lg:w-72 shrink-0">
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="매뉴얼 검색"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        {sections.length === 0 ? (
          <p className="text-sm text-slate-400 px-1">검색 결과가 없습니다.</p>
        ) : (
          <nav className="space-y-4">
            {MANUAL_GROUPS.filter((g) => sections.some((s) => s.group === g)).map((group) => (
              <div key={group}>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide px-1 mb-1">{group}</div>
                <ul className="space-y-0.5">
                  {sections
                    .filter((s) => s.group === group)
                    .map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => setActiveId(s.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            active?.id === s.id
                              ? 'bg-indigo-50 text-indigo-700 font-medium'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {s.title}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </aside>

      {/* 본문 */}
      <article className="flex-1 bg-white rounded-xl border border-slate-200 p-6 lg:p-8 min-w-0">
        {!active ? (
          <p className="text-slate-400 text-sm">항목을 선택하세요.</p>
        ) : (
          <>
            <div className="flex items-start gap-3 mb-1">
              <BookOpen className="w-5 h-5 text-indigo-600 mt-1 shrink-0" />
              <h1 className="text-2xl font-bold text-slate-900">{active.title}</h1>
            </div>
            <p className="text-slate-500 mb-6 pl-8">{active.summary}</p>

            <div className="space-y-4 pl-8">
              {active.body.map((block, i) => {
                if (block.type === 'p') {
                  return (
                    <p key={i} className="text-slate-700 leading-relaxed">
                      {block.text}
                    </p>
                  );
                }
                if (block.type === 'ul') {
                  return (
                    <ul key={i} className="space-y-2">
                      {block.items.map((item, j) => (
                        <li key={j} className="text-slate-700 leading-relaxed flex gap-2">
                          <span className="text-indigo-400 shrink-0">·</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <div
                    key={i}
                    className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
                  >
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="leading-relaxed">{block.text}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </article>
    </div>
  );
}
