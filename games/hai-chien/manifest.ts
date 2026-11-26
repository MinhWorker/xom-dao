import { defineManifest } from '@xomdao/sdk';

export default defineManifest({
  id: 'hai-chien',
  name: 'Hải Chiến',
  tagline: 'Đoán chỗ và bắn chìm hạm đội đối phương.',
  minPlayers: 2,
  maxPlayers: 2,
  duration: { min: 5, max: 15 },
  status: 'ready',
  bots: true,
  island: 'nao-nhiet',
  focus: { x: 68, y: 50 },
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
    chain: { type: 'toggle', label: 'Trúng thì bắn tiếp', default: true },
    radar: { type: 'toggle', label: 'Ra-đa', default: true },
  },
});
