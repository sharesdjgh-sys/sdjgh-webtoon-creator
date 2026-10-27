// Vercel Function 요청 본문 한도는 4.5 MB다. base64 팽창과 JSON 메타데이터를
// 감안해 그보다 작은 전체 상한을 클라이언트와 서버에서 동일하게 적용한다.
export const MAX_CHARACTER_REFERENCES = 3;
export const MAX_REFERENCE_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_REFERENCE_SEND_BYTES = 900_000;
export const MAX_CHARACTER_SHEET_BODY_BYTES = 4_000_000;
export const MAX_REFERENCE_EDGE = 2048;
export const MAX_REFERENCE_BASE64_LENGTH = Math.ceil(MAX_REFERENCE_SEND_BYTES / 3) * 4;

export const REFERENCE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ReferenceMimeType = typeof REFERENCE_MIME_TYPES[number];
