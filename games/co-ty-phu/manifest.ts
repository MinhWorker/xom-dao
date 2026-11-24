import { defineManifest } from '@xomdao/sdk';

export default defineManifest({
  id: 'co-ty-phu',
  name: 'Cờ Tỷ Phú',
  tagline: 'Mua đất, xây nhà, khiến đối thủ phá sản.',
  minPlayers: 2,
  maxPlayers: 4,
  duration: { min: 20, max: 60 },
  status: 'wip',
  bots: true,
  island: 'xuc-xac',
  focus: { x: 70, y: 50 },
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
});
