#!/usr/bin/env node

/**
 * This script is used to test the upload flow of the API.
 * 
 * To run the script, use:
 * node upload-test.js
 * 
 * It will create a test file, start a multipart upload, upload the file parts,
 * check the upload status, and complete the upload.
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ fetch is not available in this Node.js version');
  console.log('   Please use Node.js 18+ or run: npm install node-fetch');
  try {
    global.fetch = require('node-fetch');
  } catch (e) {
    console.log('   Install with: npm install node-fetch');
    process.exit(1);
  }
}

class UploadTester {
  constructor(baseUrl = 'http://localhost:3002', authToken = 'test-token-123') {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
    this.headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    console.log("request", url, options);
    const response = await fetch(url, {
      headers: this.headers,
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async createTestFile(filename, sizeMB = 1) {
    const content = 'A'.repeat(1024 * 1024 * sizeMB); // Create file of specified size
    fs.writeFileSync(filename, content);
    return {
      filename,
      size: fs.statSync(filename).size,
      content: Buffer.from(content),
    };
  }

  async testUploadFlow(filename, projectId = '123e4567-e89b-12d3-a456-426614174001') {

    console.log('🧪 Starting Upload Test Flow...\n');

    try {
      // Create test file
      console.log('📄 Creating test file...');
      const file = await this.createTestFile(filename, 0.001); // 1KB file
      console.log(`   ✅ Created ${filename} (${file.size} bytes)\n`);

      // Step 1: Start multipart upload
      console.log('1️⃣ Starting multipart upload...');
      const startResponse = await this.request('/uploads/startMultiPartUpload', {
        method: 'POST',
        body: JSON.stringify({
          filePath: `test/${filename}`,
          size: file.size,
          mime: 'text/plain',
          projectId,
        }),
      });
      console.log('   ✅ Upload started:', startResponse);
      console.log('');

      const { fileId, chunkSize, totalChunks } = startResponse;

      // Step 2: Upload parts
      console.log('2️⃣ Uploading file parts...');
      const chunks = this.splitFileIntoChunks(file.content, chunkSize);
      
      for (let i = 0; i < chunks.length; i++) {
        const partNumber = i + 1;
        console.log(`   📤 Uploading part ${partNumber}/${totalChunks}...`);
        
        const partResponse = await fetch(`${this.baseUrl}/uploads/uploadPart`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'X-File-Id': fileId,
            'X-Part-Number': partNumber.toString(),
            'X-Total-Chunks': totalChunks.toString(),
            'Content-Length': chunks[i].length.toString(),
            'Content-Type': 'application/octet-stream',
          },
          body: chunks[i],
        });

        if (!partResponse.ok) {
          throw new Error(`Part ${partNumber} upload failed: ${partResponse.statusText}`);
        }

        const result = await partResponse.json();
        console.log(`   ✅ Part ${partNumber} uploaded:`, result.etag ? 'Success' : 'Error');
      }
      console.log('');

      // Step 3: Check status
      console.log('3️⃣ Checking upload status...');
      const statusResponse = await this.request(`/uploads/fileStatus?fileId=${fileId}`);
      console.log('   📊 Status:', statusResponse);
      console.log('');

      // Step 4: Complete upload
      console.log('4️⃣ Completing upload...');
      const completeResponse = await this.request('/uploads/endMultiPartUpload', {
        method: 'POST',
        body: JSON.stringify({ fileId }),
      });
      console.log('   ✅ Upload completed:', completeResponse);
      console.log('');

      console.log('🎉 Upload test completed successfully!');
      
    } catch (error) {
      console.error('❌ Upload test failed:', error.message);
      
    } finally {
      // Cleanup
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
        console.log(`🧹 Cleaned up ${filename}`);
      }
    }
  }

  splitFileIntoChunks(buffer, chunkSize) {
    const chunks = [];
    for (let i = 0; i < buffer.length; i += chunkSize) {
      chunks.push(buffer.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async testHealthEndpoints() {
    console.log('🩺 Testing Health Endpoints...\n');
    
    try {
      const health = await this.request('/health');
      console.log('✅ /health:', health);
      
      const ready = await this.request('/health/ready');
      console.log('✅ /health/ready:', ready);
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
    }
    console.log('');
  }
}

// Main execution
async function main() {
  const tester = new UploadTester();
  
  console.log('🚀 TetraxAI API Test Suite\n');
  
  // Test health endpoints
  await tester.testHealthEndpoints();
  
  // Test upload flow
  await tester.testUploadFlow('test-upload.txt');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = UploadTester;
