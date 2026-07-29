import { Client, type SearchOptions } from 'ldapts';
import { prisma } from '@/lib/db';
import { decryptSecret, encryptSecret, isEncryptionConfigured } from '@/lib/crypto';
import { logAudit } from '@/lib/services/auditService';
import type { LdapConfig, User } from '@/generated/prisma/client';

/**
 * LDAP(Active Directory 포함) 연동.
 *
 * 두 가지 용도를 담당한다:
 *   1. 연결 진단 — 설정 화면에서 "무엇이 잘못됐는지"를 단계별로 알려준다.
 *   2. 사용자 동기화 — LDAP 디렉터리의 계정을 User 테이블로 가져온다.
 *
 * 설계 의도: LDAP 설정은 처음에 반드시 한 번은 틀린다(포트/TLS/BindDN/필터 중 하나).
 * 그래서 "실패했습니다" 한 줄이 아니라 **어느 단계에서 무엇 때문에 막혔는지**를 돌려준다.
 */

export type DiagnosticStep = 'CONNECT' | 'TLS' | 'BIND' | 'SEARCH';

export interface DiagnosticResult {
  step: DiagnosticStep;
  ok: boolean;
  message: string;
  hint?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  steps: DiagnosticResult[];
  sampleCount?: number;
  /** 검색으로 찾은 첫 사용자의 속성 — 속성 매핑이 맞는지 눈으로 확인하는 용도 */
  sampleAttributes?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// 설정 로드/저장
// ---------------------------------------------------------------------------

export type LdapConfigView = Omit<LdapConfig, 'bindPasswordEncrypted'> & {
  /** 비밀번호는 절대 반환하지 않고, 저장되어 있는지 여부만 알린다. */
  hasBindPassword: boolean;
  encryptionConfigured: boolean;
};

export async function getLdapConfig(): Promise<LdapConfigView> {
  const config = await prisma.ldapConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  const { bindPasswordEncrypted, ...rest } = config;
  return {
    ...rest,
    hasBindPassword: !!bindPasswordEncrypted,
    encryptionConfigured: isEncryptionConfigured(),
  };
}

export interface UpdateLdapConfigInput {
  enabled?: boolean;
  host?: string | null;
  port?: number;
  encryption?: 'NONE' | 'LDAPS' | 'STARTTLS';
  verifyCert?: boolean;
  timeoutMs?: number;
  bindDn?: string | null;
  /** 새 비밀번호. undefined면 기존 값 유지, 빈 문자열이면 삭제. */
  bindPassword?: string;
  baseDn?: string | null;
  userSearchFilter?: string;
  userSearchScope?: string;
  attrEmail?: string;
  attrName?: string;
  attrEmployeeNo?: string | null;
  attrDepartment?: string | null;
  attrPosition?: string | null;
  defaultRole?: 'MEMBER' | 'AUTHOR' | 'PLATFORM_ADMIN';
  deactivateMissing?: boolean;
}

export async function updateLdapConfig(
  input: UpdateLdapConfigInput,
  actorEmail: string
): Promise<LdapConfigView> {
  const { bindPassword, ...rest } = input;

  const data: Record<string, unknown> = { ...rest };
  if (bindPassword !== undefined) {
    // 빈 문자열은 "저장된 비밀번호 삭제" 의도로 해석한다.
    data.bindPasswordEncrypted = bindPassword ? encryptSecret(bindPassword) : null;
  }

  await prisma.ldapConfig.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });

  await logAudit({
    userEmail: actorEmail,
    action: 'LDAP_CONFIG_UPDATE',
    target: 'System / LDAP',
    details: `LDAP 설정 변경 (enabled=${input.enabled ?? '유지'}, host=${input.host ?? '유지'})${
      bindPassword !== undefined ? ', 바인딩 비밀번호 변경' : ''
    }`,
    severity: 'warning',
  });

  return getLdapConfig();
}

// ---------------------------------------------------------------------------
// 연결
// ---------------------------------------------------------------------------

function buildUrl(config: { host: string; port: number; encryption: string }): string {
  const scheme = config.encryption === 'LDAPS' ? 'ldaps' : 'ldap';
  return `${scheme}://${config.host}:${config.port}`;
}

