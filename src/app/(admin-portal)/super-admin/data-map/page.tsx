'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Network, Info, Database, Braces } from 'lucide-react';

type Cluster = 'identity' | 'form' | 'response' | 'reward' | 'audit' | 'unstructured';
type DataStore = 'postgres' | 'elasticsearch';

interface Node {
  id: string;
  label: string;
  cluster: Cluster;
  store: DataStore;
  description: string;
  count: number;
}

interface Edge {
  from: string;
  to: string;
  field: string;
  cardinality: 'N:1' | '1:1';
  optional: boolean;
  linkType: 'fk' | 'shared-key';
}

interface SchemaExampleField {
  id: string;
  type: string;
  label: string;
  esKey: string;
  esSubfields: string[];
}

interface SchemaExample {
  formId: string;
  formTitle: string;
  fields: SchemaExampleField[];
  sampleSubmissionData: Record<string, unknown>;
}

const CLUSTER_META: Record<Cluster, { title: string; color: string; center: [number, number] }> = {
  identity: { title: '사용자 · 권한', color: '#6366f1', center: [220, 170] },
  form: { title: '양식 · 배포', color: '#0ea5e9', center: [760, 430] },
  response: { title: '응답 · 참여', color: '#10b981', center: [1290, 190] },
  reward: { title: '포인트 · 보상', color: '#f59e0b', center: [1290, 700] },
  audit: { title: '감사 · 설정', color: '#64748b', center: [260, 740] },
  unstructured: { title: '비정형 (Elasticsearch)', color: '#d97706', center: [760, 780] },
};

const NODE_W = 176;
const NODE_H = 60;

// 클러스터 중심을 기준으로 소속 노드를 2열 그리드로 배치한다 — 물리 시뮬레이션 없이도
// 겹치지 않고 읽기 쉬운 배치가 나오도록 고정 레이아웃을 쓴다.
function layout(nodes: Node[]): Map<string, [number, number]> {
  const byCluster = new Map<Cluster, Node[]>();
  for (const n of nodes) {
    if (!byCluster.has(n.cluster)) byCluster.set(n.cluster, []);
    byCluster.get(n.cluster)!.push(n);
  }
  const positions = new Map<string, [number, number]>();
  for (const [cluster, members] of byCluster) {
    const [cx, cy] = CLUSTER_META[cluster].center;
    const cols = members.length > 4 ? 2 : 1;
    const colGap = 210;
    const rowGap = 82;
    members.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const totalRows = Math.ceil(members.length / cols);
      const x = cx + (col - (cols - 1) / 2) * colGap;
      const y = cy + (row - (totalRows - 1) / 2) * rowGap;
      positions.set(n.id, [x, y]);
    });
  }
  return positions;
}

