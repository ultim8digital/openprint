export type MessageParams = Record<string, string | number>;
export type Translator = (ru: string, en: string, params?: MessageParams) => string;
/** Stable pair identity: English alone can have different meanings in different contexts. */
export function messageId(ru: string, en: string): string {
  const text = `${ru}\0${en}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `m_${hash.toString(16).padStart(8, '0')}`;
}
export function interpolate(message: string, params: MessageParams = {}): string {
  return message.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token,
  );
}
