import { describe, expect, it } from 'vitest';
import { detectSubject } from './knowledge-retrieval';

describe('detectSubject', () => {
  it('matches an exact subject name in the question', () => {
    expect(detectSubject('What is photosynthesis in Integrated Science?')).toBe('Integrated Science');
    expect(detectSubject('Core Mathematics past paper')).toBe('Core Mathematics');
  });

  it('is case insensitive on subject names', () => {
    expect(detectSubject('INTEGRATED SCIENCE revision')).toBe('Integrated Science');
  });

  it('maps common aliases', () => {
    expect(detectSubject('help with maths homework')).toBe('Core Mathematics');
    expect(detectSubject('solve this math problem')).toBe('Core Mathematics');
    expect(detectSubject('general science question')).toBe('Integrated Science');
    expect(detectSubject('english essay help')).toBe('English Language');
    expect(detectSubject('social studies exam')).toBe('Social Studies');
  });

  it('detects subject-topic keywords', () => {
    expect(detectSubject('What is a quadratic equation?')).toBe('Core Mathematics');
    expect(detectSubject('Describe the cell and organism')).toBe('Integrated Science');
    expect(detectSubject('Explain citizenship and governance')).toBe('Social Studies');
    expect(detectSubject('Fix my grammar and tense')).toBe('English Language');
  });

  it('returns null when no subject is identifiable', () => {
    expect(detectSubject('What is the weather today?')).toBeNull();
  });

  it('only ever returns one of the four subjects', () => {
    const questions = [
      'What is algebra?',
      'What is a noun?',
      'Explain photosynthesis',
      'What is democracy?',
      'what is the cell wall',
      'solve the ratio and percentage',
      'write an essay about comprehension',
    ];
    const subjects = new Set(['Core Mathematics', 'English Language', 'Integrated Science', 'Social Studies']);
    for (const q of questions) {
      const subject = detectSubject(q);
      if (subject !== null) {
        expect(subjects.has(subject)).toBe(true);
      }
    }
  });
});
