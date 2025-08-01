#!/usr/bin/env node

/**
 * Production Cleanup Script
 * Removes all console.log statements from production code
 */

const fs = require('fs');
const path = require('path');

function findFilesToCleanup(dir, extensions = ['.ts', '.tsx'], excludes = ['node_modules', '.git', 'dist', 'build']) {
  const files = [];
  
  function scanDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !excludes.includes(item)) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  scanDirectory(dir);
  return files;
}

function cleanupConsoleLogsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Match console.log statements (including multiline)
  const consoleLogPattern = /console\.log\s*\([^;]*\);?/g;
  
  // Count original console.log statements
  const originalCount = (content.match(consoleLogPattern) || []).length;
  
  if (originalCount === 0) return { cleaned: false, count: 0 };
  
  // Replace console.log with comments
  const cleanedContent = content.replace(consoleLogPattern, (match) => {
    // Extract the main message for the comment
    const messageMatch = match.match(/console\.log\s*\(\s*['"`]([^'"`]*)/);
    const message = messageMatch ? messageMatch[1].replace(/[🔍📧✅⏳🧪🚀🎛️📄📏🔄🚪📦🧭🚫⏰🧹👁️]/g, '').trim() : 'Debug log removed';
    return `// ${message}`;
  });
  
  fs.writeFileSync(filePath, cleanedContent, 'utf8');
  
  // Verify cleanup
  const verificationContent = fs.readFileSync(filePath, 'utf8');
  const remainingCount = (verificationContent.match(consoleLogPattern) || []).length;
  
  return { 
    cleaned: true, 
    count: originalCount,
    remaining: remainingCount,
    success: remainingCount === 0
  };
}

function main() {
  console.log('🧹 Starting production cleanup...');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = findFilesToCleanup(srcDir);
  
  let totalCleaned = 0;
  let filesModified = 0;
  let errors = [];
  
  for (const file of files) {
    try {
      const result = cleanupConsoleLogsInFile(file);
      if (result.cleaned) {
        filesModified++;
        totalCleaned += result.count;
        
        if (result.success) {
          console.log(`✅ ${path.relative(process.cwd(), file)}: ${result.count} console.log statements cleaned`);
        } else {
          console.log(`⚠️  ${path.relative(process.cwd(), file)}: ${result.count} cleaned, ${result.remaining} remaining`);
        }
      }
    } catch (error) {
      errors.push({ file, error: error.message });
      console.error(`❌ Error processing ${file}: ${error.message}`);
    }
  }
  
  console.log('\n📊 Cleanup Summary:');
  console.log(`   Files processed: ${files.length}`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Console.log statements removed: ${totalCleaned}`);
  console.log(`   Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.forEach(({ file, error }) => {
      console.log(`   ${path.relative(process.cwd(), file)}: ${error}`);
    });
  }
  
  console.log('\n✅ Production cleanup completed!');
}

if (require.main === module) {
  main();
}

module.exports = { cleanupConsoleLogsInFile, findFilesToCleanup };