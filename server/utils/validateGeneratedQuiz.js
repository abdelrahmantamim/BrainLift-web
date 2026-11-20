export class InvalidGeneratedQuizError extends Error {
  constructor(message = 'The generated quiz was invalid') {
    super(message);
    this.name = 'InvalidGeneratedQuizError';
    this.code = 'QUIZ_GENERATION_INVALID';
  }
}

export function parseAndValidateGeneratedQuiz(responseText) {
  if (typeof responseText !== 'string' || !responseText.trim()) throw new InvalidGeneratedQuizError();
  const cleaned = responseText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let value;
  try { value = JSON.parse(cleaned); } catch { throw new InvalidGeneratedQuizError(); }
  if (!value || !Array.isArray(value.questions) || value.questions.length === 0) throw new InvalidGeneratedQuizError();
  if (value.title !== undefined && (typeof value.title !== 'string' || !value.title.trim())) throw new InvalidGeneratedQuizError();
  const questions = value.questions.map((q, index) => {
    if (!q || typeof q.question !== 'string' || !q.question.trim()) throw new InvalidGeneratedQuizError();
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.some((o) => typeof o !== 'string' || !o.trim())) throw new InvalidGeneratedQuizError();
    if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) throw new InvalidGeneratedQuizError();
    if (q.explanation !== undefined && typeof q.explanation !== 'string') throw new InvalidGeneratedQuizError();
    return { id: typeof q.id === 'string' && q.id.trim() ? q.id : String(index + 1), question: q.question.trim(), options: q.options.map(o => o.trim()), correctAnswer: q.correctAnswer, explanation: q.explanation?.trim() || '' };
  });
  return { title: value.title?.trim() || '', questions };
}
