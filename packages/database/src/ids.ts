import { nanoid } from 'nanoid';

export function createId(prefix: 'usr' | 'prj' | 'vid' | 'job' | 'evt'): string {
  return `${prefix}_${nanoid(16)}`;
}
