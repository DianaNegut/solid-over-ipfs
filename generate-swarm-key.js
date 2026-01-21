#!/usr/bin/env node
/**
 * Script to generate a swarm key for IPFS private network.
 * Usage: node generate-swarm-key.js [output-path]
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSwarmKey(outputPath) {
  // Generate random 32 bytes key
  const key = crypto.randomBytes(32);
  
  // Format: /key/swarm/psk/1.0.0/
  //         /base16/
  //         <64 hex characters>
  const swarmKey = `/key/swarm/psk/1.0.0/
/base16/
${key.toString('hex')}`;

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write key to file
  fs.writeFileSync(outputPath, swarmKey, 'utf8');
  
  console.log('🔑 IPFS Private Network Swarm Key Generated!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📁 Location: ${outputPath}`);
  console.log('');
  console.log('📋 Key content:');
  console.log(swarmKey);
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Share this file with all nodes in your private network');
  console.log('   2. Place swarm.key in each node\'s IPFS repo directory');
  console.log('   3. Restart all IPFS nodes');
  console.log('   4. Configure nodes to connect to each other using multiaddrs');
  console.log('');
  console.log('⚠️  IMPORTANT: Keep this key secret! Anyone with this key can join your network.');
}

// Main execution
const args = process.argv.slice(2);
const outputPath = args[0] || './swarm.key';

try {
  generateSwarmKey(outputPath);
  process.exit(0);
} catch (error) {
  console.error('❌ Error generating swarm key:', error.message);
  process.exit(1);
}
