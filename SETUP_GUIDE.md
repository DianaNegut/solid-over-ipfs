# Setup Guide for IPFS Backend

## Quick Start

### 1. Install IPFS

**Windows (using Chocolatey):**
```powershell
choco install ipfs
```

**Or download from:** https://dist.ipfs.tech/#kubo

### 2. Initialize and Start IPFS

```powershell
# Initialize IPFS repository
ipfs init

# Configure CORS for CSS
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST", "PUT", "DELETE"]'

# Start IPFS daemon
ipfs daemon
```

### 3. Install CSS Dependencies

```powershell
cd C:\ATM\UPGRADE\CommunitySolidServer
npm install
```

### 4. Build the Project

```powershell
npm run build
```

### 5. Run CSS with IPFS Backend

```powershell
npm start -- -c config/ipfs.json -f .data
```

Or:

```powershell
node bin/server.js -c config/ipfs.json -f .data
```

### 6. Access the Server

Open your browser and navigate to:
```
http://localhost:3000/
```

## Verify IPFS Integration

### Check IPFS is Running

```powershell
ipfs id
```

### Create a Test Resource

```powershell
# Using curl
curl -X PUT http://localhost:3000/test.txt ^
  -H "Content-Type: text/plain" ^
  -d "Hello IPFS!"

# Verify in IPFS
ipfs files ls /
ipfs files read /test.txt
```

### Get IPFS CID

```powershell
ipfs files stat /test.txt
```

## Troubleshooting

### IPFS Connection Issues

If you get connection errors:

1. Check IPFS is running:
   ```powershell
   ipfs id
   ```

2. Check API endpoint:
   ```powershell
   ipfs config Addresses.API
   ```
   Should output: `/ip4/127.0.0.1/tcp/5002` (or 5002)

3. Test API manually:
   ```powershell
   curl http://127.0.0.1:5002/api/v0/version
   ```

### Build Issues

If Components.js fails to generate:

```powershell
# Clean and rebuild
Remove-Item -Recurse -Force dist
npm run build
```

### Port Conflicts

If port 3000 is already in use:

```powershell
npm start -- -c config/ipfs.json -f .data -p 3001
```

## Testing with Solid Apps

1. **Solid File Browser**: https://otto-aa.github.io/solid-filemanager/
   - Click "Add Storage"
   - Enter: http://localhost:3000/

2. **Penny**: https://penny.vincenttunru.com/
   - Simple note-taking app
   - Login and start creating notes

3. **Inrupt PodBrowser**: https://podbrowser.inrupt.com/
   - Note: Requires HTTPS in production

## Viewing Data on IPFS

### Using IPFS Gateway

```powershell
# Get root CID
$cid = ipfs files stat / | Select-String "CID:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }

# View in browser
Start-Process "http://localhost:8080/ipfs/$cid"
```

### Using IPFS CLI

```powershell
# List files
ipfs files ls -l /

# Read a file
ipfs files read /test.txt

# Get stats
ipfs files stat /test.txt
```

## Development Tips

### Enable Debug Logging

Edit `config/ipfs.json` and ensure Winston logging is set to debug level.

Or set environment variable:

```powershell
$env:CSS_LOGGING_LEVEL="debug"
npm start -- -c config/ipfs.json -f .data
```

### Watch for Changes

```powershell
npm run watch
```

### Running Tests

```powershell
# Run all tests
npm test

# Run specific test
npm test -- test/unit/storage/accessors/IpfsDataAccessor.test.ts
```

## Next Steps

1. Create a pod and identity
2. Test with various Solid applications
3. Explore IPFS features (pinning, clustering)
4. Monitor IPFS metrics: http://localhost:5002/webui
