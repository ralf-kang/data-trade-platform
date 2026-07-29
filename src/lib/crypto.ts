import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * 저장해야 하지만 다시 꺼내 써야 하는 비밀값(LDAP 바인딩 비밀번호 등)의 양방향 암호화.
 *
 * API 키·응답 토큰처럼 "검증만 하면 되는" 값은 단방향 해시(SHA-256)로 충분하지만,
 * LDAP 바인딩 비밀번호는 실제로 LDAP 서버에 제시해야 하므로 복호화가 가능해야 한다.
 * 그래서 해시가 아닌 AES-256-GCM(인증 암호화)을 쓴다 — 변조도 함께 탐지된다.
 *
 * 키는 환경변수 APP_ENCRYPTION_KEY에서 가져온다. 미설정 시 기동은 되지만 암호화가
 * 필요한 시점에 명확히 실패시킨다 — 조용히 약한 기본키로 넘어가면 운영에서 평문과
 * 다름없는 상태가 되기 때문이다.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM 권장
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      'APP_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. ' +
        'LDAP 비밀번호 등 비밀값을 저장하려면 32자 이상의 무작위 문자열을 설정하세요.'
    );
  }
  // 임의 길이의 문자열을 32바이트 키로 정규화한다.
  return createHash('sha256').update(raw).digest();
}

/** 평문을 `iv:authTag:ciphertext`(base64) 형태의 단일 문자열로 암호화한다. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

/** encryptSecret으로 만든 문자열을 복호화한다. 변조되었으면 예외를 던진다. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('암호문 형식이 올바르지 않습니다.');

  const [ivB64, tagB64, dataB64] = parts;
  const authTag = Buffer.from(tagB64, 'base64');
  if (authTag.length !== AUTH_TAG_LENGTH) throw new Error('인증 태그 길이가 올바르지 않습니다.');

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** 암호화 키가 설정되어 있는지 — 설정 화면에서 사전 안내용. */
export function isEncryptionConfigured(): boolean {
  const raw = process.env.APP_ENCRYPTION_KEY;
  return !!raw && raw.length >= 16;
}
