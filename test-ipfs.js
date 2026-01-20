// Simple test script to verify IPFS functionality
const fetch = require('node-fetch');

async function testIPFS() {
  console.log('Testing IPFS backend...\n');

  // Test 1: Check server is running
  try {
    console.log('1. Testing server homepage...');
    const response = await fetch('http://localhost:3000/');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      console.log('   ✅ Server is running!\n');
    }
  } catch (error) {
    console.error('   ❌ Server not accessible:', error.message);
    return;
  }

  // Test 2: Create a simple text file
  try {
    console.log('2. Creating a text file...');
    const response = await fetch('http://localhost:3000/hello.txt', {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'Hello from IPFS!',
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      console.log('   ✅ File created successfully!\n');
    } else {
      const errorText = await response.text();
      console.log('   ❌ Failed to create file');
      console.log('   Error:', errorText.substring(0, 200));
      return;
    }
  } catch (error) {
    console.error('   ❌ Error creating file:', error.message);
    return;
  }

  // Test 3: Read the file back
  try {
    console.log('3. Reading the file back...');
    const response = await fetch('http://localhost:3000/hello.txt');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      const content = await response.text();
      console.log(`   Content: "${content}"`);
      console.log('   ✅ File read successfully!\n');
    }
  } catch (error) {
    console.error('   ❌ Error reading file:', error.message);
  }

  // Test 4: Create a container
  try {
    console.log('4. Creating a container...');
    const response = await fetch('http://localhost:3000/mydata/', {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/turtle',
      },
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.ok || response.status === 201) {
      console.log('   ✅ Container created successfully!\n');
    }
  } catch (error) {
    console.error('   ❌ Error creating container:', error.message);
  }

  console.log('Tests completed!');
}

testIPFS().catch(console.error);
