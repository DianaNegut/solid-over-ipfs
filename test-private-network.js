#!/usr/bin/env node
/**
 * Test script for IPFS private network setup.
 * This script verifies that the private network is properly configured.
 */

const fs = require('fs');
const path = require('path');

async function testPrivateNetwork() {
  console.log('🧪 Testing IPFS Private Network Setup...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let hasError = false;

  // Step 1: Check if swarm.key exists
  console.log('1️⃣  Checking for swarm.key...');
  const swarmKeyPath = './swarm.key';
  
  if (fs.existsSync(swarmKeyPath)) {
    const keyContent = fs.readFileSync(swarmKeyPath, 'utf8');
    console.log('   ✅ swarm.key found');
    console.log(`   📍 Location: ${path.resolve(swarmKeyPath)}`);
    
    // Validate swarm key format
    if (keyContent.includes('/key/swarm/psk/1.0.0/') && keyContent.includes('/base16/')) {
      console.log('   ✅ swarm.key format is valid');
      const lines = keyContent.split('\n');
      const keyLine = lines[lines.length - 1];
      if (keyLine && keyLine.length === 64) {
        console.log('   ✅ Key length is correct (64 hex characters)');
      } else {
        console.log('   ⚠️  Warning: Key might have incorrect length');
      }
    } else {
      console.log('   ❌ swarm.key format is invalid!');
      hasError = true;
    }
  } else {
    console.log('   ⚠️  swarm.key not found - will be auto-generated on first run');
    console.log(`   💡 You can generate one manually: node generate-swarm-key.js`);
  }

  console.log('');

  // Step 2: Check configuration files
  console.log('2️⃣  Checking configuration files...');
  
  const configFiles = [
    './config/ipfs-private.json',
    './config/storage/backend/ipfs-private.json',
    './config/storage/backend/data-accessors/ipfs-private.json'
  ];

  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      console.log(`   ✅ ${configFile}`);
    } else {
      console.log(`   ❌ ${configFile} missing!`);
      hasError = true;
    }
  }

  console.log('');

  // Step 3: Check IpfsHelper implementation
  console.log('3️⃣  Checking IpfsHelper implementation...');
  const ipfsHelperPath = './src/storage/ipfs/IpfsHelper.ts';
  
  if (fs.existsSync(ipfsHelperPath)) {
    const helperContent = fs.readFileSync(ipfsHelperPath, 'utf8');
    
    if (helperContent.includes('privateNetwork') && helperContent.includes('swarmKey')) {
      console.log('   ✅ IpfsHelper has private network support');
    } else {
      console.log('   ❌ IpfsHelper missing private network support!');
      hasError = true;
    }
    
    if (helperContent.includes('generateSwarmKey')) {
      console.log('   ✅ Auto-generation of swarm keys supported');
    } else {
      console.log('   ⚠️  No auto-generation support');
    }
  } else {
    console.log('   ❌ IpfsHelper.ts not found!');
    hasError = true;
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (hasError) {
    console.log('❌ Some checks failed! Please review the errors above.\n');
    return false;
  }

  console.log('✅ All checks passed!\n');
  console.log('📝 Next steps to start your private IPFS network:\n');
  console.log('1️⃣  Generate swarm key (if not already done):');
  console.log('   node generate-swarm-key.js');
  console.log('');
  console.log('2️⃣  Build the project:');
  console.log('   npm run build');
  console.log('');
  console.log('3️⃣  Start first node:');
  console.log('   npm start -- -c config/ipfs-private.json -f .data1 -p 3001');
  console.log('');
  console.log('4️⃣  Copy swarm.key to second node location and start it:');
  console.log('   npm start -- -c config/ipfs-private.json -f .data2 -p 3002');
  console.log('');
  console.log('5️⃣  Connect nodes manually (get peer ID from logs):');
  console.log('   Use IPFS API to connect peers using their multiaddrs');
  console.log('');
  console.log('🔐 Remember: Only nodes with the same swarm.key can communicate!\n');
  
  return true;
}

testPrivateNetwork()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
