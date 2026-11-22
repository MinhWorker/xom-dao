import { DEFAULT_AVATAR, DEFAULT_FRAME } from '@xomdao/shared/client';

const images = import.meta.glob<string>(
  [
    '../../../../../assets/app/images/avatar-*.webp',
    '../../../../../assets/app/images/frame-*.webp',
  ],
  { eager: true, import: 'default' },
);

const byName = new Map(
  Object.entries(images).map(([path, src]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.webp'.length),
    src,
  ]),
);

/** The picture of avatar `id`, or the default avatar's when there is none. */
export function avatarSrc(id: string): string {
  return byName.get(`avatar-${id}`) ?? (byName.get(`avatar-${DEFAULT_AVATAR}`) as string);
}

/** The ring drawn over an avatar for frame `id`, or the default frame's when there is none. */
export function frameSrc(id: string): string {
  return byName.get(`frame-${id}`) ?? (byName.get(`frame-${DEFAULT_FRAME}`) as string);
}
