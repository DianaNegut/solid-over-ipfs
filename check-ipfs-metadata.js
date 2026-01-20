// Check IPFS metadata through Solid server API (while server is running)
const fetch = require('node-fetch');

async function checkMetadata() {
  console.log('Checking IPFS CID metadata from Solid server...\n');

  try {
    // Get metadata for hello.txt file
    console.log('📄 Getting metadata for /hello.txt');
    const fileResponse = await fetch('http://localhost:3000/hello.txt', {
      method: 'HEAD',
    });
    
    console.log('Response Headers:');
    for (const [key, value] of fileResponse.headers.entries()) {
      console.log(`   ${key}: ${value}`);
    }

    // Try to get RDF metadata
    console.log('\n📄 Getting RDF metadata for /hello.txt');
    const rdfResponse = await fetch('http://localhost:3000/hello.txt.meta', {
      headers: {
        'Accept': 'text/turtle',
      },
    });
    
    if (rdfResponse.ok) {
      const metadata = await rdfResponse.text();
      console.log('Metadata (Turtle):');
      console.log(metadata);
      
      // Extract CID from metadata
      const cidMatch = metadata.match(/ipfs:\/\/([a-zA-Z0-9]+)/);
      if (cidMatch) {
        console.log(`\n🔑 IPFS CID: ${cidMatch[1]}`);
        console.log(`🌍 IPFS Gateway: https://ipfs.io/ipfs/${cidMatch[1]}`);
      }
    } else {
      console.log('No metadata file found (this is normal for simple files)');
    }

    // Get container metadata
    console.log('\n📁 Getting metadata for /mydata/ container');
    const containerResponse = await fetch('http://localhost:3000/mydata/', {
      headers: {
        'Accept': 'text/turtle',
      },
    });

    if (containerResponse.ok) {
      const containerMeta = await containerResponse.text();
      console.log('Container metadata:');
      console.log(containerMeta);
      
      // Extract CID
      const cidMatch = containerMeta.match(/ipfs:\/\/([a-zA-Z0-9]+)/);
      if (cidMatch) {
        console.log(`\n🔑 Container CID: ${cidMatch[1]}`);
        console.log(`🌍 IPFS Gateway: https://ipfs.io/ipfs/${cidMatch[1]}`);
      }
    }

    // List root container
    console.log('\n📁 Root container listing:');
    const rootResponse = await fetch('http://localhost:3000/', {
      headers: {
        'Accept': 'text/turtle',
      },
    });

    if (rootResponse.ok) {
      const rootContent = await rootResponse.text();
      console.log(rootContent.substring(0, 800) + '...');
    }

    console.log('\n✅ Metadata check complete!');
    console.log('\n💡 Note: IPFS CIDs are stored as metadata in the response headers.');
    console.log('   Your data is stored in IPFS MFS at: /tmp/solid-ipfs/');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMetadata().catch(console.error);
