import { defineManifest } from '@xomdao/sdk';

export default defineManifest({
  id: 'co-tuong',
  name: 'Cờ Tướng',
  tagline: 'Chiếu bí tướng của đối phương.',
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
      label: 'Cầm đỏ',
      default: 'loser',
      choices: [
        { value: 'loser', label: 'Người thua' },
        { value: 'alternate', label: 'Lần lượt' },
      ],
    },
  },
  preferences: {
    hints: { type: 'toggle', label: 'Hiện nước đi được', default: true },
    labels: {
      type: 'choice',
      label: 'Chữ trên quân',
      default: 'han',
      choices: [
        { value: 'han', label: 'Chữ Hán' },
        { value: 'viet', label: 'Chữ Việt' },
      ],
    },
  },
});
