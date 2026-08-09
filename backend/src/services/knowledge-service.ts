import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { CacheService } from './cache-service';
import { ProviderFactory } from '../infrastructure/ai/provider-factory';
import type { AnalyticsService } from './analytics-service';
import { BEDROCK } from '../utils/constants';
import { detectSubject } from './knowledge-retrieval';
import { logger } from '../utils/logger';

export interface AnswerResult {
  answer: string;
  source: 'cache' | 'knowledge_base' | 'model';
  documentTitle?: string;
  note?: string;
  cached: boolean;
  pending?: boolean;
  modelUsed?: string;
  guardrailAction?: 'NONE' | 'BLOCKED' | 'MODIFIED';
}

export class KnowledgeService {
  private readonly kbClient: BedrockAgentRuntimeClient;
  private readonly cacheService: CacheService;
  private readonly analyticsService?: AnalyticsService;

  constructor(cacheService: CacheService, analyticsService?: AnalyticsService) {
    this.kbClient = new BedrockAgentRuntimeClient({ region: BEDROCK.REGION });
    this.cacheService = cacheService;
    this.analyticsService = analyticsService;
  }

  async getAnswer(question: string, level: string, queryType: string, userId?: string): Promise<AnswerResult> {
    // Step 1: Check DynamoDB cache for a previously cached answer
    const cached = await this.cacheService.findCachedResponse(question, queryType);
    if (cached) {
      logger.info('Cache hit for question', { question: question.substring(0, 50), queryType });
      return {
        answer: cached.response,
        source: 'cache',
        cached: true,
      };
    }

    // Step 2: Search Bedrock Knowledge Base (S3 Vectors semantic search)
    let kb: { answer: string; documentTitle: string; note?: string } | null = null;
    if (BEDROCK.KNOWLEDGE_BASE_ID) {
      kb = await this.searchKnowledgeBase(question, level);
    } else {
      logger.warn('BEDROCK_KNOWLEDGE_BASE_ID not configured, skipping KB search');
    }

    // A confident match is on-topic: answer directly from the curriculum.
    if (kb && !kb.note) {
      const answer = kb.answer;
      await this.cacheService.storeCachedResponse({
        query: question,
        response: answer,
        queryType: queryType as 'academic' | 'administrative' | 'general',
        modelUsed: 'knowledge-base',
        tokensUsed: 0,
        similarityHash: '',
        source: 'knowledge_base',
        metadata: { documentTitle: kb.documentTitle },
      });
      logger.info('Knowledge base hit for question', { question: question.substring(0, 50), level });
      return {
        answer,
        source: 'knowledge_base',
        documentTitle: kb.documentTitle,
        cached: false,
      };
    }

    // Step 3: Weak/no KB match -> refine with the AI provider when available.
    if (kb && kb.note && this.isAiEnabled()) {
      const aiAnswer = await this.generateWithAI(question, kb.answer, userId);
      if (aiAnswer) {
        logger.info('AI-refined weak KB match for question', { question: question.substring(0, 50) });
        await this.cacheService.storeCachedResponse({
          query: question,
          response: aiAnswer.answer,
          queryType: queryType as 'academic' | 'administrative' | 'general',
          modelUsed: aiAnswer.modelUsed,
          tokensUsed: aiAnswer.tokensUsed,
          similarityHash: '',
          source: 'model',
          metadata: { documentTitle: kb.documentTitle },
        });
        return {
          answer: aiAnswer.answer,
          source: 'model',
          documentTitle: kb.documentTitle,
          cached: false,
          modelUsed: aiAnswer.modelUsed,
        };
      }
    }

    // Step 4: No AI available. Fall back to the weak KB excerpt.
    if (kb && kb.note) {
      const answer = `${kb.answer}\n\n${kb.note}`;
      await this.cacheService.storeCachedResponse({
        query: question,
        response: answer,
        queryType: queryType as 'academic' | 'administrative' | 'general',
        modelUsed: 'knowledge-base',
        tokensUsed: 0,
        similarityHash: '',
        source: 'knowledge_base',
        metadata: { documentTitle: kb.documentTitle, note: kb.note },
      });
      logger.info('Weak knowledge base match for question', { question: question.substring(0, 50), level });
      return {
        answer,
        source: 'knowledge_base',
        documentTitle: kb.documentTitle,
        note: kb.note,
        cached: false,
      };
    }

    // Step 5: No KB match. When AI is enabled, answer directly.
    if (this.isAiEnabled()) {
      const aiAnswer = await this.generateWithAI(question, undefined, userId);
      if (aiAnswer) {
        logger.info('AI answered question with no KB match', { question: question.substring(0, 50) });
        await this.cacheService.storeCachedResponse({
          query: question,
          response: aiAnswer.answer,
          queryType: queryType as 'academic' | 'administrative' | 'general',
          modelUsed: aiAnswer.modelUsed,
          tokensUsed: aiAnswer.tokensUsed,
          similarityHash: '',
          source: 'model',
        });
        return {
          answer: aiAnswer.answer,
          source: 'model',
          cached: false,
          modelUsed: aiAnswer.modelUsed,
        };
      }
    }

    logger.info('Cache miss and KB miss, returning pending response', { question: question.substring(0, 50) });
    const stubAnswer = '[Model integration pending] This question could not be answered from the knowledge base. AI model support will be added next.';
    return {
      answer: stubAnswer,
      source: 'model',
      pending: true,
      cached: false,
    };
  }

