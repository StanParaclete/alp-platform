#!/bin/bash
echo "Starting ALP Web App on http://localhost:3000"
cd "$(dirname "$0")/02-webapp"
npm run dev
