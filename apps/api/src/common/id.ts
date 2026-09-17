import { randomUUID } from "node:crypto";

/**
 * 创建保留领域前缀的可读全局唯一标识。
 *
 * @param prefix - 资源类型前缀。
 * @returns 由前缀和 UUID 组成的标识。
 */
export const newId = (prefix: string) => `${prefix}_${randomUUID()}`;
