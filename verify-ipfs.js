// Verify data is actually stored in IPFS
async function verifyIPFS() {
  console.log('Verifying IPFS storage...\n');

  try {
    // Dynamic import for ESM module
    const ipfsModule = await import('ipfs');
    const create = ipfsModule.create;

    console.log('Connecting to IPFS node...');
    const node = await create({
      repo: '/tmp/solid-ipfs',
      start: true,
      config: {
        Addresses: {
          Swarm: [],
          API: '',
          Gateway: '',
        },
        Bootstrap: [],
        Discovery: {
          MDNS: { Enabled: false },
          webRTCStar: { Enabled: false },
        },
      },
    });

    console.log('✅ Connected to IPFS node\n');

    // List root directory
    console.log('📁 MFS Root contents:');
    for await (const file of node.files.ls('/')) {
      console.log(`   - ${file.name} (${file.type}) CID: ${file.cid}`);
    }

    // List .data directory
    console.log('\n📁 /.data contents:');
    try {
      for await (const file of node.files.ls('/.data')) {
        console.log(`   - ${file.name} (${file.type}) CID: ${file.cid}`);
      }
    } catch (e) {
      console.log('   (empty or not found)');
    }

    // Get stats for hello.txt
    console.log('\n📄 File: /.data/hello.txt');
    try {
      const stats = await node.files.stat('/.data/hello.txt');
      console.log(`   Type: ${stats.type}`);
      console.log(`   Size: ${stats.size} bytes`);
      console.log(`   CID: ${stats.cid}`);
      console.log(`   IPFS Gateway URL: https://ipfs.io/ipfs/${stats.cid}`);
      
      // Read content
      const chunks = [];
      for await (const chunk of node.files.read('/.data/hello.txt')) {
        chunks.push(chunk);
      }
      const content = Buffer.concat(chunks).toString();
      console.log(`   Content: "${content}"`);
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }

    // Get stats for mydata container
    console.log('\n📁 Container: /.data/mydata/');
    try {
      const stats = await node.files.stat('/.data/mydata');
      console.log(`   Type: ${stats.type}`);
      console.log(`   CID: ${stats.cid}`);
      console.log(`   IPFS Gateway URL: https://ipfs.io/ipfs/${stats.cid}`);
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
    }

    // Get root CID
    console.log('\n🌍 Root MFS CID:');
    const rootStats = await node.files.stat('/');
    console.log(`   CID: ${rootStats.cid}`);
    console.log(`   This CID represents your entire Solid Pod!`);
    console.log(`   IPFS Gateway: https://ipfs.io/ipfs/${rootStats.cid}`);

    await node.stop();
    console.log('\n✅ Verification complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyIPFS().catch(console.error);
