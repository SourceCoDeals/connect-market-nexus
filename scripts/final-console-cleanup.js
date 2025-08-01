#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function cleanupFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Remove all console.log patterns but preserve console.error, console.warn, console.info
    content = content.replace(/^\s*console\.log\([^)]*\);\s*$/gm, '');
    content = content.replace(/console\.log\([^)]*\);\s*/g, '');
    content = content.replace(/console\.log\(`[^`]*`[^)]*\);\s*/g, '');
    content = content.replace(/console\.log\(['"][^'"]*['"][^)]*\);\s*/g, '');
    
    // Clean up multiple empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (original !== content) {
      fs.writeFileSync(filePath, content);
      return true;
    }
    return false;
  } catch (error) {
    return false;
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

const srcDir = path.join(process.cwd(), 'src');
const files = findFiles(srcDir);
let totalCleaned = 0;

files.forEach(file => {
  if (cleanupFile(file)) {
    totalCleaned++;
  }
});

console.log(`✅ Console cleanup complete: ${totalCleaned} files cleaned`);