async function createClient(config: LdapConfig): Promise<Client> {
  if (!config.host) throw new Error('LDAP 호스트가 설정되지 않았습니다.');

  const client = new Client({
    url: buildUrl({ host: config.host, port: config.port, encryption: config.encryption }),
    timeout: config.timeoutMs,
    connectTimeout: config.timeoutMs,
    tlsOptions: { rejectUnauthorized: config.verifyCert },
  });

  if (config.encryption === 'STARTTLS') {
    await client.startTLS({ rejectUnauthorized: config.verifyCert });
  }
  return client;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 진단 힌트 — 흔한 실패 원인을 사람 말로 옮긴다. */
function hintFor(step: DiagnosticStep, message: string): string | undefined {
  const m = message.toLowerCase();
  if (step === 'CONNECT') {
    if (m.includes('econnrefused')) return '포트가 닫혀 있거나 서비스가 없습니다. 389(일반/STARTTLS) 또는 636(LDAPS)인지 확인하세요.';
    if (m.includes('enotfound')) return '호스트명을 찾을 수 없습니다. DNS 또는 오타를 확인하세요.';
    if (m.includes('timeout') || m.includes('etimedout')) return '방화벽에 막혔을 수 있습니다. 컨테이너에서 LDAP 서버로의 아웃바운드를 확인하세요.';
  }
  if (step === 'TLS') {
    if (m.includes('self') || m.includes('unable to verify') || m.includes('certificate'))
      return '사내 자체서명 인증서로 보입니다. 임시로 "인증서 검증"을 끄고 테스트하되, 운영에서는 CA를 신뢰 목록에 추가하세요.';
    if (m.includes('wrong version') || m.includes('packet'))
      return '암호화 방식이 맞지 않습니다. LDAPS(636)와 STARTTLS(389)를 바꿔서 시도해 보세요.';
  }
  if (step === 'BIND') {
    if (m.includes('invalid credentials') || m.includes('49'))
      return 'Bind DN 또는 비밀번호가 틀렸습니다. AD는 보통 사용자@도메인 또는 전체 DN 형식을 씁니다.';
    if (m.includes('confidentiality')) return '서버가 암호화를 요구합니다. STARTTLS 또는 LDAPS를 사용하세요.';
  }
  if (step === 'SEARCH') {
    if (m.includes('no such object')) return 'Base DN이 존재하지 않습니다. 예: dc=company,dc=com';
    if (m.includes('filter')) return '검색 필터 문법을 확인하세요. 예: (&(objectClass=person)(uid={username}))';
  }
  return undefined;
}

/**
 * 연결 테스트 — 연결 → TLS → 바인딩 → 검색 순으로 단계별 결과를 돌려준다.
 * 실패한 단계 이후는 실행하지 않는다.
 */
export async function testConnection(overridePassword?: string): Promise<ConnectionTestResult> {
  const steps: DiagnosticResult[] = [];
  const config = await prisma.ldapConfig.findUnique({ where: { id: 'default' } });

  if (!config?.host) {
    return {
      success: false,
      steps: [{ step: 'CONNECT', ok: false, message: 'LDAP 호스트가 설정되지 않았습니다.' }],
    };
  }

  let client: Client | null = null;
  try {
    // 1) 연결 (+ STARTTLS)
    try {
      client = await createClient(config);
      steps.push({
        step: 'CONNECT',
        ok: true,
        message: `${buildUrl({ host: config.host, port: config.port, encryption: config.encryption })} 연결 성공`,
      });
      if (config.encryption !== 'NONE') {
        steps.push({
          step: 'TLS',
          ok: true,
          message:
            config.encryption === 'LDAPS'
              ? 'LDAPS 암호화 채널 수립'
              : 'STARTTLS 승격 성공',
        });
      } else {
        steps.push({
          step: 'TLS',
          ok: true,
          message: '암호화 없음(평문)',
          hint: '자격증명이 평문으로 전송됩니다. 폐쇄망이 아니면 STARTTLS 또는 LDAPS를 사용하세요.',
        });
      }
    } catch (err) {
      const message = errorMessage(err);
      const step: DiagnosticStep = message.toLowerCase().includes('tls') || message.toLowerCase().includes('certificate') ? 'TLS' : 'CONNECT';
      steps.push({ step, ok: false, message, hint: hintFor(step, message) });
      return { success: false, steps };
    }

    // 2) 바인딩
    const password = overridePassword ?? (config.bindPasswordEncrypted ? decryptSecret(config.bindPasswordEncrypted) : '');
    try {
      if (config.bindDn) {
        await client.bind(config.bindDn, password);
        steps.push({ step: 'BIND', ok: true, message: `${config.bindDn} 인증 성공` });
      } else {
        steps.push({
          step: 'BIND',
          ok: true,
          message: '익명 바인딩(Bind DN 미설정)',
          hint: '대부분의 디렉터리는 익명 검색을 제한합니다. 검색이 실패하면 Bind DN을 설정하세요.',
        });
      }
    } catch (err) {
      const message = errorMessage(err);
      steps.push({ step: 'BIND', ok: false, message, hint: hintFor('BIND', message) });
      return { success: false, steps };
    }

    // 3) 검색 — {username} 자리를 와일드카드로 바꿔 "몇 명이나 잡히는지" 확인
    try {
      if (!config.baseDn) {
        steps.push({
          step: 'SEARCH',
          ok: false,
          message: 'Base DN이 설정되지 않았습니다.',
          hint: '예: dc=company,dc=com',
        });
        return { success: false, steps };
      }

      const filter = config.userSearchFilter.replace(/\{username\}/g, '*');
      const options: SearchOptions = {
        scope: (config.userSearchScope as 'base' | 'one' | 'sub') || 'sub',
        filter,
        sizeLimit: 5,
        attributes: [
          config.attrEmail,
          config.attrName,
          config.attrEmployeeNo,
          config.attrDepartment,
          config.attrPosition,
        ].filter((a): a is string => !!a),
      };
      const { searchEntries } = await client.search(config.baseDn, options);

      const first = searchEntries[0];
      steps.push({
        step: 'SEARCH',
        ok: searchEntries.length > 0,
        message:
          searchEntries.length > 0
            ? `${searchEntries.length}건 조회 성공 (최대 5건 표본)`
            : '검색은 성공했으나 결과가 0건입니다.',
        hint:
          searchEntries.length === 0
            ? 'Base DN 범위 또는 검색 필터가 실제 디렉터리 구조와 맞는지 확인하세요.'
            : undefined,
      });

      return {
        success: searchEntries.length > 0,
        steps,
        sampleCount: searchEntries.length,
        sampleAttributes: first
          ? Object.fromEntries(
              Object.entries(first)
                .filter(([, v]) => typeof v === 'string' || Array.isArray(v))
                .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)])
            )
          : undefined,
      };
    } catch (err) {
      const message = errorMessage(err);
      steps.push({ step: 'SEARCH', ok: false, message, hint: hintFor('SEARCH', message) });
      return { success: false, steps };
    }
  } finally {
    await client?.unbind().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// 사용자 동기화
// ---------------------------------------------------------------------------

export interface SyncResult {
  created: number;
  updated: number;
  deactivated: number;
  skipped: Array<{ dn: string; reason: string }>;
  total: number;
}

function attrToString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return undefined;
}

