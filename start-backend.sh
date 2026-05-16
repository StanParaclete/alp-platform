#!/bin/bash
echo "Starting ALP Backend API on http://localhost:4000"
cd "$(dirname "$0")/05-backend"
npm run dev
