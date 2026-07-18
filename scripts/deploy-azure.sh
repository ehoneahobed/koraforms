#!/usr/bin/env bash
#
# KoraForms — Azure Container Apps initial deployment
#
# Prerequisites:
#   - Azure CLI installed: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
#   - Logged in: az login
#   - Subscription selected: az account set --subscription <id>
#
# Usage:
#   ./scripts/deploy-azure.sh
#
# Environment variables (override defaults):
#   AZURE_LOCATION       — Azure region (default: eastus)
#   AZURE_RG             — Resource group name (default: koraforms-rg)
#   AZURE_ENV            — Container Apps environment (default: koraforms-env)
#   AZURE_APP            — Container app name (default: koraforms)
#   AZURE_STORAGE        — Storage account name (default: koraformsstorage)
#   KORA_AUTH_SECRET     — Auth JWT secret (generated if not set)
#
set -euo pipefail

# Defaults
LOCATION="${AZURE_LOCATION:-eastus}"
RG="${AZURE_RG:-koraforms-rg}"
ENV_NAME="${AZURE_ENV:-koraforms-env}"
APP_NAME="${AZURE_APP:-koraforms}"
STORAGE_NAME="${AZURE_STORAGE:-koraformsstorage}"
SHARE_NAME="koraforms-data"

# Generate auth secret if not provided
if [ -z "${KORA_AUTH_SECRET:-}" ]; then
  KORA_AUTH_SECRET=$(openssl rand -base64 48)
  echo "Generated KORA_AUTH_SECRET (save this):"
  echo "  $KORA_AUTH_SECRET"
  echo ""
fi

echo "==> Deploying KoraForms to Azure Container Apps"
echo "    Region: $LOCATION"
echo "    Resource Group: $RG"
echo "    App: $APP_NAME"
echo ""

# 1. Resource group
echo "==> Creating resource group..."
az group create \
  --name "$RG" \
  --location "$LOCATION" \
  --output none

# 2. Container Apps environment
echo "==> Creating Container Apps environment..."
az containerapp env create \
  --name "$ENV_NAME" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --output none 2>/dev/null || true

# 3. Storage account + file share (for SQLite persistence)
echo "==> Creating storage account..."
az storage account create \
  --name "$STORAGE_NAME" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --output none 2>/dev/null || true

echo "==> Creating file share..."
az storage share create \
  --name "$SHARE_NAME" \
  --account-name "$STORAGE_NAME" \
  --output none 2>/dev/null || true

# 4. Mount storage to environment
echo "==> Mounting storage to environment..."
STORAGE_KEY=$(az storage account keys list \
  --account-name "$STORAGE_NAME" \
  --resource-group "$RG" \
  --query "[0].value" -o tsv)

az containerapp env storage set \
  --name "$ENV_NAME" \
  --resource-group "$RG" \
  --storage-name "$STORAGE_NAME" \
  --azure-file-account-name "$STORAGE_NAME" \
  --azure-file-account-key "$STORAGE_KEY" \
  --azure-file-share-name "$SHARE_NAME" \
  --access-mode ReadWrite \
  --output none 2>/dev/null || true

# 5. Deploy container app (builds from source using Dockerfile)
echo "==> Deploying container app (building from source)..."
az containerapp up \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --environment "$ENV_NAME" \
  --source . \
  --target-port 3001 \
  --ingress external \
  --env-vars \
    "KORA_AUTH_SECRET=$KORA_AUTH_SECRET" \
    "DB_PATH=/data/koraforms-server.db" \
    "NODE_ENV=production"

# 6. Configure scale rules and volume mount
echo "==> Configuring scale and volume mount..."
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --min-replicas 0 \
  --max-replicas 3 \
  --output none

# Note: Volume mount via YAML is more reliable for Azure Files.
# If the volume mount didn't attach via `up`, apply it with:
#   az containerapp update --name $APP_NAME --resource-group $RG \
#     --yaml containerapp.yaml

# 7. Get the URL
echo ""
echo "==> Deployment complete!"
FQDN=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --query "properties.configuration.ingress.fqdn" -o tsv)
echo "    URL: https://$FQDN"
echo ""
echo "Next steps:"
echo "  - Set custom domain: az containerapp hostname add --name $APP_NAME --resource-group $RG --hostname your-domain.com"
echo "  - View logs: az containerapp logs show --name $APP_NAME --resource-group $RG --follow"
echo "  - Scale to Postgres: set DATABASE_URL env var, remove DB_PATH"
