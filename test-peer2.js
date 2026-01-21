const { create } = require('ipfs');
const fs = require('fs');
const path = require('path');

async function startSecondPeer() {
    console.log('🚀 Starting second IPFS peer for private network testing...\n');

    // Setup repo for second node
    const repo2 = './.ipfs-peer2';
    const swarmKeyPath = path.join(repo2, 'swarm.key');

    // Copy swarm key from first node
    const originalSwarmKey = '\\tmp\\solid-ipfs\\swarm.key';

    if (!fs.existsSync(originalSwarmKey)) {
        console.error('❌ Swarm key not found at:', originalSwarmKey);
        console.error('Please start the main server first to generate the swarm key!');
        process.exit(1);
    }

    // Ensure repo directory exists
    if (!fs.existsSync(repo2)) {
        fs.mkdirSync(repo2, { recursive: true });
    }

    // Copy swarm key
    const swarmKeyContent = fs.readFileSync(originalSwarmKey, 'utf8');
    fs.writeFileSync(swarmKeyPath, swarmKeyContent, 'utf8');
    console.log('✅ Copied swarm key from first node');
    console.log('🔑 Swarm key:', swarmKeyPath);

    try {
        console.log('\n📡 Creating IPFS peer 2...');
        const node = await create({
            repo: repo2,
            start: true,
            config: {
                Addresses: {
                    Swarm: [
                        '/ip4/0.0.0.0/tcp/4101',  // Different port from first node
                    ],
                    API: '/ip4/127.0.0.1/tcp/5102',
                    Gateway: '/ip4/127.0.0.1/tcp/8182',
                },
                Bootstrap: [],  // Empty for private network
                Discovery: {
                    MDNS: { Enabled: true },  // Enable local peer discovery
                    webRTCStar: { Enabled: false },
                },
            },
            libp2p: {
                config: {
                    peerDiscovery: {
                        mdns: {
                            enabled: true,
                            interval: 1000,
                        },
                    },
                },
            },
        });

        const nodeId = await node.id();
        console.log('✅ IPFS Peer 2 started successfully!');
        console.log(`📍 Node ID: ${nodeId.id}`);
        console.log(`🔗 Listening on: /ip4/0.0.0.0/tcp/4101`);

        // Wait for peer discovery
        console.log('\n⏳ Waiting for peer discovery (30 seconds)...');

        let checkInterval = setInterval(async () => {
            const peers = await node.swarm.peers();
            console.log(`\n👥 Connected peers: ${peers.length}`);

            if (peers.length > 0) {
                console.log('\n🎉 SUCCESS! Connected to private network peers:');
                peers.forEach(peer => {
                    console.log(`   - Peer ID: ${peer.peer}`);
                    console.log(`     Address: ${peer.addr}`);
                });
            } else {
                console.log('   (Still searching for peers via MDNS...)');
            }
        }, 5000);

        // Keep running for 30 seconds
        setTimeout(async () => {
            clearInterval(checkInterval);

            const finalPeers = await node.swarm.peers();
            console.log('\n' + '='.repeat(60));
            console.log('📊 FINAL RESULTS:');
            console.log('='.repeat(60));

            if (finalPeers.length > 0) {
                console.log(`✅ SUCCESS! Connected to ${finalPeers.length} peer(s) in private network`);
                console.log('\n🔗 Private network is working correctly!');
            } else {
                console.log('❌ No peers found.');
                console.log('\n🔍 Troubleshooting:');
                console.log('   1. Make sure first node is running on port 4001');
                console.log('   2. Check firewall allows TCP 4001 and 4101');
                console.log('   3. Verify both nodes have same swarm.key');
                console.log('   4. Try: ipfs swarm peers (on first node)');
            }

            console.log('\n⏹️  Stopping peer 2...');
            await node.stop();
            process.exit(0);
        }, 30000);

    } catch (error) {
        console.error('❌ Error starting peer 2:', error.message);
        process.exit(1);
    }
}

startSecondPeer();
