#!/usr/bin/env bash
set -euo pipefail

# ---- config (change if needed) ----
PROJECT_ID="tender-ops-187db"
REGION="europe-west8"                # Milan
REPO="app-images"
IMAGE="gmail-subscriber-service"
SERVICE="gmail-subscriber"

# ---- one-time setup (APIs & repo) ----
gcloud config set project "${PROJECT_ID}"
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com

# Create the Artifact Registry repository if it doesn't exist
if ! gcloud artifacts repositories describe "${REPO}" --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}"     --repository-format=docker     --location="${REGION}"     --description="App images"
fi

# ---- build & push ----
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:latest"
gcloud builds submit --tag "${IMAGE_URL}" .

# ---- deploy to Cloud Run ----
gcloud run deploy "${SERVICE}"   --image "${IMAGE_URL}"   --region "${REGION}"   --platform managed   --allow-unauthenticated=false   --port 8080

echo "Deployed. Image URL: ${IMAGE_URL}"
