#!/usr/bin/env bash
# Builds the image, loads it into a local kind cluster and installs the Helm chart.
set -e

CLUSTER=mini-lead-crm
IMAGE=mini-lead-crm:local

cd "$(dirname "$0")"

# gets DB_USER and DB_PASSWORD from the .env file (not committed to git)
source .env

docker build -t $IMAGE .

# create the cluster only if it does not exist yet
if ! kind get clusters | grep -qx $CLUSTER; then
  kind create cluster --config kind-config.yaml
fi

# kind cannot see local docker images, so we load it in
kind load docker-image $IMAGE --name $CLUSTER

helm upgrade --install mini-lead-crm ./helm/mini-lead-crm \
  --set db.user="$DB_USER" \
  --set db.password="$DB_PASSWORD" \
  --wait --timeout 3m

echo "Done. Open the app with: kubectl port-forward svc/mini-lead-crm-app 3000:3000"
