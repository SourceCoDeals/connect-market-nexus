#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Final comprehensive production cleanup script
 * Removes ALL remaining console.log statements while preserving error logging
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

  // More comprehensive patterns to catch ALL console.log statements
  const debugPatterns = [
    // All console.log statements regardless of content
    /^\s*console\.log\([^)]*\);\s*$/gm,
    
    // Multi-line console.log statements
    /console\.log\(\s*[^)]*\s*\);\s*$/gm,
    
    // Console.log with any emoji
    /console\.log\(['"`][^'"`]*[\u{1F300}-\u{1F9FF}][^'"`]*['"`][^)]*\);?\s*\n?/gu,
    
    // Console.log with template literals
    /console\.log\(`[^`]*`[^)]*\);?\s*\n?/g,
    
    // Console.log with string and variables
    /console\.log\(['"`][^'"`]*['"`],\s*[^)]+\);?\s*\n?/g,
    
    // Console.log with object logging
    /console\.log\(['"`][^'"`]*['"`],\s*\{[^}]*\}\);?\s*\n?/g,
    
    // Console.log with any debug keywords
    /console\.log\(['"`].*(?:Test|Debug|Mobile|Processing|Sending|Email|Successfully|Admin|Fetching|Retrieved|Updated|Updating|Created|Creating|Deleting|Uploading|Auth|Loading|Waiting|Navigation|Listing|Request|User|✅|🔍|📧|🚀|🧹|🔐|📊|⏳|🎯).*['"`][^)]*\);?\s*\n?/gi,
    
    // Any remaining console.log with parentheses
    /console\.log\([^)]*\);?\s*$/gm
  ];

  // Apply all patterns
  debugPatterns.forEach((pattern, index) => {
    const beforeCount = (modified.match(pattern) || []).length;
    if (beforeCount > 0) {
      modified = modified.replace(pattern, '');
      removedCount += beforeCount;
    }
  });

  // Clean up any empty lines left behind
  modified = modified.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  // Remove trailing whitespace
  modified = modified.replace(/[ \t]+$/gm, '');

  if (removedCount > 0) {
    fs.writeFileSync(filePath, modified);
    return { cleaned: true, count: removedCount };
  }

  return { cleaned: false, count: 0 };
}

function main() {
  console.log('🧹 Starting FINAL comprehensive production cleanup...');
  
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
        console.log(`✅ ${path.relative(process.cwd(), file)}: ${result.count} console.log statements removed`);
      }
    } catch (error) {
      errors.push({ file, error: error.message });
      console.error(`❌ ${path.relative(process.cwd(), file)}: ${error.message}`);
    }
  }

  console.log('\n📊 Final Cleanup Summary:');
  console.log(`📁 Files processed: ${files.length}`);
  console.log(`✏️ Files modified: ${filesModified}`);
  console.log(`🗑️ Console.log statements removed: ${totalCleaned}`);
  console.log(`❌ Errors: ${errors.length}`);
  
  if (errors.length === 0 && totalCleaned > 0) {
    console.log('\n🎉 ALL console.log statements successfully removed for production!');
    process.exit(0);
  } else if (totalCleaned === 0) {
    console.log('\n✅ No console.log statements found - already clean!');
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