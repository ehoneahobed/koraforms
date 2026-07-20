#!/usr/bin/env bash
#
# KoraForms — Azure Container Apps deployment
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
#   KORA_AUTH_SECRET     — Auth JWT secret (generated if not set)
#
# Note: SQLite + Azure Files (SMB) is incompatible due to POSIX locking.
# The app uses ephemeral storage (data lives as long as the container).
# For production persistence, set DATABASE_URL to a PostgreSQL connection string.
#
set -euo pipefail

# Defaults
LOCATION="${AZURE_LOCATION:-eastus}"
RG="${AZURE_RG:-koraforms-rg}"
ENV_NAME="${AZURE_ENV:-koraforms-env}"
APP_NAME="${AZURE_APP:-koraforms}"

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

# 0. Ensure required providers are registered
echo "==> Registering resource providers (if needed)..."
for provider in Microsoft.Storage Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry Microsoft.Web; do
  state=$(az provider show --namespace "$provider" --query "registrationState" -o tsv 2>/dev/null || echo "NotRegistered")
  if [ "$state" != "Registered" ]; then
    echo "    Registering $provider..."
    az provider register --namespace "$provider"
    while [ "$(az provider show --namespace "$provider" --query "registrationState" -o tsv)" != "Registered" ]; do
      echo "    Waiting for $provider..."
      sleep 10
    done
    echo "    $provider registered."
  fi
done

# 1. Resource group
echo "==> Creating resource group..."
az group create \
  --name "$RG" \
  --location "$LOCATION" \
  --output none

# 2. Container Apps environment
echo "==> Creating Container Apps environment..."
if ! az containerapp env show --name "$ENV_NAME" --resource-group "$RG" --output none 2>/dev/null; then
  az containerapp env create \
    --name "$ENV_NAME" \
    --resource-group "$RG" \
    --location "$LOCATION" \
    --output none
fi

# 3. Deploy container app (builds from source using Dockerfile)
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

# 4. Keep exactly 1 replica (prevent scale-to-zero data loss with ephemeral SQLite)
echo "==> Configuring scale..."
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --min-replicas 1 \
  --max-replicas 1 \
  --output none

# 5. Get the URL
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
echo "  - For persistent data: set DATABASE_URL env var pointing to PostgreSQL"
