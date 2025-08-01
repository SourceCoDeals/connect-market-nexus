#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('🧹 Starting console cleanup...');
  execSync('node scripts/final-console-cleanup.js', { stdio: 'inherit' });
  console.log('✅ Console cleanup completed successfully!');
} catch (error) {
  console.error('❌ Console cleanup failed:', error.message);
  process.exit(1);
}