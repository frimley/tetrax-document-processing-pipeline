#!/bin/bash

# Create various test files for upload testing

echo "📁 Creating test files for upload testing..."

# Small text file (1KB)
echo "Creating small text file (1KB)..."
head -c 1024 /dev/zero | tr '\0' 'A' > small-file.txt
echo "Content: This is a small test file" >> small-file.txt

# Medium text file (1MB)
echo "Creating medium text file (1MB)..."
head -c 1048576 /dev/zero | tr '\0' 'B' > medium-file.txt

# Large text file (10MB)
echo "Creating large text file (10MB)..."
head -c 10485760 /dev/zero | tr '\0' 'C' > large-file.txt

# JSON test file
echo "Creating JSON test file..."
cat > test-data.json << 'EOF'
{
  "testFile": true,
  "purpose": "API upload testing",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "data": {
    "numbers": [1, 2, 3, 4, 5],
    "strings": ["hello", "world", "test"],
    "nested": {
      "level1": {
        "level2": {
          "value": "deep nesting test"
        }
      }
    }
  },
  "longString": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
}
EOF

# Create a sample image (using base64 encoded pixel data)
echo "Creating sample image file..."
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" | base64 -d > tiny-image.png

echo ""
echo "✅ Test files created:"
ls -lh *.txt *.json *.png 2>/dev/null | awk '{print "   " $9 " (" $5 ")"}'

echo ""
echo "🧹 To clean up test files, run:"
echo "   rm -f *.txt *.json *.png"
