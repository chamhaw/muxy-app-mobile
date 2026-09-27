import { bytesToBase64 } from '@/lib/base64';

import { transformBase64WithModifier, transformBytesWithModifier } from './terminalModifiers';

describe('transformBytesWithModifier', () => {
  it('maps single byte control chords', () => {
    expect([...transformBytesWithModifier(new Uint8Array([0x61]), 'ctrl')]).toEqual([0x01]);
    expect([...transformBytesWithModifier(new Uint8Array([0x3f]), 'ctrl')]).toEqual([0x7f]);
  });

  it('prefixes single byte meta chords', () => {
    expect([...transformBytesWithModifier(new Uint8Array([0x61]), 'meta')]).toEqual([0x1b, 0x61]);
    expect([...transformBytesWithModifier(new Uint8Array([0x61]), 'alt')]).toEqual([0x1b, 0x61]);
  });

  it('does not apply a one-key modifier to composed or dictated text batches', () => {
    const input = new TextEncoder().encode('hello\n中文 voice input');

    expect(transformBytesWithModifier(input, 'ctrl')).toBe(input);
    expect(transformBytesWithModifier(input, 'alt')).toBe(input);
    expect(transformBytesWithModifier(input, 'meta')).toBe(input);
  });
});

describe('transformBase64WithModifier', () => {
  it('passes through input when no modifier is armed', () => {
    const input = bytesToBase64(new TextEncoder().encode('hello\nworld'));

    expect(transformBase64WithModifier(input, null)).toBe(input);
  });

  it('does not truncate long text when a modifier is armed', () => {
    const input = bytesToBase64(new TextEncoder().encode('hello\n中文 voice input'));

    expect(transformBase64WithModifier(input, 'ctrl')).toBe(input);
  });
});
