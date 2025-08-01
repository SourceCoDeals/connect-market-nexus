#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Removes ALL console.log statements from TypeScript/React files
 * Preserves console.error, console.warn, console.info for production logging
 */

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Remove all console.log statements with various patterns
    content = content.replace(/^\s*console\.log\([^)]*\);\s*$/gm, '');
    content = content.replace(/console\.log\([^)]*\);\s*/g, '');
    content = content.replace(/console\.log\(`[^`]*`[^)]*\);\s*/g, '');
    content = content.replace(/console\.log\(['"][^'"]*['"][^)]*\);\s*/g, '');
    
    // Clean up empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    const changed = originalContent !== content;
    
    if (changed) {
      fs.writeFileSync(filePath, content);
      const removedCount = (originalContent.match(/console\.log/g) || []).length - 
                          (content.match(/console\.log/g) || []).length;
      return { changed: true, removedCount };
    }
    
    return { changed: false, removedCount: 0 };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { changed: false, removedCount: 0, error: error.message };
  }
}

function walkDirectory(dir) {
  const files = [];
  
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

// Main execution
const srcDir = path.join(process.cwd(), 'src');
const files = walkDirectory(srcDir);

let totalRemoved = 0;
let filesChanged = 0;

console.log('🧹 Removing all console.log statements...\n');

files.forEach(file => {
  const result = processFile(file);
  if (result.changed) {
    filesChanged++;
    totalRemoved += result.removedCount;
    console.log(`✅ ${path.relative(process.cwd(), file)}: ${result.removedCount} removed`);
  }
});

console.log('\n📊 Summary:');
console.log(`Files processed: ${files.length}`);
console.log(`Files changed: ${filesChanged}`);
console.log(`Console.log statements removed: ${totalRemoved}`);
console.log('\n🎉 Production cleanup complete!');