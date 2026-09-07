export function getCandidateAnswerText(answer) {
  const response = String(answer?.answer_text || '').trim();
  if (!response) return '(no answer)';

  if (answer?.question_type !== 'mcq' || !Array.isArray(answer?.options)) {
    return response;
  }

  const selectedLetter = response.charAt(0).toUpperCase();
  return answer.options.find(option => {
    const text = String(option).trim();
    return text.charAt(0).toUpperCase() === selectedLetter &&
      (text.length === 1 || '.)- '.includes(text.charAt(1)));
  }) || response;
}

export function getCorrectAnswerText(answer) {
  return answer?.correct_answer_text || answer?.correct_answer || '';
}

export function getExplanationWithoutRepeatedAnswer(answer) {
  const explanation = String(answer?.ai_explanation || '').trim();
  const correctAnswer = getCorrectAnswerText(answer);
  if (!explanation || !correctAnswer) return explanation;

  const escapedAnswer = correctAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const repeatedAnswer = new RegExp(
    `(?:correct[.!]?\\s*)?(?:the\\s+)?(?:correct|right)\\s+answer\\s+is\\s*:?\\s*${escapedAnswer}`,
    'gi',
  );

  return explanation
    .replace(repeatedAnswer, '')
    .replace(/^\s*[-—:;,.]+\s*/, '')
    .trim();
}
