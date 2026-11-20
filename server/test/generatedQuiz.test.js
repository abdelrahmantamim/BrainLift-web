import { describe, expect, it } from 'vitest';
import { InvalidGeneratedQuizError, parseAndValidateGeneratedQuiz } from '../utils/validateGeneratedQuiz.js';

describe('parseAndValidateGeneratedQuiz', () => {
  it('accepts fenced multilingual quiz JSON without changing answers', () => {
    const result = parseAndValidateGeneratedQuiz('```json\n{"title":"علوم", "questions":[{"question":"ما الماء؟","options":["مركب","عنصر"],"correctAnswer":0,"explanation":"H₂O"}]}\n```');
    expect(result.title).toBe('علوم');
    expect(result.questions[0]).toMatchObject({ options: ['مركب', 'عنصر'], correctAnswer: 0 });
  });

  it.each([
    ['', 'empty'],
    ['{}', 'missing questions'],
    ['{"questions":[]}', 'empty questions'],
    ['{"questions":[{"question":"Q","options":"A","correctAnswer":0}]}', 'nonarray options'],
    ['{"questions":[{"question":"Q","options":["A","B"],"correctAnswer":2}]}', 'invalid answer index'],
    ['{"questions":[{"question":"","options":["A","B"],"correctAnswer":0}]}', 'blank question'],
    ['{"questions":[{"question":"Q","options":["A",""],"correctAnswer":0}]}', 'blank option'],
  ])('rejects invalid provider output: %s (%s)', (input) => {
    expect(() => parseAndValidateGeneratedQuiz(input)).toThrow(InvalidGeneratedQuizError);
  });
});
