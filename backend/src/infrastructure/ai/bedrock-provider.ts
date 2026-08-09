import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  type InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  AIProvider,
  AIResponse,
  GenerateResponseInput,
  GenerateSummaryInput,
  ClassifyQueryInput,
  ClassifyQueryOutput,
} from '../../core/ports/ai-provider';
import { BEDROCK } from '../../utils/constants';
import { logger } from '../../utils/logger';

const SYSTEM_PROMPT =
  'You are a friendly, knowledgeable tutor for a Senior High School student in Ghana. ' +
  'Answer directly and step by step where helpful. Use plain language and avoid repeating the question back. ' +
  'If you are not sure about something, say so honestly.';

export class BedrockProvider implements AIProvider {
  private readonly client: BedrockRuntimeClient;
  readonly modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId ?? BEDROCK.MODEL_ID;
    this.client = new BedrockRuntimeClient({ region: BEDROCK.REGION });
  }

  async generateResponse(input: GenerateResponseInput): Promise<AIResponse> {
    const startTime = Date.now();
    const model = input.requireReasoning ? BEDROCK.MODEL_COMPLEX : this.modelId;

    const messages = this.buildMessages(input);

    const body: Record<string, unknown> = {
      system: [{ text: input.systemPrompt ?? SYSTEM_PROMPT }],
      messages,
      inferenceConfig: {
        maxTokens: input.maxTokens ?? 2048,
        temperature: input.temperature ?? 0.7,
      },
    };

    const invokeInput: InvokeModelCommandInput = {
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    };

    if (BEDROCK.GUARDRAIL_ID) {
      invokeInput.guardrailIdentifier = BEDROCK.GUARDRAIL_ID;
      invokeInput.guardrailVersion = BEDROCK.GUARDRAIL_VERSION;
    }

    try {
      const command = new InvokeModelCommand(invokeInput);
      const response = await this.client.send(command);
      const parsed = JSON.parse(new TextDecoder().decode(response.body)) as Record<string, unknown>;

      const latencyMs = Date.now() - startTime;
      const output = parsed['output'] as { message?: { content?: Array<{ text?: string }> } } | undefined;
      const content = output?.message?.content?.[0]?.text ?? '';

      const usage = parsed['usage'] as { inputTokens?: number; outputTokens?: number } | undefined;
      const tokensUsed = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);

      const guardrailAction = (response as unknown as Record<string, unknown>)['amazonBedrockGuardrailAction'] as AIResponse['guardrailAction'] ?? 'NONE';

      logger.info('Bedrock response', { model, latencyMs, tokensUsed, guardrailAction });

      return {
        content,
        modelUsed: model,
        tokensUsed,
        latencyMs,
        confidence: content ? 0.9 : 0,
        finishReason: content ? 'stop' : 'empty',
        guardrailAction,
      };
    } catch (error: any) {
      logger.error('Bedrock generateResponse failed', {
        error: error?.message,
        model,
        name: error?.name,
      });
      throw error;
    }
  }

  async generateSummary(input: GenerateSummaryInput): Promise<AIResponse> {
    return this.generateResponse({
      prompt: `Please provide a concise summary of the following conversation in ${input.maxLength ?? 200} words or less:\n\n${input.text}`,
      systemPrompt: 'You are a summarization assistant. Create clear, concise summaries that capture key points.',
      maxTokens: input.maxLength ? Math.min(input.maxLength * 2, 500) : 400,
      temperature: 0.3,
    });
  }

  async classifyQuery(input: ClassifyQueryInput): Promise<ClassifyQueryOutput> {
    const prompt = `Classify the following student query into exactly one of these categories: ${input.categories.join(', ')}.\n\nQuery: "${input.query}"\n\nRespond with only the category name, nothing else.`;

    try {
      const result = await this.generateResponse({
        prompt,
        systemPrompt: 'You are a strict query classifier. Respond with only the category name.',
        maxTokens: 50,
        temperature: 0.1,
      });

      const category = (result.content ?? '').trim().toLowerCase();
      const validCategory = input.categories.find((c) => category.includes(c));

      return {
        category: validCategory ?? input.categories[0] ?? 'general',
        confidence: validCategory ? 0.9 : 0.5,
      };
    } catch (error: any) {
      logger.error('Bedrock classification failed', { error: error.message, query: input.query });
      return { category: 'general', confidence: 0.5 };
    }
  }

  private buildMessages(input: GenerateResponseInput): Array<{ role: string; content: Array<{ text: string }> }> {
    const messages: Array<{ role: string; content: Array<{ text: string }> }> = [];

    if (input.conversationHistory && input.conversationHistory.length > 0) {
      for (const msg of input.conversationHistory) {
        messages.push({
          role: msg.role,
          content: [{ text: msg.content }],
        });
      }
    }

    messages.push({
      role: 'user',
      content: [{ text: input.prompt }],
    });

    return messages;
  }
}
