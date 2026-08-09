import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
} from '@aws-sdk/client-bedrock-agent';
import { requireAdmin } from '../../utils/auth-middleware';
import { defaultRoleResolver } from '../../utils/role-resolver';
import { successResponse } from '../../utils/response';
import { wrapHandler } from '../../utils/error-handler';
import { BEDROCK } from '../../utils/constants';
import { logger } from '../../utils/logger';

const agentClient = new BedrockAgentClient({ region: BEDROCK.REGION });
const roleResolver = defaultRoleResolver();

async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  await requireAdmin(event, roleResolver);

  if (!BEDROCK.KNOWLEDGE_BASE_ID) {
    throw new Error('BEDROCK_KNOWLEDGE_BASE_ID is not configured');
  }

  logger.info('Starting Bedrock KB ingestion job', { kbId: BEDROCK.KNOWLEDGE_BASE_ID });

  const result = await agentClient.send(new StartIngestionJobCommand({
    knowledgeBaseId: BEDROCK.KNOWLEDGE_BASE_ID,
    dataSourceId: BEDROCK.DATA_SOURCE_ID,
  }));

  const job = result.ingestionJob;

  logger.info('Ingestion job started', {
    jobId: job?.ingestionJobId,
    status: job?.status,
    kbId: BEDROCK.KNOWLEDGE_BASE_ID,
  });

  return successResponse({
    ingestionJobId: job?.ingestionJobId,
    status: job?.status,
    knowledgeBaseId: BEDROCK.KNOWLEDGE_BASE_ID,
    message: 'Knowledge base ingestion job started. Documents will be indexed shortly.',
  }, 202);
}

export const main = wrapHandler(handler);