/**
 * LDAP 디렉터리의 사용자를 User 테이블로 동기화한다.
 *
 * 정책:
 *  - 이메일이 없는 항목은 건너뛴다(계정 식별 키로 쓰기 때문).
 *  - 기존 LOCAL 계정과 이메일이 겹치면 **덮어쓰지 않고 건너뛴다** — 수동 생성한
 *    슈퍼관리자 계정이 동기화로 뒤바뀌는 사고를 막기 위함.
 *  - LDAP에서 사라진 계정은 삭제하지 않고 LEFT로 전환한다(과거 이력 보존).
 */
export async function syncUsers(actorEmail: string): Promise<SyncResult> {
  const config = await prisma.ldapConfig.findUnique({ where: { id: 'default' } });
  if (!config?.enabled) throw new Error('LDAP_DISABLED');
  if (!config.host || !config.baseDn) throw new Error('LDAP_NOT_CONFIGURED');

  const result: SyncResult = { created: 0, updated: 0, deactivated: 0, skipped: [], total: 0 };
  let client: Client | null = null;

  try {
    client = await createClient(config);
    if (config.bindDn) {
      const password = config.bindPasswordEncrypted ? decryptSecret(config.bindPasswordEncrypted) : '';
      await client.bind(config.bindDn, password);
    }

    const filter = config.userSearchFilter.replace(/\{username\}/g, '*');
    const { searchEntries } = await client.search(config.baseDn, {
      scope: (config.userSearchScope as 'base' | 'one' | 'sub') || 'sub',
      filter,
      attributes: [
        config.attrEmail,
        config.attrName,
        config.attrEmployeeNo,
        config.attrDepartment,
        config.attrPosition,
      ].filter((a): a is string => !!a),
    });

    result.total = searchEntries.length;
    const seenDns = new Set<string>();

    for (const entry of searchEntries) {
      const dn = String(entry.dn);
      const email = attrToString(entry[config.attrEmail]);
      const name = attrToString(entry[config.attrName]) ?? email;

      if (!email) {
        result.skipped.push({ dn, reason: `이메일 속성(${config.attrEmail}) 없음` });
        continue;
      }

      // 로컬 계정 보호 — 수동 생성 계정을 LDAP 동기화가 덮어쓰지 않는다.
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail && existingByEmail.source === 'LOCAL') {
        result.skipped.push({ dn, reason: `로컬 계정과 이메일 충돌 (${email})` });
        continue;
      }

      seenDns.add(dn);
      const fields = {
        email,
        name: name ?? email,
        department: config.attrDepartment ? attrToString(entry[config.attrDepartment]) ?? null : null,
        position: config.attrPosition ? attrToString(entry[config.attrPosition]) ?? null : null,
        employeeNo: config.attrEmployeeNo ? attrToString(entry[config.attrEmployeeNo]) ?? null : null,
        source: 'LDAP' as const,
        ldapDn: dn,
        status: 'ACTIVE' as const,
        lastSyncedAt: new Date(),
      };

      const existing = await prisma.user.findUnique({ where: { ldapDn: dn } });
      if (existing) {
        await prisma.user.update({ where: { id: existing.id }, data: fields });
        result.updated++;
      } else {
        const created = await prisma.user.create({ data: fields });
        await prisma.userRole.create({
          data: { userId: created.id, role: config.defaultRole, grantedBy: `ldap-sync(${actorEmail})` },
        });
        result.created++;
      }
    }

    // LDAP에서 사라진 계정 → LEFT (삭제하지 않음)
    if (config.deactivateMissing) {
      const ldapUsers = await prisma.user.findMany({
        where: { source: 'LDAP', status: 'ACTIVE' },
        select: { id: true, ldapDn: true },
      });
      const missing = ldapUsers.filter((u) => u.ldapDn && !seenDns.has(u.ldapDn));
      if (missing.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: missing.map((u) => u.id) } },
          data: { status: 'LEFT' },
        });
        result.deactivated = missing.length;
      }
    }

    await prisma.ldapConfig.update({
      where: { id: 'default' },
      data: { lastSyncAt: new Date(), lastSyncResult: JSON.stringify(result) },
    });

    await logAudit({
      userEmail: actorEmail,
      action: 'LDAP_SYNC',
      target: 'System / LDAP',
      details: `LDAP 사용자 동기화 — 신규 ${result.created} / 갱신 ${result.updated} / 이탈처리 ${result.deactivated} / 건너뜀 ${result.skipped.length}`,
      severity: 'warning',
    });

    return result;
  } finally {
    await client?.unbind().catch(() => undefined);
  }
}

