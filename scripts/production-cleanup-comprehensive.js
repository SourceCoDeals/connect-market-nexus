#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Comprehensive production cleanup script
 * Removes debug console.log statements while preserving error logging
 */

function findFiles(dir, extensions = ['.ts', '.tsx'], excludes = ['node_modules', '.git', 'dist']) {
  const files = [];
  
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && !excludes.includes(entry.name)) {
        walk(fullPath);
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function cleanupFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = content;
  let removedCount = 0;

  // Pattern for debug console.log statements (preserve console.error/warn/info for production logging)
  const debugPatterns = [
    // Debug console.log with emojis or debug markers
    /console\.log\(['"`][^'"`]*(?:🧪|🎛️|🚪|👁️|🔍|📧|📄|📏|✅|🔍|❌|📦|🧭|🚫|⏳|⏰|✅|🧹|🎯|🏪|🔐|📊|📎|🚀)[^'"`]*['"`][^)]*\);?\s*\n?/g,
    
    // Console.log with specific debug prefixes
    /console\.log\(['"`](?:Test|Debug|Mobile:|Processing|Sending|Email sent|successfully)[^'"`]*['"`][^)]*\);?\s*\n?/g,
    
    // Template literal console.log statements
    /console\.log\(`[^`]*(?:🧪|🎛️|🚪|👁️|🔍|📧|📄|📏|✅|🔍|❌|📦|🧭|🚫|⏳|⏰|✅|🧹|🎯|🏪|🔐|📊|📎|🚀)[^`]*`[^)]*\);?\s*\n?/g,
    
    // Simple debug console.log
    /console\.log\([^)]*\);\s*$/gm,
    
    // Console.log with variables for debugging
    /console\.log\(['"`][^'"`]*['"`],\s*[^)]+\);?\s*\n?/g
  ];

  debugPatterns.forEach(pattern => {
    const matches = modified.match(pattern);
    if (matches) {
      removedCount += matches.length;
      modified = modified.replace(pattern, '// Debug log removed\n');
    }
  });

  // Clean up multiple consecutive comment lines
  modified = modified.replace(/(\/\/ Debug log removed\s*\n){2,}/g, '// Debug log removed\n');

  if (removedCount > 0) {
    fs.writeFileSync(filePath, modified);
    return { cleaned: true, count: removedCount };
  }

  return { cleaned: false, count: 0 };
}

function main() {
  console.log('🧹 Starting comprehensive production cleanup...');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = findFiles(srcDir);
  
  let totalCleaned = 0;
  let filesModified = 0;
  const errors = [];

  for (const file of files) {
    try {
      const result = cleanupFile(file);
      if (result.cleaned) {
        filesModified++;
        totalCleaned += result.count;
        console.log(`✅ ${path.relative(process.cwd(), file)}: ${result.count} debug logs removed`);
      }
    } catch (error) {
      errors.push({ file, error: error.message });
      console.error(`❌ ${path.relative(process.cwd(), file)}: ${error.message}`);
    }
  }

  console.log('\n📊 Cleanup Summary:');
  console.log(`📁 Files processed: ${files.length}`);
  console.log(`✏️ Files modified: ${filesModified}`);
  console.log(`🗑️ Debug logs removed: ${totalCleaned}`);
  console.log(`❌ Errors: ${errors.length}`);
  
  if (errors.length === 0) {
    console.log('\n🎉 Production cleanup completed successfully!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some files had errors during cleanup');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { cleanupFile, findFiles };