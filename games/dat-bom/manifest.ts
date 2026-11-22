import { defineManifest } from '@xomdao/sdk';

export default defineManifest({
  id: 'dat-bom',
  name: 'Đặt Bom',
  tagline: 'Đặt bom, né vụ nổ và là người cuối cùng còn đứng.',
  minPlayers: 2,
  maxPlayers: 4,
  duration: { min: 2, max: 3 },
  status: 'wip',
  bots: true,
  island: 'nao-nhiet',
  focus: { x: 64, y: 50 },
  options: {
    level: {
      type: 'choice',
      label: 'Mức máy',
      default: 'normal',
      choices: [
        { value: 'easy', label: 'Dễ' },
        { value: 'normal', label: 'Vừa' },
        { value: 'hard', label: 'Khó' },
      ],
    },
  },
});