/**
 * LDAP 자격증명으로 사용자를 인증한다 (로그인 시 사용).
 * 검색으로 DN을 찾은 뒤 그 DN으로 재바인딩하는 표준 방식.
 */
export async function authenticate(username: string, password: string): Promise<User | null> {
  const config = await prisma.ldapConfig.findUnique({ where: { id: 'default' } });
  if (!config?.enabled || !config.host || !config.baseDn) return null;
  if (!password) return null; // 빈 비밀번호는 익명 바인딩으로 성공해버리므로 반드시 차단

  let client: Client | null = null;
  try {
    client = await createClient(config);

    if (config.bindDn) {
      const bindPw = config.bindPasswordEncrypted ? decryptSecret(config.bindPasswordEncrypted) : '';
      await client.bind(config.bindDn, bindPw);
    }

    const filter = config.userSearchFilter.replace(/\{username\}/g, username);
    const { searchEntries } = await client.search(config.baseDn, {
      scope: (config.userSearchScope as 'base' | 'one' | 'sub') || 'sub',
      filter,
      sizeLimit: 2,
    });
    if (searchEntries.length !== 1) return null; // 0건 또는 모호한 다중 매치는 거부

    const dn = String(searchEntries[0].dn);
    await client.bind(dn, password); // 실패 시 예외 → null

    const user = await prisma.user.findFirst({ where: { ldapDn: dn } });
    if (!user || user.status !== 'ACTIVE') return null;

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return user;
  } catch {
    return null;
  } finally {
    await client?.unbind().catch(() => undefined);
  }
}
