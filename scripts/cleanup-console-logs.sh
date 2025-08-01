#!/bin/bash

# Production Cleanup Script
# Removes all console.log statements from TypeScript/React files

echo "🧹 Starting production cleanup..."

# Find all .ts and .tsx files and remove console.log statements
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Count original console.log statements
  original_count=$(grep -c "console\.log" "$file" 2>/dev/null || echo "0")
  
  if [ "$original_count" -gt 0 ]; then
    # Replace console.log with comments, preserving the main message
    sed -i 's/console\.log(\([^)]*\));*/\/\/ Debug log removed/g' "$file"
    
    # Count remaining console.log statements
    remaining_count=$(grep -c "console\.log" "$file" 2>/dev/null || echo "0")
    
    if [ "$remaining_count" -eq 0 ]; then
      echo "✅ $file: $original_count console.log statements cleaned"
    else
      echo "⚠️  $file: $original_count cleaned, $remaining_count remaining"
    fi
  fi
done

echo "✅ Production cleanup completed!"