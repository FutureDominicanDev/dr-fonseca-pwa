#!/bin/bash
# One-command deploy script for Dr. Fonseca PWA
# Usage: Just run this file in Terminal after Claude makes changes

cd "/Users/rmd/Documents/dr-fonseca-pwa/recovered-repo"

echo "📦 Staging all changes..."
git add .

echo "💾 Committing..."
git commit -m "Update: $(date '+%Y-%m-%d %H:%M') - Claude changes"

echo "🚀 Pushing to GitHub (Vercel will auto-deploy)..."
git push

echo ""
echo "✅ Done! Check Vercel in 1-2 minutes for the live update."
