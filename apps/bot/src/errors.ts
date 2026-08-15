export class PublicError extends Error {}

export function errorReference() {
  return `ONX-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}
