import { SHS_SUBJECTS } from '../utils/knowledge-constants';

export function detectSubject(question: string): string | null {
  const q = question.toLowerCase();

  // Exact subject-name match (handles multi-word names like "Core Mathematics").
  for (const subject of SHS_SUBJECTS) {
    if (q.includes(subject.toLowerCase())) {
      return subject;
    }
  }

  // Common aliases for subjects students are likely to type.
  const aliases: Record<string, string> = {
    maths: 'Core Mathematics',
    math: 'Core Mathematics',
    mathematics: 'Core Mathematics',
    'core maths': 'Core Mathematics',
    'core math': 'Core Mathematics',
    'integrated science': 'Integrated Science',
    'general science': 'Integrated Science',
    science: 'Integrated Science',
    'social studies': 'Social Studies',
    english: 'English Language',
    'english language': 'English Language',
  };

  const tokens = q.split(/\s+/);
  for (const token of tokens) {
    const alias = aliases[token.replace(/[^a-z]/g, '')];
    if (alias) {
      return alias;
    }
  }

  // Subject-topic keyword hints, only used when no subject name/alias matched.
  const subjectKeywords: Record<string, string[]> = {
    'English Language': ['noun', 'verb', 'grammar', 'essay', 'comprehension', 'vocabulary', 'sentence', 'tense', 'spelling', 'adjective', 'pronoun', 'adverb', 'conjunction', 'preposition', 'reading', 'writing'],
    'Core Mathematics': ['equation', 'algebra', 'geometry', 'trigonom', 'calculus', 'fraction', 'graph', 'probability', 'statistic', 'mean', 'median', 'mode', 'percentage', 'ratio', 'number', 'area', 'volume', 'quadratic', 'logarithm', 'indices'],
    'Integrated Science': ['cell', 'organism', 'photosynthesis', 'respiration', 'enzyme', 'tissue', 'ecosystem', 'atom', 'molecule', 'compound', 'chemical', 'periodic', 'acid', 'base', 'reaction', 'element', 'force', 'energy', 'motion', 'velocity', 'acceleration', 'electricity', 'magnetism', 'wave', 'gravity', 'current', 'voltage', 'light', 'soil', 'microscope', 'disease', 'nutrition'],
    'Social Studies': ['society', 'community', 'citizenship', 'culture', 'values', 'family', 'population', 'environment', 'development', 'governance', 'tolerance', 'human right', 'democracy', 'economy', 'resources'],
  };

  for (const [subject, keywords] of Object.entries(subjectKeywords)) {
    if (keywords.some(k => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(q))) {
      return subject;
    }
  }

  return null;
}
