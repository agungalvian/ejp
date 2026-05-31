#!/bin/sh
set -e

echo "🚀 Synchronizing database schema via Prisma db push..."
npx prisma db push --skip-generate

echo "🌱 Running database seeder..."
node dist/prisma/seed.js

echo "✅ Starting server..."
exec node dist/src/index.js
