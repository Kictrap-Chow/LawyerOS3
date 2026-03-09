#!/bin/bash

# Ensure we are in the directory where the script is located
cd "$(dirname "$0")" || exit

echo "🚀 Starting LawyerOS..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first: https://nodejs.org/"
    exit 1
fi

# Check if dependencies are valid for this OS
# If vite binary is missing or not executable, reinstall
if [ -d "node_modules" ] && [ ! -x "node_modules/.bin/vite" ]; then
    echo "⚠️  Dependencies seem to be from another computer (OS mismatch)."
    echo "🗑️  Cleaning up and reinstalling..."
    rm -rf node_modules
fi

# Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the application
echo "🌐 Opening application..."
npm run dev
