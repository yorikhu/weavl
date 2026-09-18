let fallbackSequence = 0;

/**
 * 生成可在浏览器安全与非安全上下文中使用的客户端临时标识。
 *
 * `crypto.randomUUID()` 在通过 HTTP IP 地址访问时不可用，而
 * `crypto.getRandomValues()` 不受该限制。极旧浏览器没有 Web Crypto 时，
 * 再使用时间戳、随机数和会话内递增序号保证前端临时实体不会碰撞。
 *
 * @param prefix - 标识所属实体的短前缀，例如 `node`、`group` 或 `e`。
 * @returns 带实体前缀的客户端唯一标识。
 */
export function createClientId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `${prefix}_${cryptoApi.randomUUID()}`;

  if (cryptoApi?.getRandomValues) {
    const values = cryptoApi.getRandomValues(new Uint32Array(4));
    const randomPart = Array.from(values, (value) => value.toString(36)).join("");
    return `${prefix}_${randomPart}`;
  }

  fallbackSequence += 1;
  return `${prefix}_${Date.now().toString(36)}_${fallbackSequence.toString(36)}_${Math.random().toString(36).slice(2)}`;
}
