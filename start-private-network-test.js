#!/usr/bin/env node
/**
 * Quick start script for testing private IPFS network with 2 nodes.
 * This will help you quickly test the private network setup.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Private IPFS Network Test\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('This script will start 2 Community Solid Server nodes');
console.log('configured to use a private IPFS network.\n');

console.log('📋 Configuration:');
console.log('   Node 1: http://localhost:3001 (data: .data-node1)');
console.log('   Node 2: http://localhost:3002 (data: .data-node2)');
console.log('   Both using: swarm.key for private network\n');

console.log('⚠️  Press Ctrl+C to stop both nodes\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Start Node 1
console.log('🔵 Starting Node 1...\n');
const node1 = spawn('npm', ['start', '--', '-c', 'config/ipfs-private.json', '-f', '.data-node1', '-p', '3001'], {
  stdio: 'inherit',
  shell: true
});

// Wait a bit before starting node 2
setTimeout(() => {
  console.log('\n🟢 Starting Node 2...\n');
  const node2 = spawn('npm', ['start', '--', '-c', 'config/ipfs-private.json', '-f', '.data-node2', '-p', '3002'], {
    stdio: 'inherit',
    shell: true
  });

  // Handle node2 exit
  node2.on('exit', (code) => {
    console.log(`\n🟢 Node 2 stopped with code ${code}`);
    node1.kill();
    process.exit(code);
  });
}, 5000);

// Handle node1 exit
node1.on('exit', (code) => {
  console.log(`\n🔵 Node 1 stopped with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Stopping both nodes...\n');
  node1.kill();
  process.exit(0);
});
