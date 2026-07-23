# KoraForms — Azure Deployment Plan

Step-by-step guide to deploy KoraForms to Azure Container Apps for public release.

---

## Prerequisites

- [ ] Azure account with active subscription ([free tier works](https://azure.microsoft.com/free/))
- [ ] Azure CLI installed: `brew install azure-cli` (macOS) or [other platforms](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- [ ] GitHub repo access (to add secrets for CI/CD)
- [ ] PostgreSQL connection string for production persistence

KoraForms is offline-first, but production sync still needs durable server storage. Use PostgreSQL for public deployments. Do not use SQLite on Azure Files; SMB locking semantics are not safe for SQLite.

---

## Step 1: Login to Azure CLI

```bash
az login
az account list --output table          # verify subscription
az account set --subscription <SUB_ID>  # select if multiple
```

---

## Step 2: Prepare Production Secrets

Generate long random values and keep them in your password manager:

```bash
openssl rand -base64 48 # KORA_AUTH_SECRET
openssl rand -base64 48 # KORA_METRICS_TOKEN
```

Required runtime values:

| Name | Required | Purpose |
|------|----------|---------|
| `KORA_AUTH_SECRET` | Yes | JWT/session signing secret |
| `KORA_METRICS_TOKEN` | Yes | Bearer token for `/api/ops/diagnostics` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PUBLIC_URL` | Recommended | Canonical production origin for links/meta |

Launch scaling:

- KoraForms intentionally deploys with `maxReplicas=1` by default for the first public release.
- This keeps public response quotas and in-memory request throttles deterministic while Kora adds framework-level conditional admission/transaction support.
- Do not increase `AZURE_MAX_REPLICAS` for forms that promise hard `maxResponses` limits until that framework support lands.

## Step 3: Run Initial Deployment Script

```bash
cd /Users/ehoneahobed/Work/koraforms

KORA_AUTH_SECRET='<generated-secret>' \
KORA_METRICS_TOKEN='<generated-token>' \
DATABASE_URL='postgresql://user:password@host:5432/koraforms?sslmode=require' \
PUBLIC_URL='https://your-production-domain.com' \
./scripts/deploy-azure.sh
```

This creates the resource group, Container Apps environment, container app, runtime secrets, and production env vars.

For a disposable demo only, you can bypass PostgreSQL:

```bash
ALLOW_EPHEMERAL_SQLITE=true ./scripts/deploy-azure.sh
```

Do not use that for public release. Container replacement will lose data.

---

## Step 4: Verify Deployment

```bash
# Check the app is running
curl https://<YOUR_APP_URL>/health

# Check protected operational diagnostics
curl -H "Authorization: Bearer <KORA_METRICS_TOKEN>" \
  https://<YOUR_APP_URL>/api/ops/diagnostics

# View logs if something's wrong
az containerapp logs show --name koraforms --resource-group koraforms-rg --follow
```

Visit the URL in a browser. You should see the KoraForms landing page.

---

## Step 5: Set Up CI/CD (auto-deploy on push)

The workflow in `.github/workflows/deploy.yml` uses GitHub Actions OIDC with `azure/login@v2`.

### 5a. Create an Entra ID App for GitHub OIDC

```bash
SUB_ID=$(az account show --query id -o tsv)

APP_ID=$(az ad app create --display-name "koraforms-github-actions" --query appId -o tsv)
OBJECT_ID=$(az ad app show --id "$APP_ID" --query id -o tsv)

az ad sp create --id "$APP_ID"

az role assignment create \
  --assignee "$APP_ID" \
  --role contributor \
  --scope "/subscriptions/$SUB_ID/resourceGroups/koraforms-rg"
```

Add a federated credential for this repo and branch:

```bash
az ad app federated-credential create \
  --id "$OBJECT_ID" \
  --parameters '{
    "name": "github-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:ehoneahobed/koraforms:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

### 5b. Add GitHub Secrets

| Secret name | Value |
|-------------|-------|
| `AZURE_CLIENT_ID` | `$APP_ID` |
| `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | `$SUB_ID` |

### 5c. Add GitHub Environment Variables

Go to: **Settings → Environments → production → Variables**

| Variable | Value | Purpose |
|----------|-------|---------|
| `AZURE_RG` | `koraforms-rg` | Resource group (only if non-default) |
| `AZURE_APP` | `koraforms` | Container app name |
| `AZURE_ENV` | `koraforms-env` | Environment name |
| `PUBLIC_URL` | `https://your-production-domain.com` | Canonical app URL |

The actual app runtime secrets live in Azure Container Apps, not GitHub:

```bash
az containerapp secret set \
  --name koraforms \
  --resource-group koraforms-rg \
  --secrets \
    kora-auth-secret='<KORA_AUTH_SECRET>' \
    kora-metrics-token='<KORA_METRICS_TOKEN>' \
    database-url='<DATABASE_URL>'
```

After this, every push to `main` will: typecheck → build → deploy automatically.

---

## Step 6: Custom Domain

```bash
# Add your domain
az containerapp hostname add \
  --name koraforms \
  --resource-group koraforms-rg \
  --hostname koraforms.yourdomain.com

# Get the verification TXT and CNAME values
az containerapp hostname list \
  --name koraforms \
  --resource-group koraforms-rg \
  --output table
```

Then add DNS records at your registrar:
- `TXT` record for domain verification
- `CNAME` pointing to `koraforms.<region>.azurecontainerapps.io`

Azure provides free managed TLS certificates automatically.

---

## Step 7: PostgreSQL Setup Example

If you do not already have PostgreSQL:

```bash
# Create Postgres Flexible Server (~$12/mo burstable)
az postgres flexible-server create \
  --name koraforms-db \
  --resource-group koraforms-rg \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --admin-user koraadmin \
  --admin-password '<STRONG_PASSWORD>' \
  --version 16

# Get connection string
PG_HOST=$(az postgres flexible-server show --name koraforms-db --resource-group koraforms-rg --query fullyQualifiedDomainName -o tsv)

# Store the connection string as a Container Apps secret
az containerapp secret set \
  --name koraforms \
  --resource-group koraforms-rg \
  --secrets "database-url=postgresql://koraadmin:<PASSWORD>@${PG_HOST}:5432/koraforms?sslmode=require"

# Bind the runtime env var to the secret
az containerapp update \
  --name koraforms \
  --resource-group koraforms-rg \
  --set-env-vars "DATABASE_URL=secretref:database-url"
```

---

## Useful Commands

```bash
# View app status
az containerapp show --name koraforms --resource-group koraforms-rg --query "{state:properties.runningStatus, url:properties.configuration.ingress.fqdn}" -o table

# View live logs
az containerapp logs show --name koraforms --resource-group koraforms-rg --follow

# Restart
az containerapp revision restart --name koraforms --resource-group koraforms-rg

# Update env var
az containerapp update --name koraforms --resource-group koraforms-rg \
  --set-env-vars "KEY=value"

# Update secrets
az containerapp secret set --name koraforms --resource-group koraforms-rg \
  --secrets kora-metrics-token='<new-token>'

# Scale manually
az containerapp update --name koraforms --resource-group koraforms-rg \
  --min-replicas 1 --max-replicas 5

# Check costs
az cost-management query --type ActualCost --timeframe MonthToDate \
  --dataset-filter "{\"dimensions\":{\"name\":\"ResourceGroup\",\"operator\":\"In\",\"values\":[\"koraforms-rg\"]}}"

# Tear down everything (destructive!)
# az group delete --name koraforms-rg --yes
```

---

## Migrating Away (to AWS or GCP)

The app is fully portable. Nothing Azure-specific is in the code.

### To AWS (ECS Fargate or App Runner)

```bash
# Push image to ECR
aws ecr create-repository --repository-name koraforms
docker build -t koraforms .
docker tag koraforms:latest <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/koraforms
docker push <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/koraforms

# Deploy with App Runner (simplest)
aws apprunner create-service \
  --service-name koraforms \
  --source-configuration '{"ImageRepository":{"ImageIdentifier":"<ECR_URI>:latest","ImageRepositoryType":"ECR"}}'
```

For persistence: use RDS Postgres (`DATABASE_URL`).

### To GCP (Cloud Run)

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/<PROJECT>/koraforms

# Deploy
gcloud run deploy koraforms \
  --image gcr.io/<PROJECT>/koraforms \
  --port 3001 \
  --allow-unauthenticated \
  --set-env-vars "KORA_AUTH_SECRET=...,KORA_METRICS_TOKEN=...,DATABASE_URL=..."
```

For persistence: Cloud SQL Postgres (`DATABASE_URL`).

---

## Cost Summary

| Traffic | Config | Monthly Cost |
|---------|--------|-------------|
| Demo only | Ephemeral SQLite, 1 replica | ~$5 |
| Low (<1k users) | 1 replica + Postgres | ~$15–25 |
| Medium (<10k users) | Auto-scale + Postgres | ~$25–50 |
| High (>10k users) | Multi-replica + tuned Postgres | Depends on workload |
