#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function cleanupFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Remove all console.log patterns while preserving console.error, console.warn, console.info
    content = content.replace(/^\s*console\.log\([^)]*\);\s*$/gm, '');
    content = content.replace(/console\.log\([^)]*\);\s*/g, '');
    content = content.replace(/console\.log\([^)]*\),?\s*/g, '');
    content = content.replace(/console\.log\(`[^`]*`[^)]*\);\s*/g, '');
    content = content.replace(/console\.log\(['"][^'"]*['"][^)]*\);\s*/g, '');
    
    // Remove standalone console.log calls in object definitions
    content = content.replace(/,\s*console\.log\([^)]*\)/g, '');
    content = content.replace(/console\.log\([^)]*\),/g, '');
    
    // Clean up multiple empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (original !== content) {
      fs.writeFileSync(filePath, content);
      const removedCount = (original.match(/console\.log/g) || []).length - 
                          (content.match(/console\.log/g) || []).length;
      return { cleaned: true, removedCount };
    }
    return { cleaned: false, removedCount: 0 };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { cleaned: false, removedCount: 0, error: error.message };
  }
}

function findFiles(dir) {
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
const files = findFiles(srcDir);

let totalRemoved = 0;
let filesChanged = 0;

console.log('🧹 Removing all remaining console.log statements...\n');

files.forEach(file => {
  const result = cleanupFile(file);
  if (result.cleaned) {
    filesChanged++;
    totalRemoved += result.removedCount;
    console.log(`✅ ${path.relative(process.cwd(), file)}: ${result.removedCount} removed`);
  }
});

console.log('\n📊 Final Summary:');
console.log(`Files processed: ${files.length}`);
console.log(`Files changed: ${filesChanged}`);
console.log(`Console.log statements removed: ${totalRemoved}`);
console.log('\n🎉 Production console cleanup complete! ✅');