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
#   KORA_METRICS_TOKEN   — Bearer token for /api/ops/diagnostics (generated if not set)
#   DATABASE_URL         — PostgreSQL connection string for production persistence
#   PUBLIC_URL           — Public origin, e.g. https://forms.example.com
#   ALLOW_EPHEMERAL_SQLITE=true — allow non-production ephemeral SQLite deployment
#
# Note: SQLite + Azure Files (SMB) is incompatible due to POSIX locking.
# Public releases must use PostgreSQL. Ephemeral SQLite is only acceptable for demos.
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

if [ -z "${KORA_METRICS_TOKEN:-}" ]; then
  KORA_METRICS_TOKEN=$(openssl rand -base64 48)
  echo "Generated KORA_METRICS_TOKEN (save this):"
  echo "  $KORA_METRICS_TOKEN"
  echo ""
fi

if [ -z "${DATABASE_URL:-}" ] && [ "${ALLOW_EPHEMERAL_SQLITE:-false}" != "true" ]; then
  cat >&2 <<'EOF'
DATABASE_URL is required for a public release deployment.

Azure Container Apps filesystem storage is not durable enough for production
KoraForms data, and SQLite on Azure Files is unsafe because SMB does not provide
the locking semantics SQLite relies on.

Set DATABASE_URL to a PostgreSQL connection string, or run a temporary demo with:
  ALLOW_EPHEMERAL_SQLITE=true ./scripts/deploy-azure.sh
EOF
  exit 1
fi

echo "==> Deploying KoraForms to Azure Container Apps"
echo "    Region: $LOCATION"
echo "    Resource Group: $RG"
echo "    App: $APP_NAME"
if [ -n "${DATABASE_URL:-}" ]; then
  echo "    Database: PostgreSQL"
else
  echo "    Database: ephemeral SQLite (demo only)"
fi
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
ENV_VARS=(
  "KORA_AUTH_SECRET=$KORA_AUTH_SECRET"
  "KORA_METRICS_TOKEN=$KORA_METRICS_TOKEN"
  "NODE_ENV=production"
)

if [ -n "${PUBLIC_URL:-}" ]; then
  ENV_VARS+=("PUBLIC_URL=$PUBLIC_URL")
fi

if [ -n "${DATABASE_URL:-}" ]; then
  ENV_VARS+=("DATABASE_URL=$DATABASE_URL")
else
  ENV_VARS+=("DB_PATH=/tmp/koraforms-server.db")
fi

az containerapp up \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --environment "$ENV_NAME" \
  --source . \
  --target-port 3001 \
  --ingress external \
  --env-vars "${ENV_VARS[@]}"

echo "==> Storing runtime secrets in Container Apps..."
SECRET_ARGS=(
  "kora-auth-secret=$KORA_AUTH_SECRET"
  "kora-metrics-token=$KORA_METRICS_TOKEN"
)
if [ -n "${DATABASE_URL:-}" ]; then
  SECRET_ARGS+=("database-url=$DATABASE_URL")
fi

az containerapp secret set \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --secrets "${SECRET_ARGS[@]}" \
  --output none

SECRET_ENV_VARS=(
  "KORA_AUTH_SECRET=secretref:kora-auth-secret"
  "KORA_METRICS_TOKEN=secretref:kora-metrics-token"
  "NODE_ENV=production"
)

if [ -n "${PUBLIC_URL:-}" ]; then
  SECRET_ENV_VARS+=("PUBLIC_URL=$PUBLIC_URL")
fi

if [ -n "${DATABASE_URL:-}" ]; then
  SECRET_ENV_VARS+=("DATABASE_URL=secretref:database-url")
  az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RG" \
    --remove-env-vars DB_PATH \
    --set-env-vars "${SECRET_ENV_VARS[@]}" \
    --output none
else
  SECRET_ENV_VARS+=("DB_PATH=/tmp/koraforms-server.db")
  az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RG" \
    --set-env-vars "${SECRET_ENV_VARS[@]}" \
    --output none
fi

# 4. Configure scale.
echo "==> Configuring scale..."
if [ -n "${DATABASE_URL:-}" ]; then
  az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RG" \
    --min-replicas "${AZURE_MIN_REPLICAS:-1}" \
    --max-replicas "${AZURE_MAX_REPLICAS:-5}" \
    --output none
else
  az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RG" \
    --min-replicas 1 \
    --max-replicas 1 \
    --output none
fi

# 5. Get the URL
echo ""
echo "==> Deployment complete!"
FQDN=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RG" \
  --query "properties.configuration.ingress.fqdn" -o tsv)
echo "    URL: https://$FQDN"
echo ""
echo "==> Health check..."
curl -fsS "https://$FQDN/health" >/dev/null
echo "    /health OK"
echo ""
echo "Next steps:"
echo "  - Set custom domain: az containerapp hostname add --name $APP_NAME --resource-group $RG --hostname your-domain.com"
echo "  - View logs: az containerapp logs show --name $APP_NAME --resource-group $RG --follow"
echo "  - Test diagnostics: curl -H \"Authorization: Bearer <KORA_METRICS_TOKEN>\" https://$FQDN/api/ops/diagnostics"
