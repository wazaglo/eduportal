# Bedrock permissions for the Lambda execution role

The `Ask`, `complete-upload` and `sync-knowledge-base` Lambdas need to (1) invoke
Bedrock models to refine answers, (2) apply a Bedrock Guardrail, and (3) run
semantic `Retrieve` against the Knowledge Base. The inline policy
**`EduportalBedrock`** on `eduportal-lambda-role` grants exactly those actions,
scoped to the KB and guardrail ARNs (account `814330181503`, region `eu-west-1`).

Account: `814330181503` | Region: `eu-west-1` | Guardrail id: `8tznv6byph2i` | KB id: `SSJQQYPJ4A`

## Policy document (JSON, attached as the inline policy `EduportalBedrock`)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockModelsAndInferenceProfiles",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "*"
    },
    {
      "Sid": "KnowledgeBaseRetrieval",
      "Effect": "Allow",
      "Action": ["bedrock:Retrieve", "bedrock:StartRetrieval"],
      "Resource": "arn:aws:bedrock:eu-west-1:814330181503:knowledge-base/SSJQQYPJ4A"
    },
    {
      "Sid": "Guardrails",
      "Effect": "Allow",
      "Action": ["bedrock:ApplyGuardrail"],
      "Resource": "arn:aws:bedrock:eu-west-1:814330181503:guardrail/8tznv6byph2i"
    }
  ]
}
```

## Apply / verify from the CLI

```bash
# Apply (keeps the inline policy attached to the role)
aws iam put-role-policy \
  --role-name eduportal-lambda-role \
  --policy-name EduportalBedrock \
  --policy-document file://infra/ai/lambda-bedrock-policy.json \
  --profile terrence --region eu-west-1

# Verify
aws iam get-role-policy --role-name eduportal-lambda-role --policy-name EduportalBedrock \
  --profile terrence --region eu-west-1 --query PolicyDocument --output json
```

## How the code uses these permissions

| Call | SDK action | Principal | ARN scope |
|------|-----------|-----------|-----------|
| `KnowledgeService.searchKnowledgeBase` | `bedrock:Retrieve` | `eduportal-lambda-role` | knowledge-base `SSJQQYPJ4A` |
| `BedrockProvider.generateResponse` | `bedrock:InvokeModel` | `eduportal-lambda-role` | foundation/inference-profile ARNs (`*`) |
| `BedrockProvider` guardrail check | `bedrock:ApplyGuardrail` | `eduportal-lambda-role` | guardrail `8tznv6byph2i` |
| `KnowledgeBase complete-upload / sync` ingestion job | `bedrock:StartIngestionJob` (plus model invoke by the KB service role) | `eduportal-bedrock-kb-role` | see `bedrock-knowledge-base-role.yml` |

> The Knowledge Base **ingestion job** runs under the *KB service role*
> (`eduportal-bedrock-kb-role`) defined in `bedrock-knowledge-base-role.yml`, not
> the Lambda role. The Lambda role only needs `Retrieve` to query the KB.
