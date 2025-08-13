### 🚀 DEPLOY SUCCESS

**Stage:** `development`
**App:** `fintech-app`
**Status:** `partial`

### 📊 Resource Changes

**Total Changes:** 4

| Resource | Action | Details |
|----------|---------|---------|
| `PaymentProcessor` | 🆕 Created | sst:aws:Function → PaymentProcessorLambda aws:lambda:Function |
| `UserAuth` | 🆕 Created | sst:aws:Auth → UserAuthIssuer sst:aws:Function |
| `NotificationService` | 📝 Updated | sst:aws:Function → NotificationServiceLambda aws:lambda:Function |
| `TransactionDB` | 🆕 Created | sst:aws:Dynamo → TransactionDBTable aws:dynamodb:Table |

### 🔗 Deployed URLs
- **api**: [https://payments.fintech-dev.local](https://payments.fintech-dev.local)
- **other**: [https://auth.fintech-dev.local/v1](https://auth.fintech-dev.local/v1)
- **web**: [https://webhook.fintech-dev.local/payments/stripe](https://webhook.fintech-dev.local/payments/stripe)

### 🖥️ SST Console

[View in SST Console](https://sst.dev/u/partial456) to see detailed resource information and logs.