# KoraForms — Azure Deployment Plan

Step-by-step guide to deploy KoraForms to Azure Container Apps. Total time: ~15 minutes.

---

## Prerequisites

- [ ] Azure account with active subscription ([free tier works](https://azure.microsoft.com/free/))
- [ ] Azure CLI installed: `brew install azure-cli` (macOS) or [other platforms](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- [ ] GitHub repo access (to add secrets for CI/CD)

---

## Step 1: Login to Azure CLI

```bash
az login
az account list --output table          # verify subscription
az account set --subscription <SUB_ID>  # select if multiple
```

---

## Step 2: Run Initial Deployment Script

```bash
cd /Users/ehoneahobed/Work/koraforms
./scripts/deploy-azure.sh
```

This creates everything: resource group, storage, container app. Takes ~3-5 minutes.

**Save the output** — it prints:
- The generated `KORA_AUTH_SECRET` (you'll need it if redeploying)
- The app URL (e.g., `https://koraforms.something.azurecontainerapps.io`)

---

## Step 3: Verify Deployment

```bash
# Check the app is running
curl https://<YOUR_APP_URL>/health

# View logs if something's wrong
az containerapp logs show --name koraforms --resource-group koraforms-rg --follow
```

Visit the URL in a browser. You should see the KoraForms landing page.

---

## Step 4: Set Up CI/CD (auto-deploy on push)

### 4a. Create a Service Principal

```bash
SUB_ID=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name "koraforms-deploy" \
  --role contributor \
  --scopes "/subscriptions/$SUB_ID/resourceGroups/koraforms-rg" \
  --json-auth
```

Copy the entire JSON output.

### 4b. Add GitHub Secrets

Go to: **GitHub repo → Settings → Secrets and variables → Actions**

| Secret name | Value |
|-------------|-------|
| `AZURE_CREDENTIALS` | The JSON from step 4a |

### 4c. (Optional) Add GitHub Variables

Go to: **Settings → Environments → production → Add variable**

| Variable | Value | Purpose |
|----------|-------|---------|
| `AZURE_RG` | `koraforms-rg` | Resource group (only if non-default) |
| `AZURE_APP` | `koraforms` | Container app name |
| `AZURE_ENV` | `koraforms-env` | Environment name |

After this, every push to `main` will: typecheck → build → deploy automatically.

---

## Step 5: Custom Domain (Optional)

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

## Step 6: Upgrade to Postgres (When Needed)

When you outgrow SQLite (multiple replicas, >50k responses, need backups):

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

# Update the container app — switch from SQLite to Postgres
az containerapp update \
  --name koraforms \
  --resource-group koraforms-rg \
  --set-env-vars \
    "DATABASE_URL=postgresql://koraadmin:<PASSWORD>@${PG_HOST}:5432/koraforms" \
  --remove-env-vars DB_PATH
```

No code changes needed — the app detects `DATABASE_URL` and switches automatically.

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

# Scale manually (override auto-scale)
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

For persistence: EFS volume mount or switch to RDS Postgres (`DATABASE_URL`).

### To GCP (Cloud Run)

```bash
# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/<PROJECT>/koraforms

# Deploy
gcloud run deploy koraforms \
  --image gcr.io/<PROJECT>/koraforms \
  --port 3001 \
  --allow-unauthenticated \
  --set-env-vars "KORA_AUTH_SECRET=...,DB_PATH=/data/koraforms-server.db"
```

For persistence: Cloud SQL Postgres (`DATABASE_URL`) — Cloud Run doesn't support persistent volumes well.

---

## Cost Summary

| Traffic | Config | Monthly Cost |
|---------|--------|-------------|
| Idle/hobby | Scale-to-zero + SQLite | $0–2 |
| Low (<1k users) | 1 replica + SQLite | ~$5 |
| Medium (<10k users) | Auto-scale + Postgres | ~$20 |
| High (>10k users) | Multi-replica + Postgres | ~$40+ |
