# IPFS Backend for Community Solid Server

This implementation adds IPFS (InterPlanetary File System) as a storage backend for the Community Solid Server, based on the research paper "Solid over the Interplanetary File System" by Fabrizio Parrillo and Christian Tschudin.

## Overview

The IPFS backend allows Community Solid Server to store data on the IPFS network using the Mutable File System (MFS), providing:

- **Decentralized storage**: Data is stored on IPFS instead of a local file system
- **Content addressing**: Each resource is identified by its cryptographic hash (CID)
- **Pod provider independence**: Users can easily switch pod providers by sharing the root CID
- **Offline-first potential**: Future support for offline operations and data synchronization

## Architecture

The implementation consists of two main components:

### 1. IpfsHelper (`src/storage/ipfs/IpfsHelper.ts`)

A wrapper class around the IPFS HTTP client that:
- Connects to an IPFS node (local or remote)
- Provides Node.js-compatible file system interface
- Handles MFS operations (read, write, mkdir, readdir, etc.)
- Maps IPFS errors to Node.js system errors

### 2. IpfsDataAccessor (`src/storage/accessors/IpfsDataAccessor.ts`)

Implements the `DataAccessor` interface for IPFS:
- Stores documents and containers on IPFS MFS
- Manages metadata files
- Adds IPFS-specific metadata (CID) to resources
- Handles resource CRUD operations

## Prerequisites

You need an IPFS node running and accessible. You have two options:

### Option 1: Use IPFS Desktop or Kubo

1. Install [IPFS Desktop](https://docs.ipfs.tech/install/ipfs-desktop/) or [Kubo](https://docs.ipfs.tech/install/command-line/)
2. Start the IPFS daemon:
   ```bash
   ipfs daemon
   ```
3. The default API endpoint is `http://127.0.0.1:5001`

### Option 2: Use Docker

```bash
docker run -d --name ipfs_host \
  -p 4001:4001 \
  -p 5001:5001 \
  -p 8080:8080 \
  ipfs/kubo:latest
```

## Installation

1. Install dependencies:
   ```bash
   cd CommunitySolidServer
   npm install
   ```

2. Build the server:
   ```bash
   npm run build
   ```

## Usage

### Running with IPFS Backend

Start the server with the IPFS configuration:

```bash
npm start -- -c config/ipfs.json -f .data
```

Or directly:

```bash
node bin/server.js -c config/ipfs.json -f .data
```

### Configuration

The IPFS backend is configured through `config/ipfs.json` which uses:
- `config/storage/backend/ipfs.json` - Main IPFS backend configuration
- `config/storage/backend/data-accessors/ipfs.json` - IpfsHelper and IpfsDataAccessor setup

To customize the IPFS connection, modify `config/storage/backend/data-accessors/ipfs.json`:

```json
{
  "@graph": [
    {
      "@id": "urn:solid-server:default:IpfsHelper",
      "@type": "IpfsHelper",
      "IpfsHelper:_url": "http://127.0.0.1:5001"
    }
  ]
}
```

## Accessing Your Data on IPFS

1. Start the server with IPFS backend
2. Create some resources using Solid apps
3. Check the IPFS MFS:
   ```bash
   ipfs files ls /
   ```

4. Get the root CID:
   ```bash
   ipfs files stat /
   ```

5. View your data through IPFS gateway:
   ```
   http://localhost:8080/ipfs/<CID>
   ```

## Metadata

The IPFS backend adds custom metadata to resources:

```turtle
@prefix ipfs: <http://ipfs.io/ns/ipfs#> .

<resource>
  ipfs:cid <ipfs://QmXHv61YkhVXazoq8Qa55HyiyP7VXhxDu7kMbTnTHqRxx5> .
```

This allows clients to:
- Verify content integrity
- Access resources directly via IPFS
- Track resource versions

## Testing with Solid Apps

Compatible Solid apps that have been tested:

1. **Solid File Browser**: Full functionality for browsing, creating, and editing files
2. **MediaKraken**: Movie list management
3. **Solid Focus**: Task management
4. **Dokieli**: Document editing and publishing

## Limitations

- The server connects to IPFS via HTTP API (kubo-rpc-client)
- No built-in IPFS node embedding (requires external IPFS daemon)
- Resource locking uses memory storage (not IPFS-backed)
- No automatic garbage collection of old versions

## Future Enhancements

Potential improvements based on the research paper:

1. **Offline-first support**: Enable offline editing with conflict resolution
2. **Version history**: Leverage IPFS immutability for resource versioning
3. **Pod migration**: Simplify moving pods between providers using CIDs
4. **IPFS Cluster**: Distribute storage across multiple IPFS nodes
5. **Filecoin integration**: Long-term storage incentivization

## References

- Research Paper: "Solid over the Interplanetary File System" (2021)
- [Solid Protocol](https://solidproject.org/TR/protocol)
- [IPFS Documentation](https://docs.ipfs.tech/)
- [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer)

## License

Same as Community Solid Server (MIT)
