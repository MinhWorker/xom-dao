import { defineManifest } from '@xomdao/sdk';

export default defineManifest({
  id: 'caro',
  name: 'Caro',
  tagline: 'Xếp năm quân liền hàng trước đối thủ.',
  minPlayers: 2,
  maxPlayers: 2,
  duration: { min: 5, max: 15 },
  status: 'ready',
  bots: true,
  island: 'co',
  focus: { x: 70, y: 50 },
  options: {
    level: {
      type: 'choice',
      label: 'Mức máy',
      default: 'easy',
      choices: [
        { value: 'easy', label: 'Dễ' },
        { value: 'normal', label: 'Vừa' },
        { value: 'hard', label: 'Khó' },
      ],
    },
    first: {
      type: 'choice',
      label: 'Đi trước',
      default: 'loser',
      choices: [
        { value: 'loser', label: 'Người thua' },
        { value: 'alternate', label: 'Lần lượt' },
      ],
    },
  },
});
