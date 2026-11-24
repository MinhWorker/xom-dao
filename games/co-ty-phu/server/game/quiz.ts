/**
 * Quizzes: grade-5 maths problems with fresh numbers. Each template draws nice numbers (every
 * answer a whole number), works out the answer and the wrong answers a common slip gives; the
 * Quiz then has four different answers in a random order.
 */
import { int, pick, type Rng, shuffle } from '@xomdao/sdk';

export const QUIZ_TEMPLATES = [
  'percent',
  'fraction',
  'distance',
  'time',
  'rectangle',
  'triangle',
  'average',
  'discount',
  'sum-difference',
  'ratio',
  'box',
] as const;
export type QuizTemplate = (typeof QUIZ_TEMPLATES)[number];

export interface Quiz {
  template: QuizTemplate;
  text: string;
  /** Four different whole numbers above 0. */
  choices: number[];
  /** Which of `choices` is right. */
  answer: number;
}

interface Problem {
  text: string;
  right: number;
  /** What common slips give, most likely first; duplicates and bad ones are dropped. */
  slips: number[];
}

const PROBLEMS: Record<QuizTemplate, (rng: Rng) => Problem> = {
  percent: (rng) => {
    const p = pick(rng, [10, 20, 25, 30, 40, 50, 75]);
    const x = 20 * int(rng, 2, 25);
    const right = (p * x) / 100;
    return {
      text: `${p}% của ${x} là bao nhiêu?`,
      right,
      slips: [x - right, right * 10, right * 2],
    };
  },
  fraction: (rng) => {
    const [a, b] = fraction(rng, 2, 3, 9);
    const x = b * int(rng, 3, 15);
    const right = (x / b) * a;
    return { text: `${a}/${b} của ${x} là bao nhiêu?`, right, slips: [x / b, x - right, x * a] };
  },
  distance: (rng) => {
    const v = 5 * int(rng, 6, 16);
    const t = int(rng, 2, 6);
    return {
      text: `Một ô tô đi với vận tốc ${v} km/giờ trong ${t} giờ. Ô tô đi được bao nhiêu ki-lô-mét?`,
      right: v * t,
      slips: [v * (t + 1), v * (t - 1), v + t],
    };
  },
  time: (rng) => {
    const v = 5 * int(rng, 6, 16);
    const t = int(rng, 2, 7);
    return {
      text: `Quãng đường dài ${v * t} km, một ô tô đi với vận tốc ${v} km/giờ. Ô tô cần bao nhiêu giờ?`,
      right: t,
      slips: [t + 1, t - 1, t * 2],
    };
  },
  rectangle: (rng) => {
    const w = int(rng, 3, 15);
    const l = w + int(rng, 1, 12);
    return {
      text: `Một hình chữ nhật dài ${l} m, rộng ${w} m. Diện tích là bao nhiêu mét vuông?`,
      right: l * w,
      slips: [2 * (l + w), l + w, l * w * 2],
    };
  },
  triangle: (rng) => {
    const b = 2 * int(rng, 2, 12);
    const h = int(rng, 3, 15);
    return {
      text: `Một hình tam giác có đáy ${b} cm, chiều cao ${h} cm. Diện tích là bao nhiêu xăng-ti-mét vuông?`,
      right: (b * h) / 2,
      slips: [b * h, b + h, (b * h) / 2 + b],
    };
  },
  average: (rng) => {
    const avg = int(rng, 12, 60);
    const d = int(rng, 1, 9);
    const e = int(rng, 1, 9);
    const n = [avg - d, avg + d + e, avg - e];
    const sum = n.reduce((s, k) => s + k, 0);
    return {
      text: `Trung bình cộng của ${n[0]}, ${n[1]} và ${n[2]} là bao nhiêu?`,
      right: avg,
      slips: [sum, sum / 2, avg + 1],
    };
  },
  discount: (rng) => {
    const x = pick(rng, [10, 20, 25, 30, 40, 50]);
    const price = 20 * int(rng, 3, 25);
    const off = (price * x) / 100;
    return {
      text: `Một món đồ giá ${price} nghìn đồng, được giảm ${x}%. Giá mới là bao nhiêu nghìn đồng?`,
      right: price - off,
      slips: [off, price - x, price + off],
    };
  },
  'sum-difference': (rng) => {
    const small = int(rng, 8, 60);
    const big = small + 2 * int(rng, 2, 20);
    return {
      text: `Tổng của hai số là ${big + small}, hiệu của chúng là ${big - small}. Số lớn là bao nhiêu?`,
      right: big,
      slips: [small, 2 * small, 2 * big],
    };
  },
  ratio: (rng) => {
    const [a, b] = fraction(rng, 1, 2, 7);
    const part = int(rng, 3, 15);
    const sum = (a + b) * part;
    return {
      text: `Tổng của hai số là ${sum}. Số thứ nhất bằng ${a}/${b} số thứ hai. Số thứ nhất là bao nhiêu?`,
      right: a * part,
      slips: [b * part, part, sum - b],
    };
  },
  box: (rng) => {
    const h = int(rng, 2, 9);
    const w = int(rng, 2, 9);
    const l = w + int(rng, 1, 8);
    return {
      text: `Một hình hộp chữ nhật dài ${l} cm, rộng ${w} cm, cao ${h} cm. Thể tích là bao nhiêu xăng-ti-mét khối?`,
      right: l * w * h,
      slips: [l * w, l * w * h * 2, (l + w) * 2 * h],
    };
  },
};

/** A reduced fraction a/b below 1, with `minA` ≤ a and `minB` ≤ b ≤ `maxB`. */
function fraction(rng: Rng, minA: number, minB: number, maxB: number): [number, number] {
  const gcd = (m: number, n: number): number => (n === 0 ? m : gcd(n, m % n));
  const all: [number, number][] = [];
  for (let b = minB; b <= maxB; b++)
    for (let a = minA; a < b; a++) if (gcd(a, b) === 1) all.push([a, b]);
  return pick(rng, all);
}

/** A Quiz from `template`, or from a random one. */
export function makeQuiz(rng: Rng, template: QuizTemplate = pick(rng, QUIZ_TEMPLATES)): Quiz {
  const { text, right, slips } = PROBLEMS[template](rng);
  const wrong: number[] = [];
  const nearby = [1, -1, 2, -2, 10, -10].map((d) => right + d);
  for (const n of [...slips, ...nearby]) {
    if (wrong.length < 3 && Number.isInteger(n) && n > 0 && n !== right && !wrong.includes(n))
      wrong.push(n);
  }
  const choices = shuffle(rng, [right, ...wrong]);
  return { template, text, choices, answer: choices.indexOf(right) };
}
