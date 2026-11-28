import { defineManifest } from '@xomdao/sdk';

export default defineManifest({
  id: 'co-vay',
  name: 'Cờ Vây',
  tagline: 'Vây đất, bắt quân, ai nhiều đất hơn thì thắng.',
  minPlayers: 2,
  maxPlayers: 2,
  duration: { min: 10, max: 40 },
  status: 'ready',
  bots: true,
  island: 'co',
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
    first: {
      type: 'choice',
      label: 'Cầm đen',
      default: 'loser',
      choices: [
        { value: 'loser', label: 'Người thua' },
        { value: 'alternate', label: 'Lần lượt' },
      ],
    },
  },
});
