import { defineManifest } from '@xomdao/sdk';

export default defineManifest({
  id: 'tien-len',
  name: 'Tiến Lên',
  tagline: 'Đánh hết bài trên tay trước mọi người.',
  minPlayers: 2,
  maxPlayers: 4,
  duration: { min: 5, max: 15 },
  status: 'ready',
  bots: true,
  island: 'bai',
  focus: { x: 68, y: 50 },
  options: {
    rounds: {
      type: 'choice',
      label: 'Số vòng',
      default: 5,
      choices: [
        { value: 1, label: '1 vòng' },
        { value: 3, label: '3 vòng' },
        { value: 5, label: '5 vòng' },
        { value: 10, label: '10 vòng' },
      ],
    },
  },
});
