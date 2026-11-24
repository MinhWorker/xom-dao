import { seededRng } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { makeQuiz, QUIZ_TEMPLATES, type QuizTemplate } from './quiz.js';

/** Works out each template's answer again from the numbers in its text, in the order written. */
const SOLVE: Record<QuizTemplate, (n: number[]) => number> = {
  percent: ([p, x]) => ((p as number) * (x as number)) / 100,
  fraction: ([a, b, x]) => ((x as number) / (b as number)) * (a as number),
  distance: ([v, t]) => (v as number) * (t as number),
  time: ([s, v]) => (s as number) / (v as number),
  rectangle: ([l, w]) => (l as number) * (w as number),
  triangle: ([b, h]) => ((b as number) * (h as number)) / 2,
  average: (n) => n.reduce((a, b) => a + b, 0) / n.length,
  discount: ([p, x]) => ((p as number) * (100 - (x as number))) / 100,
  'sum-difference': ([s, d]) => ((s as number) + (d as number)) / 2,
  ratio: ([s, a, b]) => ((s as number) / ((a as number) + (b as number))) * (a as number),
  box: ([l, w, h]) => (l as number) * (w as number) * (h as number),
};

const numbers = (text: string) => [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));

describe('a Quiz', () => {
  it('has about ten templates', () => {
    expect(QUIZ_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    expect([...QUIZ_TEMPLATES].sort()).toEqual(Object.keys(SOLVE).sort());
  });

  for (const template of QUIZ_TEMPLATES) {
    it(`${template}: thousands of problems, each with one right answer among four`, () => {
      const rng = seededRng(template.length * 7919);
      for (let i = 0; i < 3000; i++) {
        const quiz = makeQuiz(rng, template);
        expect(quiz.template).toBe(template);
        expect(quiz.choices).toHaveLength(4);
        expect(new Set(quiz.choices).size).toBe(4);
        for (const c of quiz.choices) {
          expect(Number.isInteger(c)).toBe(true);
          expect(c).toBeGreaterThan(0);
        }
        const right = SOLVE[template](numbers(quiz.text));
        expect(Number.isInteger(right)).toBe(true);
        expect(quiz.choices[quiz.answer]).toBe(right);
        for (const n of numbers(quiz.text)) expect(Number.isInteger(n) && n > 0).toBe(true);
      }
    });
  }

  it('picks a template and puts the right answer anywhere', () => {
    const rng = seededRng(3);
    const quizzes = Array.from({ length: 400 }, () => makeQuiz(rng));
    expect(new Set(quizzes.map((q) => q.template)).size).toBe(QUIZ_TEMPLATES.length);
    expect(new Set(quizzes.map((q) => q.answer))).toEqual(new Set([0, 1, 2, 3]));
  });
});
