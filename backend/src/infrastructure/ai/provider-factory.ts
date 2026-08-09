import { AIProvider } from '../../core/ports/ai-provider';
import { BedrockProvider } from './bedrock-provider';
import type { AnalyticsService } from '../../services/analytics-service';
import { logger } from '../../utils/logger';

export class ProviderFactory {
  private static instance: AIProvider | null = null;

  static createProvider(_analyticsService?: AnalyticsService, _userId?: string): AIProvider {
    logger.info('Creating Bedrock AI provider');
    return new BedrockProvider();
  }

  static getProvider(analyticsService?: AnalyticsService, userId?: string): AIProvider {
    if (!this.instance || analyticsService) {
      this.instance = this.createProvider(analyticsService, userId);
    }
    return this.instance;
  }

  static resetProvider(): void {
    this.instance = null;
  }
}
