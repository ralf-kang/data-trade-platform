'use client';

import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FormField, FieldType, FormTemplate } from './types';
import {
  Type, AlignLeft, Hash, List,
  CheckSquare, Calendar, Upload, PenTool,
  Image as ImageIcon, Images, Video, Table, FileBox, MessageSquare, Link as LinkIcon,
  Layers, BellOff, ShieldAlert, Database, FileSpreadsheet, Save, ArrowUp, ArrowDown, Trash2,
  Smartphone, Monitor, Globe, Regex, MapPin, Star, GripHorizontal, Sparkles, Plus, X, SlidersHorizontal, Lock, KeyRound, ShieldCheck, Copy
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import AiAutoGenerator from './AiAutoGenerator';
import { buildConsentText, isConsentMetaComplete } from '@/lib/privacyConsentText';

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: '단답형', icon: <Type className="w-4 h-4" /> },
  { type: 'textarea', label: '장문형', icon: <AlignLeft className="w-4 h-4" /> },
  { type: 'number', label: '숫자', icon: <Hash className="w-4 h-4" /> },
  { type: 'select', label: '드롭다운', icon: <List className="w-4 h-4" /> },
  { type: 'radio', label: '단일 선택', icon: <CheckSquare className="w-4 h-4" /> },
  { type: 'checkbox', label: '다중 선택', icon: <CheckSquare className="w-4 h-4" /> },
  { type: 'date', label: '날짜', icon: <Calendar className="w-4 h-4" /> },
  { type: 'file', label: '파일 첨부', icon: <Upload className="w-4 h-4" /> },
  { type: 'signature', label: '서명', icon: <PenTool className="w-4 h-4" /> },
  { type: 'image', label: '단일 이미지', icon: <ImageIcon className="w-4 h-4 text-purple-600" /> },
  { type: 'image-gallery', label: '이미지 갤러리', icon: <Images className="w-4 h-4 text-purple-600" /> },
  { type: 'video-link', label: '동영상 링크', icon: <Video className="w-4 h-4 text-purple-600" /> },
  { type: 'table', label: '표 (Table)', icon: <Table className="w-4 h-4 text-purple-600" /> },
  { type: 'nested-report', label: '하위 레포트', icon: <FileBox className="w-4 h-4 text-purple-600" /> },
  { type: 'report-link', label: '레포트 링크', icon: <LinkIcon className="w-4 h-4 text-purple-600" /> },
  { type: 'comment-thread', label: '댓글 코멘트', icon: <MessageSquare className="w-4 h-4 text-purple-600" /> },
  { type: 'slide-card', label: '슬라이드 카드', icon: <Layers className="w-4 h-4 text-amber-600" /> },
  { type: 'popup-toggle', label: '팝업(자동닫힘)', icon: <BellOff className="w-4 h-4 text-amber-600" /> },
  { type: 'privacy-consent', label: '개인정보 동의서', icon: <ShieldAlert className="w-4 h-6 text-red-600" /> },
  { type: 'api-select', label: 'API 연동 리스트', icon: <Database className="w-4 h-4 text-amber-600" /> },
  { type: 'csv-select', label: 'CSV 붙여넣기', icon: <FileSpreadsheet className="w-4 h-4 text-amber-600" /> },
  { type: 'regex-input', label: '정규식 검증 입력', icon: <Regex className="w-4 h-4 text-blue-600" /> },
  { type: 'map-address', label: '주소 및 지도', icon: <MapPin className="w-4 h-4 text-green-600" /> },
];

const OPTIONS_TYPES: FieldType[] = ['select', 'radio', 'checkbox'];

