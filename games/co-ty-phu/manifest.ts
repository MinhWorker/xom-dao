import { defineManifest } from '@xomdao/sdk';

export default defineManifest({
  id: 'co-ty-phu',
  name: 'Cờ Tỷ Phú',
  tagline: 'Mua đất, xây nhà, khiến đối thủ phá sản.',
  minPlayers: 2,
  maxPlayers: 4,
  duration: { min: 25, max: 35 },
  status: 'ready',
  bots: true,
  island: 'xuc-xac',
  focus: { x: 68, y: 50 },
  options: {
    speed: {
      type: 'choice',
      label: 'Tốc độ',
      default: 'normal',
      choices: [
        { value: 'normal', label: 'Thường' },
        { value: 'fast', label: 'Nhanh' },
      ],
    },
  },
  preferences: {
    follow: { type: 'toggle', label: 'Máy quay bám theo', default: true },
  },
});
