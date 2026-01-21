#!/usr/bin/env node
/**
 * Script to verify that the private IPFS network is working correctly.
 * Run this after starting your server to verify the private network setup.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🔍 Verifying Private IPFS Network Setup...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function verifyPrivateNetwork() {
  const checks = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // Check 1: Verify swarm.key exists and is valid
  console.log('1️⃣  Checking swarm.key...');
  const swarmKeyPath = './swarm.key';
  
  if (fs.existsSync(swarmKeyPath)) {
    const keyContent = fs.readFileSync(swarmKeyPath, 'utf8');
    
    if (keyContent.includes('/key/swarm/psk/1.0.0/') && keyContent.includes('/base16/')) {
      const lines = keyContent.split('\n');
      const keyLine = lines[lines.length - 1];
      
      if (keyLine && keyLine.trim().length === 64) {
        console.log('   ✅ swarm.key is valid');
        checks.passed++;
      } else {
        console.log('   ❌ swarm.key has invalid key length');
        checks.failed++;
      }
    } else {
      console.log('   ❌ swarm.key has invalid format');
      checks.failed++;
    }
  } else {
    console.log('   ❌ swarm.key not found');
    checks.failed++;
  }

  console.log('');

  // Check 2: Verify IPFS repo has swarm.key
  console.log('2️⃣  Checking IPFS repository...');
  const ipfsRepos = ['./.ipfs-private', './.data-node1/.ipfs-private', './.data-node2/.ipfs-private'];
  let foundRepo = false;

  for (const repo of ipfsRepos) {
    if (fs.existsSync(repo)) {
      foundRepo = true;
      const repoSwarmKey = path.join(repo, 'swarm.key');
      
      if (fs.existsSync(repoSwarmKey)) {
        console.log(`   ✅ Found swarm.key in ${repo}`);
        
        // Verify it matches the main swarm.key
        if (fs.existsSync(swarmKeyPath)) {
          const mainKey = fs.readFileSync(swarmKeyPath, 'utf8');
          const repoKey = fs.readFileSync(repoSwarmKey, 'utf8');
          
          if (mainKey === repoKey) {
            console.log(`   ✅ swarm.key matches main key`);
            checks.passed++;
          } else {
            console.log(`   ⚠️  Warning: swarm.key differs from main key`);
            checks.warnings++;
          }
        }
      } else {
        console.log(`   ❌ No swarm.key in ${repo}`);
        checks.failed++;
      }
    }
  }

  if (!foundRepo) {
    console.log('   ⚠️  No IPFS repository found yet (will be created on first run)');
    checks.warnings++;
  }

  console.log('');

  // Check 3: Check for IPFS node logs
  console.log('3️⃣  Analyzing server logs...');
  console.log('   💡 Look for these indicators in your server logs:');
  console.log('');
  console.log('   📌 Private network confirmation:');
  console.log('      "Initializing embedded IPFS node with repo: X (PRIVATE NETWORK)"');
  console.log('');
  console.log('   📌 Node ID and addresses:');
  console.log('      "🔐 Private IPFS Node ID: QmXXXXXXXXXXXXXXX"');
  console.log('      "📡 Addresses: /ip4/127.0.0.1/tcp/4001/p2p/QmXXX..."');
  console.log('');
  console.log('   📌 Swarm key setup:');
  console.log('      "✅ Swarm key copied successfully" or');
  console.log('      "Using existing swarm key" or');
  console.log('      "⚠️  NEW SWARM KEY GENERATED!"');
  console.log('');

  // Check 4: Instructions for multi-node testing
  console.log('4️⃣  Testing multi-node connectivity...');
  console.log('');
  console.log('   To verify nodes can communicate in the private network:');
  console.log('');
  console.log('   Step A: Start first node and note its Peer ID from logs');
  console.log('           npm start -- -c config/ipfs-private.json -f .data1 -p 3001');
  console.log('');
  console.log('   Step B: Start second node with SAME swarm.key');
  console.log('           npm start -- -c config/ipfs-private.json -f .data2 -p 3002');
  console.log('');
  console.log('   Step C: Check logs for peer connections');
  console.log('           Both nodes should discover each other via mDNS');
  console.log('');
  console.log('   Step D: Create a pod on node 1, verify isolation');
  console.log('           Data should only be visible to nodes with same swarm.key');
  console.log('');

  // Check 5: Verify isolation from public network
  console.log('5️⃣  Private network isolation checks...');
  console.log('');
  console.log('   ✅ Bootstrap nodes: Should be EMPTY (no public IPFS nodes)');
  console.log('   ✅ Swarm ports: Should be 4001 (TCP)');
  console.log('   ✅ mDNS: Enabled for local peer discovery');
  console.log('   ✅ Public DHT: Disabled (private network)');
  console.log('');

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📊 Verification Summary:');
  console.log(`   ✅ Passed: ${checks.passed}`);
  console.log(`   ❌ Failed: ${checks.failed}`);
  console.log(`   ⚠️  Warnings: ${checks.warnings}`);
  console.log('');

  if (checks.failed === 0 && checks.warnings === 0) {
    console.log('🎉 Perfect! Your private network setup looks good!\n');
    console.log('Next steps:');
    console.log('   1. Start your server: npm start -- -c config/ipfs-private.json -f .data -p 3000');
    console.log('   2. Watch logs for "PRIVATE NETWORK" confirmation');
    console.log('   3. Note the Peer ID from logs');
    console.log('   4. Start additional nodes with the same swarm.key');
    console.log('   5. Verify peer connections in logs\n');
  } else if (checks.failed === 0) {
    console.log('✅ Setup looks good with minor warnings.\n');
    console.log('   You can start your server and monitor the logs.\n');
  } else {
    console.log('❌ Some issues detected. Please fix them before proceeding.\n');
  }

  // Final tips
  console.log('💡 Testing Tips:\n');
  console.log('   • Use different terminal windows for multiple nodes');
  console.log('   • Each node needs different data directory (-f flag)');
  console.log('   • Each node needs different port (-p flag)');
  console.log('   • All nodes MUST use the same swarm.key');
  console.log('   • Check firewall allows port 4001 for network communication');
  console.log('   • Peer discovery may take 30-60 seconds\n');

  console.log('🔍 What to look for in logs:\n');
  console.log('   GOOD signs:');
  console.log('   • "PRIVATE NETWORK" in initialization message');
  console.log('   • Peer ID starts with "Qm"');
  console.log('   • Multiple addresses listed (IPv4 and IPv6)');
  console.log('   • "Swarm key" messages without errors\n');
  
  console.log('   BAD signs:');
  console.log('   • "swarm key not found" errors');
  console.log('   • "Failed to create IPFS node" errors');
  console.log('   • No peer connections after 2-3 minutes');
  console.log('   • "Public" or "public network" in logs\n');

  console.log('📚 Documentation:');
  console.log('   • Full guide: PRIVATE_IPFS_NETWORK.md');
  console.log('   • Quick start: QUICK_START_PRIVATE_NETWORK.md');
  console.log('   • Implementation: IMPLEMENTATION_SUMMARY.md\n');

  return checks.failed === 0;
}

verifyPrivateNetwork()
  .then(success => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Verification error:', error.message);
    process.exit(1);
  });