export default function FormBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');

  const [template, setTemplate] = useState<Partial<FormTemplate>>({
    title: '',
    description: '',
    fields: [],
  });
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  // 확정(PUBLISHED) 상태 정보 — 확정된 양식지의 필드를 수정·저장하면 외부 연동 계약
  // (스키마 버전)이 바뀐다는 것을 편집자에게 알려주기 위해 함께 불러온다.
  const [lifecycle, setLifecycle] = useState<'DRAFT' | 'PUBLISHED' | null>(null);
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  // 응답자 신원 요구 수준 — 동의서 게이트와 얽혀 있어(§동의서 게이트) 별도로 관리한다.
  const [identityMode, setIdentityMode] = useState<'ANONYMOUS' | 'IDENTIFIED' | 'AUTHENTICATED' | 'MIXED'>('ANONYMOUS');
  // 조합 위험 경고를 이미 확인했는지 — 값이 있으면 다시 경고하지 않는다.
  const [privacyWarningAck, setPrivacyWarningAck] = useState<string | null>(null);
  // 개인정보 취급자(제작 자격) — 미승인이면 동의서 컴포넌트를 팔레트에서 잠근다.
  const [authorAuthStatus, setAuthorAuthStatus] = useState<'PENDING' | 'APPROVED' | 'SUSPENDED' | 'EXPIRED' | 'REVOKED' | 'NONE'>('NONE');
  // 비슷한 양식지 추천(§군집 기반 제안 — "제작자에게" 항목). 신규 작성 중일 때만 의미가
  // 있다 — 이미 있는 양식을 수정 중이면 "비슷한 게 있다"는 안내 자체가 무의미하다.
  const [similarForms, setSimilarForms] = useState<Array<{ formId: string; title: string; description: string; fieldCount: number }>>([]);
  const [similarFormsDismissed, setSimilarFormsDismissed] = useState(false);

  // 개인정보 취급자 자격은 편집 대상 양식과 무관하게 "지금 로그인한 사람"의 상태다.
  useEffect(() => {
    fetch('/api/me/author-authorization')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setAuthorAuthStatus(json?.authorization?.status ?? 'NONE'))
      .catch(() => setAuthorAuthStatus('NONE'));
  }, []);

  // 기존 양식 편집 시, 서버 API(Postgres 운영 메타데이터 + Elasticsearch 필드 구성)에서
  // 실제 데이터를 불러온다. id가 없으면(신규 작성) 빈 양식에서 시작한다.
  useEffect(() => {
    if (!id) return; // loading 초기값이 이미 false이므로(useState(!!id)) 별도 처리 불필요
    let cancelled = false;
    fetch(`/api/forms/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.form) return;
        const { form } = json;
        setTemplate({ id: form.id, title: form.title, description: form.description, fields: form.fields });
        setLifecycle(form.lifecycle ?? null);
        setSchemaVersion(form.schemaVersion ?? null);
        setIdentityMode(form.identityMode ?? 'ANONYMOUS');
        setPrivacyWarningAck(form.privacyWarningAck ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 비슷한 양식지 추천 — 신규 작성 중, 제목을 어느 정도 입력했을 때만 조회한다.
  // 이미 있는 양식을 열어 수정하는 중이면(id 존재) 자기 자신과 비교할 이유가 없다.
  useEffect(() => {
    if (id) return;
    const title = template.title?.trim() ?? '';
    if (title.length < 2) {
      setSimilarForms([]);
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ title });
      fetch(`/api/forms/similar?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : { suggestions: [] }))
        .then((json) => setSimilarForms(json.suggestions ?? []))
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [id, template.title]);

  const fields = template.fields || [];
  const setFields = (newFields: FormField[]) => setTemplate(prev => ({ ...prev, fields: newFields }));

  // Preview Modal State
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'pc' | 'hybrid'>('hybrid');

  // AI 자동 생성기 — 항상 펼쳐 보이지 않고, 좌측 툴박스의 아이콘을 눌렀을 때만 모달로 노출.
  const [showAiGenerator, setShowAiGenerator] = useState(false);

  // Bulk Selection State
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  // 우측 상세 옵션 패널에서 편집 중인 필드 (단일 선택) — 캔버스에는 필수 항목(타입/이름/필수
  // 여부)만 남기고, 그 외 세부 설정은 여기서만 다룬다.
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const activeField = fields.find((f) => f.id === activeFieldId) ?? null;

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: uuidv4(),
      type,
      label: '새 항목',
      required: false,
      nullable: true,
      width: '100%',
      options: OPTIONS_TYPES.includes(type) ? ['옵션 1', '옵션 2'] : undefined,
    };
    setFields([...fields, newField]);
    setActiveFieldId(newField.id);
  };

  const addFavoriteBlock = () => {
    // 예제: 인적사항 세트 (이름, 연락처, 주소)
    const block: FormField[] = [
      { id: uuidv4(), type: 'text', label: '성명', required: true, width: '50%' },
      { id: uuidv4(), type: 'regex-input', label: '휴대폰 번호', required: true, regexPattern: '^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$', width: '50%' },
      { id: uuidv4(), type: 'map-address', label: '거주지 주소', required: true, width: '100%' },
    ];
    setFields([...fields, ...block]);
  };

  const toggleSelection = (id: string, multi: boolean) => {
    const newSet = new Set(multi ? selectedFields : []);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFields(newSet);
  };

  const selectAll = () => {
    if (selectedFields.size === fields.length) {
      setSelectedFields(new Set());
    } else {
      setSelectedFields(new Set(fields.map(f => f.id)));
    }
  };

  const handleBulkAction = (action: 'require' | 'optional' | 'delete') => {
    if (selectedFields.size === 0) return;

    if (action === 'delete') {
      if(confirm(`선택한 ${selectedFields.size}개 필드를 정말 삭제하시겠습니까?`)) {
        setFields(fields.filter(f => !selectedFields.has(f.id)));
        if (activeFieldId && selectedFields.has(activeFieldId)) setActiveFieldId(null);
        setSelectedFields(new Set());
      }
      return;
    }

    setFields(fields.map(field => {
      if (selectedFields.has(field.id)) {
        if (action === 'require') return { ...field, required: true, nullable: false };
        if (action === 'optional') return { ...field, required: false, nullable: true };
      }
      return field;
    }));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (activeFieldId === id) setActiveFieldId(null);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    if (direction === 'up' && index > 0) {
      [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    } else if (direction === 'down' && index < newFields.length - 1) {
      [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];
    }
    setFields(newFields);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // 조합 위험 감지 — 응답이 없는 설계 시점이라 실제 k=1은 계산할 수 없으므로,
  // "노출되는 준식별자 후보가 2개 이상"이라는 보수적인 신호만 쓴다. 정밀 판정은
  // 응답이 쌓인 뒤 사후 진단(privacy-risk API)이 담당한다.
  const RISK_ELIGIBLE_TYPES: FieldType[] = ['select', 'radio', 'checkbox', 'number', 'date'];
  const hasCombinationRisk = fields.filter(
    (f) => !f.anonymous && RISK_ELIGIBLE_TYPES.includes(f.type)
  ).length >= 2;

  const [showRiskModal, setShowRiskModal] = useState(false);
  const [riskReason, setRiskReason] = useState('');

  const doSave = async (ackReason?: string) => {
    setSaving(true);
    try {
      const payload = {
        title: template.title,
        description: template.description || '',
        fields: template.fields || [],
      };
      const res = await fetch(template.id ? `/api/forms/${template.id}` : '/api/forms', {
        method: template.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.message ?? '저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      const { form } = await res.json();

      // 방금 생성/수정된 양식 id로 조합 위험 확인 사유를 남긴다 — 신규 양식은
      // POST가 끝나야 id가 생기므로, 사유 기록은 저장 완료 이후에만 가능하다.
      if (ackReason) {
        await fetch(`/api/forms/${form.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ privacyWarningAck: ackReason }),
        }).catch(() => undefined);
      }

      setTemplate({ id: form.id, title: form.title, description: form.description, fields: form.fields });
      setLifecycle(form.lifecycle ?? null);
      setSchemaVersion(form.schemaVersion ?? null);
      setPrivacyWarningAck(ackReason ?? form.privacyWarningAck ?? null);
      alert('저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!template.title?.trim()) {
      alert('보고서 제목을 입력해주세요.');
      return;
    }
    // 위험 신호가 있고 아직 사유를 남긴 적 없으면 저장 대신 경고를 먼저 띄운다.
    // 진행을 막지는 않는다 — 대신 왜 진행했는지 사유를 남겨 나중의 판단 근거로 쓴다.
    if (hasCombinationRisk && !privacyWarningAck) {
      setRiskReason('');
      setShowRiskModal(true);
      return;
    }
    doSave();
  };

  const handleConfirmRisk = () => {
    if (!riskReason.trim()) {
      alert('진행 사유를 입력해주세요.');
      return;
    }
    setShowRiskModal(false);
    doSave(riskReason.trim());
  };

  const handleIdentityModeChange = async (next: typeof identityMode) => {
    if (!template.id) {
      // 신규(미저장) 양식은 registry 자체가 없어 PATCH 대상이 없다. 먼저 저장하도록 안내한다.
      alert('신원 요구 수준은 양식을 먼저 저장한 뒤 설정할 수 있습니다.');
      return;
    }
    const res = await fetch(`/api/forms/${template.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityMode: next }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.message ?? '변경에 실패했습니다.');
      return;
    }
    setIdentityMode(next);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-500">
        양식을 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar: Toolbox */}
      <div className="w-64 bg-white border-r p-4 overflow-y-auto shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">양식 도구</h2>
          <button
            onClick={() => setShowAiGenerator(true)}
            className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm hover:opacity-90 transition-opacity"
            title="AI 양식 자동 생성기"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {FIELD_TYPES.map((ft) => {
            // 동의서 컴포넌트만 대상 — 파일·이미지·서명 등은 제외(확정 사항).
            // 미승인자에게는 팔레트에서 잠그고 권한 신청을 안내한다. 이 잠금은 UX
            // 편의이지 유일한 방어선이 아니다 — 우회되더라도 마스킹 계층이 실제
            // 데이터를 가린다.
            const locked = ft.type === 'privacy-consent' && authorAuthStatus !== 'APPROVED';
            return (
              <button
                key={ft.type}
                onClick={() => {
                  if (!locked) { addField(ft.type); return; }
                  if (confirm('개인정보 취급자 자격이 필요한 컴포넌트입니다.\n지금 마이페이지에서 자격을 신청하시겠습니까?')) {
                    router.push('/me/author-authorization');
                  }
                }}
                className={`relative flex flex-col items-center justify-center p-3 border rounded transition-colors ${
                  locked
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'hover:bg-blue-50 hover:border-blue-300 bg-gray-50 text-gray-700'
                }`}
                title={locked ? '개인정보 취급자 자격 필요' : undefined}
              >
                {locked && <Lock className="w-3 h-3 absolute top-1.5 right-1.5 text-gray-400" />}
                {ft.icon}
                <span className="text-xs mt-2">{ft.label}</span>
              </button>
            );
          })}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">즐겨찾기 블록 / 추천</h3>
          <button
            onClick={addFavoriteBlock}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 p-3 rounded-lg transition-colors"
          >
            <Star className="w-4 h-4" />
            <span className="font-medium text-sm">인적사항 세트 (이름+연락처+주소) 추가</span>
          </button>
        </div>
      </div>

      {/* Main Content - Canvas */}
      <div className="flex-1 bg-gray-100 overflow-y-auto p-8 relative">
        {/* Bulk Action Bar (Floating) */}
        {selectedFields.size > 0 && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-full shadow-2xl z-40 flex items-center space-x-6">
            <span className="font-bold">{selectedFields.size}개 선택됨</span>
            <div className="flex space-x-3 border-l border-gray-700 pl-6">
              <button onClick={() => handleBulkAction('require')} className="text-sm font-medium hover:text-blue-300">모두 필수로 변경</button>
              <button onClick={() => handleBulkAction('optional')} className="text-sm font-medium hover:text-gray-300">모두 선택(Null)으로 변경</button>
              <button onClick={() => handleBulkAction('delete')} className="text-sm font-medium text-red-400 hover:text-red-300 border-l border-gray-700 pl-3">일괄 삭제</button>
            </div>
            <button onClick={() => setSelectedFields(new Set())} className="ml-4 text-gray-400 hover:text-white">✕</button>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 min-h-[600px] p-8">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">보고서 양식 편집기</h1>
                {lifecycle && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    lifecycle === 'PUBLISHED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {lifecycle === 'PUBLISHED' ? `확정됨 · 스키마 v${schemaVersion}` : '초안 (미확정)'}
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                {template.id && (
                  <a href={`/admin/forms/${template.id}/api`} className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors">
                    <Database className="w-4 h-4" />
                    <span>API 연동</span>
                  </a>
                )}
                <button onClick={() => setShowPreview(true)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors">
                  <Globe className="w-4 h-4" />
                  <span>배포 사전 확인</span>
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  <span>{saving ? '저장 중...' : '양식 저장'}</span>
                </button>
              </div>
            </div>

            {/* 확정된 양식지 수정 시 계약 변경 경고 */}
            {lifecycle === 'PUBLISHED' && (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                이 양식지는 <strong>확정(PUBLISHED)</strong>되어 외부 시스템이 연동 중일 수 있습니다.
                필드를 수정해 저장하면 <strong>스키마 버전이 v{schemaVersion} → v{(schemaVersion ?? 1) + 1}</strong>로 올라가며,
                연동 측 매핑 점검이 필요할 수 있습니다.
              </div>
            )}

            <div className="space-y-4 mb-8">
              <input type="text" placeholder="보고서 제목" className="w-full text-3xl font-bold border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 outline-none" value={template.title} onChange={(e) => setTemplate({ ...template, title: e.target.value })} />
              <textarea placeholder="보고서 설명" className="w-full text-gray-600 border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 outline-none resize-none" value={template.description} onChange={(e) => setTemplate({ ...template, description: e.target.value })} rows={2} />

              {!id && !similarFormsDismissed && similarForms.length > 0 && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 text-indigo-800">
                      <Copy className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="font-medium">비슷한 양식지가 이미 있습니다. 새로 만들기 전에 확인해보세요.</span>
                    </div>
                    <button
                      onClick={() => setSimilarFormsDismissed(true)}
                      className="text-indigo-400 hover:text-indigo-600 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {similarForms.map((f) => (
                      <li key={f.formId}>
                        <a
                          href={`/admin/builder?id=${f.formId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-700 hover:underline"
                        >
                          {f.title}
                        </a>
                        <span className="text-indigo-400 text-xs ml-1.5">
                          ({f.fieldCount}개 문항){f.description ? ` — ${f.description}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <label className="text-xs font-bold text-gray-500 uppercase shrink-0">응답자 신원 요구</label>
                <select
                  value={identityMode}
                  onChange={(e) => handleIdentityModeChange(e.target.value as typeof identityMode)}
                  className="text-sm p-1.5 border rounded bg-white"
                >
                  <option value="ANONYMOUS">익명 — 신원 수집 안 함</option>
                  <option value="IDENTIFIED">식별 — 개인화 링크 필수</option>
                  <option value="AUTHENTICATED">인증 — 로그인 필수</option>
                  <option value="MIXED">혼합 — 링크 있으면 식별, 없으면 익명</option>
                </select>
                {identityMode !== 'ANONYMOUS' && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> 개인정보 동의서 컴포넌트가 반드시 포함되어야 합니다
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mt-8">
              <h2 className="text-lg font-bold text-gray-800">입력 항목 구성</h2>
              <button onClick={selectAll} className="text-sm text-indigo-600 hover:underline">
                {selectedFields.size === fields.length && fields.length > 0 ? '전체 선택 해제' : '전체 선택'}
              </button>
            </div>

            {/* 캔버스에는 필수 항목(타입/이름/필수 여부)만 표시하고, 그 외 세부 설정은
                오른쪽 패널에서 다룬다 — 목록이 길어져도 한눈에 훑어보기 쉽게 하기 위함. */}
            <div className="flex flex-wrap -mx-2 mt-4">
              {fields.map((field, index) => {
                const isSelected = selectedFields.has(field.id);
                const isActive = activeFieldId === field.id;
                const fieldTypeInfo = FIELD_TYPES.find(t => t.type === field.type);
                return (
                  <div key={field.id} className={`p-2 transition-all duration-200 ${field.width === '50%' ? 'w-1/2' : 'w-full'}`}>
                    <div
                      onClick={() => setActiveFieldId(field.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer shadow-sm relative group ${
                        isActive ? 'border-blue-500 bg-blue-50/40' : isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <input type="checkbox" onClick={(e) => e.stopPropagation()} className="w-5 h-5 text-indigo-600 rounded border-gray-300 cursor-pointer" checked={isSelected} onChange={() => toggleSelection(field.id, true)} />
                      </div>
                      <div className="absolute top-3 right-24 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripHorizontal className="w-5 h-5" />
                      </div>

                      <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }} className="p-1 text-gray-500 hover:text-blue-600 bg-white rounded shadow-sm" disabled={index === 0}><ArrowUp className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }} className="p-1 text-gray-500 hover:text-blue-600 bg-white rounded shadow-sm" disabled={index === fields.length - 1}><ArrowDown className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeField(field.id); }} className="p-1 text-gray-500 hover:text-red-600 bg-white rounded shadow-sm"><Trash2 className="w-4 h-4" /></button>
                      </div>

                      {/* 컴포넌트 타입 명시 배지 — 항목 이름을 자유롭게 바꿔도 이 필드가 어떤
                          컴포넌트(23종 중 무엇)인지 항상 한눈에 식별할 수 있도록 표시한다. */}
                      <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-600 mb-3">
                        {fieldTypeInfo?.icon}
                        <span className="text-xs font-bold">{fieldTypeInfo?.label ?? field.type}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({field.type})</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={field.label}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          className="flex-1 p-2 border rounded font-medium"
                          placeholder="항목 이름"
                        />
                        <label onClick={(e) => e.stopPropagation()} className="flex items-center space-x-1.5 shrink-0 text-sm text-gray-600">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked, nullable: !e.target.checked })} />
                          <span>필수</span>
                        </label>
                        <span className={`shrink-0 flex items-center text-xs font-bold ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                          <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> 상세설정
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {fields.length === 0 && (
                <div className="w-full p-12 text-center text-gray-400 border-2 border-dashed rounded-lg">
                  왼쪽 도구에서 컴포넌트를 선택해 양식을 구성하세요.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: 선택된 필드의 상세 옵션 */}
      <div className="w-80 bg-white border-l overflow-y-auto shrink-0">
        {activeField ? (
          <FieldDetailPanel
            key={activeField.id}
            field={activeField}
            onChange={(updates) => updateField(activeField.id, updates)}
            onClose={() => setActiveFieldId(null)}
            anonymityLocked={lifecycle === 'PUBLISHED'}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
            <SlidersHorizontal className="w-8 h-8 mb-3" />
            <p className="text-sm font-medium">필드를 선택하면</p>
            <p className="text-sm font-medium">상세 옵션을 편집할 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* 조합 위험 경고 모달 — 진행을 막지 않되 사유를 남긴다 */}
      {showRiskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center mb-3">
              <ShieldAlert className="w-6 h-6 text-amber-600 mr-2" />
              <h2 className="text-lg font-bold text-gray-900">식별 가능한 조합이 감지되었습니다</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              선택지·숫자·날짜 항목이 2개 이상 있습니다. 개별로는 무해해 보여도 여러 항목을
              조합하면 특정 인물이 좁혀질 수 있습니다(예: 부서 + 직급 + 입사년도).
              그래도 진행하시려면 사유를 남겨주세요 — 응답이 쌓인 뒤 실제로 유일한 조합이
              나오면 해당 레코드는 자동으로 비공개 처리됩니다.
            </p>
            <textarea
              value={riskReason}
              onChange={(e) => setRiskReason(e.target.value)}
              placeholder="예: 부서 단위 통계만 필요하며 개인 식별 목적이 아님"
              rows={3}
              className="w-full p-3 border rounded-lg text-sm mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRiskModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                취소
              </button>
              <button onClick={handleConfirmRisk} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700">
                확인하고 이대로 진행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 양식 자동 생성기 모달 */}
      {showAiGenerator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-transparent w-full max-w-2xl relative">
            <button onClick={() => setShowAiGenerator(false)} className="absolute -top-10 right-0 text-white hover:text-gray-300">✕ 닫기</button>
            <AiAutoGenerator onGenerated={(newFields) => { setFields([...fields, ...newFields]); setShowAiGenerator(false); }} />
          </div>
        </div>
      )}

      {/* Deployment Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl flex flex-col h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">배포 전 사전 확인 (디바이스 프리뷰)</h2>
                <p className="text-sm text-gray-500 mt-1">사용자들이 이 폼을 주로 어떤 기기에서 입력하나요?</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-64 border-r border-gray-200 p-6 flex flex-col space-y-4 bg-gray-50">
                <h3 className="font-semibold text-gray-700">타겟 디바이스 선택</h3>
                <button
                  onClick={() => setPreviewMode('mobile')}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${previewMode === 'mobile' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white hover:bg-gray-100'}`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span className="font-medium">모바일 폰 주력</span>
                </button>
                <button
                  onClick={() => setPreviewMode('pc')}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${previewMode === 'pc' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white hover:bg-gray-100'}`}
                >
                  <Monitor className="w-5 h-5" />
                  <span className="font-medium">PC 화면 주력</span>
                </button>
                <button
                  onClick={() => setPreviewMode('hybrid')}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${previewMode === 'hybrid' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white hover:bg-gray-100'}`}
                >
                  <Globe className="w-5 h-5" />
                  <span className="font-medium">둘 다 대응 (반응형)</span>
                </button>

                <div className="mt-auto pt-6">
                  <button
                    onClick={() => { setShowPreview(false); handleSave(); }}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm"
                  >
                    이 설정으로 최종 배포
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-gray-200 flex items-center justify-center p-8 overflow-y-auto">
                {/* Simulated Device Frame */}
                <div
                  className={`bg-white shadow-2xl overflow-y-auto transition-all duration-300 ${
                    previewMode === 'mobile' ? 'w-[375px] h-[812px] rounded-[2.5rem] border-[8px] border-gray-900 p-6' :
                    previewMode === 'pc' ? 'w-full max-w-4xl h-full rounded-lg border border-gray-300 p-10' :
                    'w-full max-w-2xl h-[90%] rounded-xl border border-gray-300 p-8'
                  }`}
                >
                  <h1 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b">{template.title}</h1>
                  {fields.length === 0 ? (
                    <div className="text-center text-gray-400 py-20">양식 내용이 없습니다.</div>
                  ) : (
                    <div className="flex flex-wrap -mx-2">
                      {fields.map(field => (
                        <div key={field.id} className={`p-2 ${previewMode === 'mobile' ? 'w-full' : (field.width === '50%' ? 'w-1/2' : 'w-full')}`}>
                          <div className="flex flex-col space-y-2">
                            <label className="font-medium text-gray-700">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <div className="p-3 border border-gray-200 rounded-md bg-gray-50 text-gray-400 text-sm">
                              {FIELD_TYPES.find(t => t.type === field.type)?.label} 입력란
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 개인정보 동의서(privacy-consent) 전용 설정 — 법정 필수 고지 항목을 구조화된
// 값으로 입력받고, 실제 응답자에게 보여줄 문구를 실시간으로 미리보기한다.
// ---------------------------------------------------------------------------
function PrivacyConsentSettings({
  field,
  onChange,
}: {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
}) {
  const meta = field.consentMeta;
  const [showThirdParty, setShowThirdParty] = useState(!!meta?.thirdParty);

  const updateMeta = (patch: Partial<NonNullable<FormField['consentMeta']>>) => {
    onChange({
      consentMeta: {
        purpose: meta?.purpose ?? '',
        items: meta?.items ?? '',
        retentionPeriod: meta?.retentionPeriod ?? '',
        refusalConsequence: meta?.refusalConsequence,
        thirdParty: meta?.thirdParty,
        ...patch,
      },
    });
  };

  const updateThirdParty = (patch: Partial<NonNullable<NonNullable<FormField['consentMeta']>['thirdParty']>>) => {
    updateMeta({
      thirdParty: {
        recipient: meta?.thirdParty?.recipient ?? '',
        purpose: meta?.thirdParty?.purpose ?? '',
        items: meta?.thirdParty?.items ?? '',
        retentionPeriod: meta?.thirdParty?.retentionPeriod ?? '',
        ...patch,
      },
    });
  };

  const complete = isConsentMetaComplete(meta);

  return (
    <div className="space-y-3 p-3 border border-amber-200 bg-amber-50 rounded">
      <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-amber-600" />
        <span>개인정보 수집·이용 동의 법정 고지 항목</span>
      </label>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        「개인정보 보호법」 제15조가 요구하는 필수 고지 항목입니다. 아래 입력값으로 응답 화면에 보여줄 동의서 문구가 자동으로 조립됩니다.
      </p>

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">수집·이용 목적 *</label>
        <input
          type="text"
          value={meta?.purpose ?? ''}
          onChange={(e) => updateMeta({ purpose: e.target.value })}
          className="w-full p-2 border rounded text-sm"
          placeholder="예: 설문 응답 접수 및 결과 분석"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">수집 항목 *</label>
        <input
          type="text"
          value={meta?.items ?? ''}
          onChange={(e) => updateMeta({ items: e.target.value })}
          className="w-full p-2 border rounded text-sm"
          placeholder="예: 성명, 소속, 연락처"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">보유 및 이용 기간 *</label>
        <input
          type="text"
          value={meta?.retentionPeriod ?? ''}
          onChange={(e) => updateMeta({ retentionPeriod: e.target.value })}
          className="w-full p-2 border rounded text-sm"
          placeholder="예: 수집일로부터 1년"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">동의 거부 시 안내 문구 (선택)</label>
        <textarea
          value={meta?.refusalConsequence ?? ''}
          onChange={(e) => updateMeta({ refusalConsequence: e.target.value || undefined })}
          className="w-full p-2 border rounded text-sm"
          rows={2}
          placeholder="동의를 거부할 권리가 있으며, 동의 거부 시 관련 서비스 이용에 제한이 있을 수 있습니다."
        />
      </div>

      <div className="pt-1 border-t border-amber-200">
        <button
          type="button"
          onClick={() => {
            const next = !showThirdParty;
            setShowThirdParty(next);
            if (!next) updateMeta({ thirdParty: undefined });
          }}
          className="text-xs font-medium text-amber-700 hover:text-amber-900"
        >
          {showThirdParty ? '− 제3자 제공 동의 항목 제거' : '+ 제3자 제공 동의 항목 추가 (해당 시)'}
        </button>

        {showThirdParty && (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              value={meta?.thirdParty?.recipient ?? ''}
              onChange={(e) => updateThirdParty({ recipient: e.target.value })}
              className="w-full p-2 border rounded text-sm"
              placeholder="제공받는 자 (예: 협력업체 OOO)"
            />
            <input
              type="text"
              value={meta?.thirdParty?.purpose ?? ''}
              onChange={(e) => updateThirdParty({ purpose: e.target.value })}
              className="w-full p-2 border rounded text-sm"
              placeholder="제공 목적"
            />
            <input
              type="text"
              value={meta?.thirdParty?.items ?? ''}
              onChange={(e) => updateThirdParty({ items: e.target.value })}
              className="w-full p-2 border rounded text-sm"
              placeholder="제공 항목"
            />
            <input
              type="text"
              value={meta?.thirdParty?.retentionPeriod ?? ''}
              onChange={(e) => updateThirdParty({ retentionPeriod: e.target.value })}
              className="w-full p-2 border rounded text-sm"
              placeholder="보유 및 이용 기간"
            />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-semibold text-gray-500 uppercase">응답자 화면 미리보기</label>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${complete ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {complete ? '필수 항목 입력 완료' : '필수 항목 미입력'}
          </span>
        </div>
        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed p-2.5 bg-white border rounded text-gray-700 font-sans">
          {buildConsentText(meta)}
        </pre>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 우측 상세 옵션 패널 — 캔버스에서 다루지 않는 필드별 세부 설정을 모아 편집한다.
// ---------------------------------------------------------------------------
function FieldDetailPanel({
  field,
  onChange,
  onClose,
  anonymityLocked,
}: {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
  onClose: () => void;
  /** 확정된 양식지에서는 익명 설정을 바꿀 수 없다 — 응답자와의 약속이기 때문. */
  anonymityLocked: boolean;
}) {
  const fieldTypeInfo = FIELD_TYPES.find((t) => t.type === field.type);

  const updateOption = (index: number, value: string) => {
    const next = [...(field.options || [])];
    next[index] = value;
    onChange({ options: next });
  };
  const addOption = () => onChange({ options: [...(field.options || []), `옵션 ${(field.options?.length ?? 0) + 1}`] });
  const removeOption = (index: number) => onChange({ options: (field.options || []).filter((_, i) => i !== index) });

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center space-x-2">
          {fieldTypeInfo?.icon}
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{fieldTypeInfo?.label}</h3>
            <p className="text-[10px] text-gray-400 font-mono">{field.type}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">설명 (선택)</label>
        <input
          type="text"
          value={field.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full p-2 border rounded text-sm"
          placeholder="응답자에게 보여줄 부가 설명"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">레이아웃 너비</label>
        <div className="flex space-x-2">
          <button onClick={() => onChange({ width: '100%' })} className={`flex-1 px-2 py-1.5 text-xs rounded border ${field.width === '100%' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'text-gray-600'}`}>100%</button>
          <button onClick={() => onChange({ width: '50%' })} className={`flex-1 px-2 py-1.5 text-xs rounded border ${field.width === '50%' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'text-gray-600'}`}>50%</button>
        </div>
      </div>

      {OPTIONS_TYPES.includes(field.type) && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">선택지 옵션</label>
          <div className="space-y-2">
            {(field.options || []).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  className="flex-1 p-1.5 border rounded text-sm"
                />
                <button onClick={() => removeOption(idx)} className="p-1.5 text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <button onClick={addOption} className="mt-2 w-full flex items-center justify-center py-1.5 border border-dashed rounded text-xs text-indigo-600 hover:bg-indigo-50">
            <Plus className="w-3.5 h-3.5 mr-1" /> 옵션 추가
          </button>
        </div>
      )}

      {field.type === 'regex-input' && (
        <div className="space-y-2 p-3 border border-blue-100 bg-blue-50 rounded">
          <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <Regex className="w-4 h-4 text-blue-600" />
            <span>정규식(Regex) 검증 패턴</span>
          </label>
          <select
            className="w-full p-2 border border-gray-300 rounded text-sm"
            value={field.regexPattern || ''}
            onChange={(e) => onChange({ regexPattern: e.target.value })}
          >
            <option value="">패턴 선택 (자유 입력)</option>
            <option value="^01(?:0|1|[6-9])-(?:\d{3}|\d{4})-\d{4}$">휴대폰 번호 (010-XXXX-XXXX)</option>
            <option value="^\d{2}[0-1]\d[0-3]\d-[1-4]\d{6}$">주민등록번호 (YYYYYY-XXXXXXX)</option>
            <option value="^\d{3}-\d{2}-\d{5}$">사업자등록번호 (XXX-XX-XXXXX)</option>
            <option value="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$">이메일 주소</option>
          </select>
        </div>
      )}

      {field.type === 'map-address' && (
        <div className="space-y-3 p-3 bg-green-50 border border-green-200 rounded">
          <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-green-600" />
            <span>주소 검색 설정</span>
          </label>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            응답자가 검색으로 주소를 선택하면 우편번호·도로명·법정동코드가 자동으로 채워지고 읽기
            전용이 됩니다. 상세주소만 직접 입력합니다.
          </p>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!!field.addressOptions?.requireDetail}
              onChange={(e) =>
                onChange({ addressOptions: { ...field.addressOptions, requireDetail: e.target.checked } })
              }
            />
            <span className="text-xs text-gray-700">상세주소(동/호수)를 필수로 입력받기</span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-green-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!!field.addressOptions?.mapEnabled}
              onChange={(e) =>
                onChange({ addressOptions: { ...field.addressOptions, mapEnabled: e.target.checked } })
              }
            />
            <span className="text-xs text-gray-700">
              <strong>지도 분포 분석 대상으로 사용</strong>
              <span className="block text-[11px] text-gray-500 mt-0.5">
                켜면 관리자 화면에서 이 문항의 주소 분포를 지도로 볼 수 있습니다. 개인이 특정되지
                않도록 최소 응답 수 미만인 지역은 표시되지 않습니다. 기본값은 꺼짐입니다.
              </span>
            </span>
          </label>
        </div>
      )}

      {field.type === 'api-select' && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">외부 연동 API 엔드포인트</label>
          <input
            type="text"
            value={field.apiEndpoint || ''}
            onChange={(e) => onChange({ apiEndpoint: e.target.value })}
            className="w-full p-2 border rounded text-sm font-mono"
            placeholder="https://api.company.com/v1/employees"
          />
        </div>
      )}

      {field.type === 'popup-toggle' && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">자동 닫힘 시간(초)</label>
          <input
            type="number"
            min={1}
            value={field.autoDismissSeconds ?? ''}
            onChange={(e) => onChange({ autoDismissSeconds: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full p-2 border rounded text-sm"
            placeholder="5"
          />
        </div>
      )}

      {field.type === 'privacy-consent' && (
        <PrivacyConsentSettings field={field} onChange={onChange} />
      )}

      {field.type === 'text' && (
        <div className="space-y-2 p-3 border border-indigo-100 bg-indigo-50 rounded">
          <label className="text-sm font-medium text-gray-700 flex items-center space-x-2">
            <KeyRound className="w-4 h-4 text-indigo-600" />
            <span>LDAP/인사시스템 자동 채움</span>
          </label>
          <select
            className="w-full p-2 border border-gray-300 rounded text-sm"
            value={field.ldapAttribute ?? ''}
            onChange={(e) => onChange({ ldapAttribute: (e.target.value || undefined) as FormField['ldapAttribute'] })}
          >
            <option value="">사용 안 함 (직접 입력)</option>
            <option value="name">이름</option>
            <option value="employeeNo">사번</option>
            <option value="department">부서</option>
            <option value="position">직급</option>
            <option value="email">이메일</option>
          </select>
          {field.ldapAttribute && (
            <p className="text-[11px] text-indigo-700 leading-relaxed">
              응답자가 LDAP 계정으로 신원이 확인되면 이 항목은 인사시스템 값으로 자동 채워지고 읽기
              전용으로 바뀝니다. 로컬 계정이거나 신원이 확인되지 않으면 평소처럼 직접 입력합니다.
            </p>
          )}
        </div>
      )}

      {/* 반복 수집 시 이전 회차 값 처리(3단계). 익명 문항은 지난 값을 찾을 수 없어 제외된다. */}
      {!field.anonymous && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">반복 수집 시 이전 값</label>
          <select
            className="w-full p-2 border rounded text-sm bg-white"
            value={field.prefillPolicy ?? 'clear'}
            onChange={(e) => onChange({ prefillPolicy: e.target.value as FormField['prefillPolicy'] })}
          >
            <option value="clear">매번 새로 입력 (기본)</option>
            <option value="carry-over">지난 값 그대로 채우기</option>
            <option value="carry-with-confirm">채우되 확인 체크 필수</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">
            {field.prefillPolicy === 'carry-over'
              ? '부서·직급처럼 잘 바뀌지 않는 항목에 적합합니다.'
              : field.prefillPolicy === 'carry-with-confirm'
                ? '응답자가 확인 체크를 해야 제출됩니다. 자격증 만료일처럼 무심코 넘기면 안 되는 항목에 쓰세요.'
                : '실적·의견처럼 매번 달라야 하는 항목은 이 설정을 유지하세요.'}
          </p>
        </div>
      )}

      {/* 문항 단위 익명성 — 마스킹과는 전혀 다른 장치라 별도 블록으로 둔다.
          마스킹은 "화면에서 가리기"지만, 익명은 "응답자와의 연결 자체를 만들지 않기"다. */}
      <div className={`p-3 rounded border ${field.anonymous ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <label className={`flex items-start gap-2 text-sm ${anonymityLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${field.anonymous ? 'text-slate-100' : 'text-slate-700'}`}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={!!field.anonymous}
            disabled={anonymityLocked}
            onChange={(e) => onChange({ anonymous: e.target.checked })}
          />
          <span>
            <span className="font-bold flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> 익명 문항으로 저장
            </span>
            <span className={`block text-xs mt-1 ${field.anonymous ? 'text-slate-300' : 'text-slate-500'}`}>
              응답자와 연결되지 않게 분리 저장합니다. 제작자·관리자 모두 개별 응답을 볼 수 없고
              집계만 조회할 수 있으며, 응답자 본인도 제출 후 수정·삭제할 수 없습니다.
            </span>
          </span>
        </label>
        {anonymityLocked && (
          <p className="mt-2 text-xs text-amber-600">
            ⚠ 확정된 양식지는 익명 설정을 바꿀 수 없습니다. 이미 응답한 분들과의 약속이기 때문입니다.
          </p>
        )}
        {field.anonymous && !anonymityLocked && (
          <p className="mt-2 text-xs text-amber-500">
            ⚠ 확정(배포) 이후에는 이 설정을 되돌릴 수 없습니다.
          </p>
        )}
      </div>

      <div className="p-3 bg-gray-50 border border-gray-200 rounded">
        <label className="flex items-center space-x-2 text-sm text-gray-700">
          <input type="checkbox" checked={!!field.privacyMasking} onChange={(e) => onChange({ privacyMasking: e.target.checked })} />
          <span>비식별화(마스킹) 처리 — 데이터 뷰어에서 이 항목을 마스킹해 표시</span>
        </label>
      </div>

      {/* 양식지 관계(온톨로지) 캔버스에서 쓰는 태그 — 시스템이 값 포맷으로 추론하지 않고
          제작자가 직접 표시한 것만 개인식별자로 취급한다 (§5-3). */}
      <div className="p-3 bg-gray-50 border border-gray-200 rounded">
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={!!field.personalIdentifier}
            onChange={(e) => onChange({ personalIdentifier: e.target.checked })}
          />
          <span>
            <span className="font-bold flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" /> 개인식별자로 표시
            </span>
            <span className="block text-xs mt-1 text-gray-500">
              사번·전화번호·이메일 등 이 문항이 개인을 특정하는 값이면 켜세요. 양식지 관계
              (온톨로지) 화면에서 이 문항으로 다른 양식지와 연결하려면 슈퍼관리자에게 개인정보
              취급 확인이 필요하고, 미리보기에서는 값이 항상 블러 처리됩니다.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
