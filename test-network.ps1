# Test Private IPFS Network Connectivity
# Run this after both nodes are started

Write-Host ""
Write-Host "🧪 Testing IPFS Private Network Connectivity..." -ForegroundColor Cyan
Write-Host "=" * 60
Write-Host ""

# Test Node 1
Write-Host "📡 Testing Node 1..." -ForegroundColor Yellow
$env:IPFS_PATH = "C:\ipfs-node1"

try {
    $id1 = ipfs id --format="<id>" 2>$null
    Write-Host "✅ Node 1 Peer ID: $id1" -ForegroundColor Green
    
    $peers1 = @(ipfs swarm peers 2>$null)
    Write-Host "👥 Node 1 Connected Peers: $($peers1.Count)" -ForegroundColor $(if ($peers1.Count -gt 0) { "Green" } else { "Yellow" })
    
    if ($peers1.Count -gt 0) {
        foreach ($peer in $peers1) {
            Write-Host "   - $peer" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Error connecting to Node 1" -ForegroundColor Red
    Write-Host "Make sure Node 1 daemon is running!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "-" * 60
Write-Host ""

# Test Node 2
Write-Host "📡 Testing Node 2..." -ForegroundColor Yellow
$env:IPFS_PATH = "C:\ipfs-node2"

try {
    $id2 = ipfs id --format="<id>" 2>$null
    Write-Host "✅ Node 2 Peer ID: $id2" -ForegroundColor Green
    
    $peers2 = @(ipfs swarm peers 2>$null)
    Write-Host "👥 Node 2 Connected Peers: $($peers2.Count)" -ForegroundColor $(if ($peers2.Count -gt 0) { "Green" } else { "Yellow" })
    
    if ($peers2.Count -gt 0) {
        foreach ($peer in $peers2) {
            Write-Host "   - $peer" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Error connecting to Node 2" -ForegroundColor Red
    Write-Host "Make sure Node 2 daemon is running!" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 60
Write-Host ""

# Test file sharing
if ($peers1.Count -gt 0 -and $peers2.Count -gt 0) {
    Write-Host "🎉 SUCCESS! Private network is working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🧪 Testing file sharing..." -ForegroundColor Cyan
    
    # Add file on Node 1
    $env:IPFS_PATH = "C:\ipfs-node1"
    $testContent = "Hello from Node 1 - $(Get-Date)"
    $cid = ($testContent | ipfs add --quieter)
    Write-Host "📤 Node 1 added file: $cid" -ForegroundColor Yellow
    
    # Retrieve on Node 2
    $env:IPFS_PATH = "C:\ipfs-node2"
    Start-Sleep -Seconds 2  # Wait for propagation
    
    try {
        $retrieved = ipfs cat $cid 2>$null
        if ($retrieved -eq $testContent) {
            Write-Host "✅ Node 2 successfully retrieved file!" -ForegroundColor Green
            Write-Host "   Content: $retrieved" -ForegroundColor Gray
        } else {
            Write-Host "⚠️  Content mismatch" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Failed to retrieve file on Node 2" -ForegroundColor Red
    }
    
} else {
    Write-Host "❌ FAILED! Nodes are not connected" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Verify both daemons are running"
    Write-Host "   2. Check swarm.key is identical in both nodes"
    Write-Host "   3. Wait 10-20 seconds for MDNS discovery"
    Write-Host "   4. Check firewall allows ports 4001 and 4101"
    Write-Host ""
    Write-Host "Run firewall rules:" -ForegroundColor Yellow
    Write-Host '   New-NetFirewallRule -DisplayName "IPFS 4001" -Protocol TCP -LocalPort 4001 -Action Allow'
    Write-Host '   New-NetFirewallRule -DisplayName "IPFS 4101" -Protocol TCP -LocalPort 4101 -Action Allow'
}

Write-Host ""
