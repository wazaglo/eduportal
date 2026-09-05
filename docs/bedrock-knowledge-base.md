# Bedrock Knowledge Base (S3 Vectors)

How the curriculum knowledge base is indexed for **semantic search** with an
Amazon Bedrock Knowledge Base on an **S3 Vectors** store, and how to reproduce
it. Account `814330181503`, region `eu-west-1`, profile `terrence`.

## Resources

| Resource | Identifier |
|----------|-----------|
| Knowledge Base | `eduportal-knowledge-base` (ID `SSJQQYPJ4A`, ARN `arn:aws:bedrock:eu-west-1:814330181503:knowledge-base/SSJQQYPJ4A`, **ACTIVE**) |
| Vector bucket | `eduportal-kb-vectors` (ARN `arn:aws:s3vectors:eu-west-1:814330181503:bucket/eduportal-kb-vectors`) |
| Vector index | `eduportal-index` (ARN `.../bucket/eduportal-kb-vectors/index/eduportal-index`) |
| Embedding model | `amazon.titan-embed-text-v2:0` — 1024 dims, `FLOAT32`, euclidean |
| Parsing model | `eu.amazon.nova-lite-v1:0` (EU inference profile) |
| Data source | `eduportal-s3-knowledge` (ID `RQPXDTWNFN`) |
| Service role | `eduportal-bedrock-kb-role` (template `infra/ai/bedrock-knowledge-base-role.yml`) |
| Source bucket | `eduportal-azubi-success-knowledge-base`, key prefix `knowledge/` |

Ingestion: **112 documents scanned → 110 indexed, 2 failed** (2 source PDFs
throttled by the Nova Lite parser; the 108 `.txt` curriculum docs all indexed).
Semantic `RetrieveCommand` verified working (returns ranked chunks with scores).

## Why S3 Vectors

The vector store is a dedicated **S3 Vectors** bucket (`UseS3Vectors=true`),
chosen over OpenSearch Serverless/Aurora for cost. S3 Vector indexes are
**immutable**: to change index configuration you must delete and recreate the
index. The S3 Vector index ARN keeps the `s3vectors:` service prefix
(`arn:aws:s3vectors:<region>:<account>:bucket/<b>/index/<i>`).

## Proven CLI runbook

1. Vector bucket + index (the index requires a metadata vector index config;
   the two `AMAZON_BEDROCK_*` metadata keys **must** be non-filterable or
   ingestion fails with *"Filterable metadata must have at most 2048 bytes"*):

   ```bash
   aws s3controller create-index ...                       # bucket
   aws s3vectors create-index \
     --bucket-name eduportal-kb-vectors \
     --index-name eduportal-index \
     --index-configuration type=IN_MEMORY,relevantFieldsKind=metadata,pageSize=1024,units=1 \
     --vector-index-metadata-configuration '{
         "vectorIndexConfiguration":{"dimension":"1024","metric":"EUCLIDEAN","vectorDataType":"FLOAT32"},
         "metadataConfiguration":{"nonFilterableMetadataKeys":["AMAZON_BEDROCK_TEXT","AMAZON_BEDROCK_METADATA"]}
     }'
   ```

2. **IAM role** - deploy `infra/ai/bedrock-knowledge-base-role.yml`. It lets
   Bedrock invoke the embeddings/parsing models, read the source bucket, and
   read/write vectors:
   ```bash
   aws cloudformation deploy \
     --template-file infra/ai/bedrock-knowledge-base-role.yml \
     --stack-name eduportal-bedrock-kb-role \
     --capabilities CAPABILITY_NAMED_IAM \
     --profile terrence --region eu-west-1
   ```

3. **Knowledge base** (vectors storage, S3 Vectors, Titan V2 @ 1024):
   ```bash
   aws bedrock-agent create-knowledge-base \
     --profile terrence --region eu-west-1 \
     --name eduportal-knowledge-base \
     --role-arn arn:aws:iam::814330181503:role/eduportal-bedrock-kb-role \
     --knowledge-base-configuration '{
        "vectorKnowledgeBaseConfiguration":{"embeddingModelArn":"arn:aws:bedrock:eu-west-1::foundation-model/amazon.titan-embed-text-v2:0"}
     }' \
     --storage-configuration '{
        "type":"S3_VECTORS",
        "s3VectorStoreConfiguration":{"bucketArn":"arn:aws:s3vectors:eu-west-1:814330181503:bucket/eduportal-kb-vectors"}
     }'
   ```

4. **Data source** (S3, `knowledge/` prefix, FIXED_SIZE chunk 300/20%, parsing
   via `eu.amazon.nova-lite-v1:1` inference profile):
   ```bash
   aws bedrock-agent create-data-source \
     --knowledge-base-id SSJQQYPJ4A --name 'eduportal-s3-knowledge' \
     --data-source-configuration '{
        "type":"S3",
        "s3Configuration":{"bucketArn":"arn:aws:s3:::eduportal-azubi-success-knowledge-base","inclusionPrefixes":["knowledge/"]},
        "vectorIngestionConfiguration":{
          "chunkingConfiguration":{"chunkingStrategy":"FIXED_SIZE","fixedSizeChunkingConfiguration":{"maxTokens":300,"overlapPercentage":60}},
          "parsingConfiguration":{"parsingStrategy":"BEDROCK_FOUNDATION_MODEL","bedrockFoundationModelConfiguration":{"modelArn":"arn:aws:bedrock:eu-west-1::inference-profile/eu.amazon.nova-lite-v1:1"}}
        }
     }'
   ```

5. **Ingest** (start a job, then poll):
   ```bash
   aws bedrock-agent start-ingestion-job \
     --knowledge-base-id eduportal-knowledge-base \
     --data-source-id RQPXDTWNFN \
     --profile terrence --region eu-west-1
   # poll:
   aws bedrock-agent get-ingestion-job \
     --knowledge-base-id eduportal-knowledge-base \
     --data-source-id RQPXDTWNFN \
     --ingestion-job-id <JOB_ID> \
     --query 'ingestionJob.{status:status,docs:statistics}'
   ```

6. **Verify retrieval**:
   ```bash
   aws bedrock-agent-runtime retrieve \
     --knowledge-base-id eduportal-knowledge-base \
     --retrieval-query 'text=What is a quadratic equation?' \
     --retrieval-configuration 'vectorSearchConfiguration={numberOfResults=3,overrideSearchType=SEMANTIC}' \
     --profile terrence --region eu-west-1
   ```

## Serving the KB from the backend

`backend/src/services/knowledge-service.ts` calls
`bedrock-agent-runtime:Retrieve` (SDK `<code>@aws-sdk/client-bedrock-agent-runtime</code>), `overrideSearchType: 'SEMANTIC'`, `numberOfResults: 3`, and returns ranked chunks.
The Lambda role `eduportal-lambda-role` needs the `EduportalBedrockResourcePolicy`
(`bedrock:Retrieve`, `bedrock:InvokeModel` on the KB/model ARNs).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Ingestion: *"Filterable metadata must have at most 2048 bytes"* | The index is immutable; **delete + recreate** the index with `AMAZON_BEDROCK_TEXT` + `AMAZON_BEDROCK_METADATA` as **non-filterable** metadata keys, then restart the ingestion |
| Ingestion: PDFs "throttled" (`349` parsing model) | Parse throttling is transient; re-run `start-ingestion-job` to pick up failed/missing files |
| `Retrieve` returns no results | Confirm the role has `s3vectors` read access and `bedrock:Retrieve` on the KB ARN |