export default function DataMapPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [schemaExample, setSchemaExample] = useState<SchemaExample | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/super-admin/data-map')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setNodes(j.nodes ?? []);
        setEdges(j.edges ?? []);
        setSchemaExample(j.schemaExample ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const positions = useMemo(() => layout(nodes), [nodes]);

  const connectedEdgeSet = useMemo(() => {
    if (!selected) return null;
    return new Set(edges.filter((e) => e.from === selected || e.to === selected).map((e) => `${e.from}->${e.to}->${e.field}`));
  }, [selected, edges]);

  const connectedNodeSet = useMemo(() => {
    if (!selected) return null;
    const set = new Set<string>([selected]);
    for (const e of edges) {
      if (e.from === selected) set.add(e.to);
      if (e.to === selected) set.add(e.from);
    }
    return set;
  }, [selected, edges]);

  const selectedNode = nodes.find((n) => n.id === selected) ?? null;
  const selectedRelations = selected
    ? edges.filter((e) => e.from === selected || e.to === selected)
    : [];

  if (loading) return <div className="p-8 text-slate-400 text-sm">불러오는 중...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-8">
      <div className="max-w-[1600px] mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center">
              <Network className="w-8 h-8 mr-3 text-indigo-600" />
              데이터 구조 관계도
            </h1>
            <p className="text-slate-500 mt-2">
              정형(PostgreSQL, 실선 상자·실선 화살표)과 비정형(Elasticsearch, 점선 상자·주황
              점선 화살표) 저장소를 함께 보여주는 구조도입니다. 각 상자를 클릭하면 연결된 관계만
              강조됩니다. 괄호 안 숫자는 현재 실제 저장된 문서/행 수입니다.
            </p>
          </div>
          <Link
            href="/super-admin"
            className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
          >
            슈퍼 어드민 대시보드
          </Link>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <svg viewBox="0 0 1560 880" className="w-full h-[720px]">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
                </marker>
                <marker id="arrow-shared-key" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#d97706" />
                </marker>
              </defs>

              {/* 클러스터 라벨 */}
              {(Object.keys(CLUSTER_META) as Cluster[]).map((c) => (
                <text
                  key={c}
                  x={CLUSTER_META[c].center[0]}
                  y={CLUSTER_META[c].center[1] - 130}
                  textAnchor="middle"
                  className="text-xs font-bold"
                  fill={CLUSTER_META[c].color}
                >
                  {CLUSTER_META[c].title}
                </text>
              ))}

              {/* 엣지 */}
              {edges.map((e) => {
                const from = positions.get(e.from);
                const to = positions.get(e.to);
                if (!from || !to) return null;
                const dimmed = connectedEdgeSet && !connectedEdgeSet.has(`${e.from}->${e.to}->${e.field}`);
                return (
                  <g key={`${e.from}-${e.to}-${e.field}`} opacity={dimmed ? 0.08 : 1}>
                    <line
                      x1={from[0]}
                      y1={from[1]}
                      x2={to[0]}
                      y2={to[1]}
                      stroke={e.linkType === 'shared-key' ? '#d97706' : e.cardinality === '1:1' ? '#818cf8' : '#94a3b8'}
                      strokeWidth={e.linkType === 'shared-key' ? 2 : 1.5}
                      strokeDasharray={e.linkType === 'shared-key' ? '2 4' : e.optional ? '4 3' : undefined}
                      markerEnd={e.linkType === 'shared-key' ? 'url(#arrow-shared-key)' : 'url(#arrow)'}
                    />
                    <text
                      x={(from[0] + to[0]) / 2}
                      y={(from[1] + to[1]) / 2 - 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#64748b"
                      className="pointer-events-none select-none"
                    >
                      {e.field}
                    </text>
                  </g>
                );
              })}

              {/* 노드 */}
              {nodes.map((n) => {
                const pos = positions.get(n.id);
                if (!pos) return null;
                const [x, y] = pos;
                const dimmed = connectedNodeSet && !connectedNodeSet.has(n.id);
                const isSelected = selected === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${x - NODE_W / 2}, ${y - NODE_H / 2})`}
                    opacity={dimmed ? 0.25 : 1}
                    className="cursor-pointer"
                    onClick={() => setSelected(isSelected ? null : n.id)}
                  >
                    <rect
                      width={NODE_W}
                      height={NODE_H}
                      rx={10}
                      fill={n.store === 'elasticsearch' ? '#fffbeb' : 'white'}
                      stroke={isSelected ? CLUSTER_META[n.cluster].color : n.store === 'elasticsearch' ? '#fbbf24' : '#e2e8f0'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeDasharray={n.store === 'elasticsearch' ? '5 3' : undefined}
                    />
                    <rect width={6} height={NODE_H} rx={3} fill={CLUSTER_META[n.cluster].color} />
                    <text x={16} y={24} fontSize={12} fontWeight={700} fill="#0f172a">
                      {n.label}
                    </text>
                    <text x={16} y={42} fontSize={10} fill="#94a3b8">
                      {n.count.toLocaleString()}건 · {n.store === 'elasticsearch' ? 'Elasticsearch' : 'PostgreSQL'}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                <span className="inline-block w-5 h-3 rounded border border-slate-300 bg-white" /> 정형 — PostgreSQL
              </span>
              <span className="flex items-center gap-1.5">
                <Braces className="w-3.5 h-3.5 text-amber-600" />
                <span className="inline-block w-5 h-3 rounded border border-dashed border-amber-400 bg-amber-50" /> 비정형 — Elasticsearch
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#94a3b8" strokeWidth="1.5" /></svg>
                외래키(FK) — 같은 저장소, 참조 무결성 보장
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="#d97706" strokeWidth="2" strokeDasharray="2 4" /></svg>
                공유 키 — 저장소가 달라 FK 없음(formId 값만 일치)
              </span>
            </div>
          </div>

          <div className="w-80 shrink-0 bg-white rounded-xl border border-slate-200 p-5 h-fit sticky top-8">
            {!selectedNode ? (
              <div className="text-sm text-slate-500 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                상자를 클릭하면 해당 엔티티의 설명과 연결된 관계를 볼 수 있습니다.
              </div>
            ) : (
              <div>
                <h2 className="font-bold text-slate-900">{selectedNode.label}</h2>
                <span
                  className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                    selectedNode.store === 'elasticsearch'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {selectedNode.store === 'elasticsearch' ? <Braces className="w-3 h-3" /> : <Database className="w-3 h-3" />}
                  {selectedNode.store === 'elasticsearch' ? '비정형 · Elasticsearch' : '정형 · PostgreSQL'}
                </span>
                <p className="text-sm text-slate-500 mt-2">{selectedNode.description}</p>
                <p className="text-xs text-slate-400 mt-2">현재 {selectedNode.count.toLocaleString()}건 저장됨</p>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">관계 ({selectedRelations.length})</h3>
                  <ul className="space-y-2">
                    {selectedRelations.map((e) => {
                      const isSource = e.from === selectedNode.id;
                      const other = isSource ? e.to : e.from;
                      const otherLabel = nodes.find((n) => n.id === other)?.label ?? other;
                      return (
                        <li key={`${e.from}-${e.to}-${e.field}`} className="text-xs text-slate-600">
                          {isSource ? (
                            <span>
                              <span className="font-mono text-indigo-600">{e.field}</span> → {otherLabel}
                            </span>
                          ) : (
                            <span>
                              {otherLabel} → <span className="font-mono text-indigo-600">{e.field}</span> (이 엔티티 참조)
                            </span>
                          )}
                          <span className="text-slate-400">
                            {' '}· {e.cardinality}{e.optional ? ' · 선택' : ''}
                            {e.linkType === 'shared-key' ? ' · 공유 키(FK 아님)' : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {schemaExample && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Braces className="w-4 h-4 text-amber-600" />
                양식지 → 컬럼 · 키 · 값 구성 (예시: {schemaExample.formTitle})
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                빌더에서 만든 문항 하나하나가 Elasticsearch 문서의 어떤 키로 저장되는지 보여줍니다.
                정형 DB처럼 고정 컬럼이 아니라, <span className="font-mono">data.{'{'}필드 id{'}'}</span>
                {' '}형태로 문항 수만큼 키가 늘어납니다. 아래 값은 모두 자리표시자이며 실제 응답 값이 아닙니다.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold">문항 (라벨)</th>
                      <th className="text-left px-4 py-2 font-semibold">컴포넌트 타입</th>
                      <th className="text-left px-4 py-2 font-semibold">저장 키 (ES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schemaExample.fields.map((f) => (
                      <tr key={f.id}>
                        <td className="px-4 py-2 text-slate-800">{f.label}</td>
                        <td className="px-4 py-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{f.type}</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-mono text-amber-700">{f.esKey}</div>
                          {f.esSubfields.map((s) => (
                            <div key={s} className="text-[10px] text-slate-400 font-mono pl-2">
                              └ {f.esKey}{s}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  실제 저장되는 문서 모양 (key → value)
                </h3>
                <pre className="text-[11px] leading-relaxed p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto">
{JSON.stringify(
  {
    formId: schemaExample.formId,
    submissionId: 'SUB-XXXXXXXX',
    submittedAt: '2026-01-01T00:00:00.000Z',
    respondentId: '(식별 응답만 — 익명이면 없음)',
    campaignId: '(회차 id)',
    data: schemaExample.sampleSubmissionData,
  },
  null,
  2
)}
                </pre>
                <p className="text-[11px] text-slate-400 mt-2">
                  <span className="font-mono">data</span> 바깥의 키(formId·submittedAt 등)는 모든 양식지가
                  공통으로 갖는 고정 필드이고, <span className="font-mono">data</span> 안쪽만 양식지마다
                  달라집니다 — 이것이 이 데이터를 정형 DB가 아니라 Elasticsearch에 두는 이유입니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
