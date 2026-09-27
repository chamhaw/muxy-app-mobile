import { bytesToBase64 } from '@/lib/base64';

export type Modifier = 'ctrl' | 'shift' | 'alt' | 'meta';

export function transformBase64WithModifier(base64: string, active: Modifier | null): string {
  if (!active) return base64;

  let bytes: Uint8Array;
  try {
    const bin = globalThis.atob(base64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return base64;
  }
  if (bytes.length === 0) return base64;

  return bytesToBase64(transformBytesWithModifier(bytes, active));
}

export function transformBytesWithModifier(bytes: Uint8Array, active: Modifier | null): Uint8Array {
  if (!active || bytes.length === 0) return bytes;
  if (bytes.length !== 1) return bytes;

  const ch = bytes[0]!;
  let result = bytes;

  if (active === 'ctrl') {
    let mapped: number | null = null;
    if (ch >= 0x40 && ch <= 0x5f) mapped = ch - 0x40;
    else if (ch >= 0x60 && ch <= 0x7e) mapped = ch - 0x60;
    else if (ch === 0x20) mapped = 0x00;
    else if (ch === 0x3f) mapped = 0x7f;
    if (mapped !== null) result = new Uint8Array([mapped]);
  } else if (active === 'alt' || active === 'meta') {
    const prefixed = new Uint8Array(result.length + 1);
    prefixed[0] = 0x1b;
    prefixed.set(result, 1);
    result = prefixed;
  }

  return result;
}
