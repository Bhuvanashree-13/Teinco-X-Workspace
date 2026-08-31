#!/bin/bash
set -e

echo "=========================================="
echo "Teinco-X Finance - Setup Script"
echo "=========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Found: $(node -v)"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Push database schema
echo "💾 Setting up local SQLite database..."
npx prisma db push

echo ""
echo "=========================================="
echo "✅ Setup complete!"
echo "=========================================="
echo ""
echo "To start the application, run:"
echo "  npm run dev"
echo ""
echo "Then open your browser to:"
echo "  Frontend: http://localhost:5173"
echo "  API:      http://localhost:3001/api/health"
echo ""
echo "Database location:"
echo "  ./prisma/teinco_finance.db"
echo ""
