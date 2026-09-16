import { randomUUID } from "node:crypto";

/** Creates readable globally unique identifiers while preserving the domain prefix. */
export const newId = (prefix: string) => `${prefix}_${randomUUID()}`;
