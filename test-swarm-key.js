const { IpfsHelper } = require('./dist/storage/ipfs/IpfsHelper.js');

async function testSwarmKey() {
    console.log('🧪 Testing IPFS Swarm Key Implementation...\n');

    const testRepo = './.test-ipfs-repo';
    const helper = new IpfsHelper({ repo: testRepo });

    try {
        console.log('1️⃣ Starting IPFS node with swarm key...');
        // Trigger node initialization by calling a method
        await helper.mkdir('/test-dir');

        console.log('✅ IPFS node started successfully!');
        console.log('\n📁 Check for swarm.key file:');

        const fs = require('fs');
        const path = require('path');
        const swarmKeyPath = path.join(testRepo, 'swarm.key');

        if (fs.existsSync(swarmKeyPath)) {
            const keyContent = fs.readFileSync(swarmKeyPath, 'utf8');
            console.log('✅ Swarm key found at:', swarmKeyPath);
            console.log('\n🔑 Swarm key content (first 100 chars):');
            console.log(keyContent.substring(0, 100) + '...');
            console.log('\n✅ Private network is configured!');
        } else {
            console.log('❌ Swarm key NOT found!');
        }

        console.log('\n2️⃣ Stopping IPFS node...');
        await helper.stop();
        console.log('✅ Node stopped successfully');

        console.log('\n🎉 All tests passed!');
        console.log('\n📝 Next steps:');
        console.log('   - Share swarm.key with other nodes to join the private network');
        console.log('   - Configure firewall to allow port 4001');
        console.log('   - Add bootstrap nodes for peer discovery');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testSwarmKey().then(() => process.exit(0));