  private isAiEnabled(): boolean {
    return !!BEDROCK.MODEL_ID;
  }

  private async generateWithAI(question: string, curriculumContext?: string, userId?: string): Promise<{ answer: string; modelUsed: string; tokensUsed: number } | null> {
    try {
      const provider = ProviderFactory.getProvider(this.analyticsService, userId);
      const prompt = curriculumContext
        ? `Answer the student's question using the curriculum material below as the basis. Keep the answer clear, concise, and directly answer the question. If the material does not cover the question, say so plainly.\n\nStudent question: ${question}\n\nRelevant curriculum material:\n${curriculumContext}`
        : question;

      const result = await provider.generateResponse({
        prompt,
        systemPrompt:
          'You are a friendly, knowledgeable tutor for a Senior High School student in Ghana. ' +
          'Answer directly and step by step where helpful. Use plain language and avoid repeating the question back.',
        maxTokens: 600,
        temperature: 0.4,
      });

      if (result.guardrailAction === 'BLOCKED') {
        logger.warn('Guardrail blocked AI response', { userId });
        return null;
      }

      if (!result.content || !result.content.trim()) {
        logger.warn('AI provider returned an empty answer');
        return null;
      }

      return { answer: result.content.trim(), modelUsed: result.modelUsed, tokensUsed: result.tokensUsed };
    } catch (error: any) {
      logger.error('AI fallback failed, using knowledge-base fallback', { error: error.message });
      return null;
    }
  }

  private async searchKnowledgeBase(question: string, _level: string): Promise<{ answer: string; documentTitle: string; note?: string } | null> {
    try {
      const detectedSubject = detectSubject(question);
      logger.info('Searching Bedrock Knowledge Base', { kbId: BEDROCK.KNOWLEDGE_BASE_ID, subject: detectedSubject });

      const result = await this.kbClient.send(new RetrieveCommand({
        knowledgeBaseId: BEDROCK.KNOWLEDGE_BASE_ID,
        retrievalQuery: { text: question },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 3,
            overrideSearchType: 'SEMANTIC',
          },
        },
      }));

      const chunks = result.retrievalResults ?? [];

      if (chunks.length === 0) {
        logger.info('No results from Bedrock KB', { question: question.substring(0, 50) });
        return null;
      }

      // Use the top result as the primary answer
      const topChunk = chunks[0]!;
      const answer = topChunk.content?.text ?? '';
      const documentTitle = topChunk.location?.s3Location?.uri?.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'Document';

      if (!answer.trim()) {
        logger.info('Bedrock KB returned empty content');
        return null;
      }

      // Check relevance score - Bedrock returns a score between 0 and 1
      // Scores below 0.3 are considered weak matches
      const score = topChunk.score ?? 0;
      if (score < 0.3) {
        logger.info('Weak KB match', { score, documentTitle });
        return {
          answer,
          documentTitle,
          note: '[Note: the knowledge base only touches on this topic. The closest curriculum excerpt is shown above; ask your teacher or check your textbook for a fuller explanation.]',
        };
      }

      logger.info('Strong KB match', { score, documentTitle });
      return { answer, documentTitle };
    } catch (error: any) {
      logger.error('Bedrock KB search failed', { error: error.message, kbId: BEDROCK.KNOWLEDGE_BASE_ID });
      return null;
    }
  }

  public detectSubject(question: string): string | null {
    return detectSubject(question);
  }
}
