import type { StatsBase } from 'node:fs';
import { Readable } from 'node:stream';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { SystemError } from '../../util/errors/SystemError';
import { getLoggerFor } from '../../logging/LogUtil';

/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Helper class to interact with IPFS using the Mutable File System (MFS).
 * Connects to an external IPFS node (Kubo) via HTTP API.
 * Supports private IPFS networks with swarm keys.
 */
export class IpfsHelper {
  protected readonly logger = getLoggerFor(this);
  private client: any;
  private readonly url: string;
  private readonly privateNetwork: boolean;
  private initPromise: Promise<void> | null = null;

  public constructor(options?: { url?: string; swarmKey?: string; privateNetwork?: boolean }) {
    this.url = options?.url || 'http://127.0.0.1:5001';
    this.privateNetwork = options?.privateNetwork ?? false;
    
    if (this.privateNetwork) {
      this.logger.info(`Connecting to IPFS node at ${this.url} (PRIVATE NETWORK)`);
    } else {
      this.logger.info(`Connecting to IPFS node at ${this.url}`);
    }
  }

  private async initClient(): Promise<void> {
    if (this.client) {
      return;
    }

    try {
      // Dynamic import for ESM module
      const { create } = await import('ipfs-http-client');

      this.logger.info('Connecting to IPFS HTTP API...');
      
      this.client = create({ url: this.url });
      
      // Test connection and get node info
      try {
        const id = await this.client.id();
        this.logger.info(`✅ Connected to IPFS node`);
        this.logger.info(`📌 Peer ID: ${id.id}`);
      } catch (idError: any) {
        // If id() fails due to protocol parsing (e.g., webrtc-direct), test with version instead
        if (idError.message?.includes('no protocol with name')) {
          this.logger.warn('⚠️ Unable to parse peer addresses (incompatible protocols), but connection is working');
          const version = await this.client.version();
          this.logger.info(`✅ Connected to IPFS node (version: ${version.version})`);
        } else {
          throw idError;
        }
      }
      
      if (this.privateNetwork) {
        this.logger.info('🔐 Running in PRIVATE NETWORK mode');
      }
      
      // Initialize root directory in MFS
      await this.initializeRootDirectory();
    } catch (error) {
      this.logger.error(`Failed to connect to IPFS node at ${this.url}: ${error}`);
      this.logger.error('Make sure Kubo (IPFS) daemon is running: ipfs daemon');
      throw error;
    }

  }

  /**
   * Initialize the root directory structure in IPFS MFS
   */
  private async initializeRootDirectory(): Promise<void> {
    try {
      // Check if root exists
      try {
        await this.client.files.stat('/');
        this.logger.debug('IPFS MFS root already exists');
      } catch {
        this.logger.debug('IPFS MFS root verified');
      }
      
      // Ensure .data directory exists for the server
      try {
        await this.client.files.stat('/.data');
        this.logger.debug('IPFS MFS /.data directory already exists');
      } catch {
        this.logger.info('Creating IPFS MFS /.data directory');
        await this.client.files.mkdir('/.data', { parents: true });
      }
    } catch (error) {
      this.logger.warn(`Could not initialize root directory: ${error}`);
      // Don't throw - this is not critical, directories will be created on demand
    }
  }

  private async ensureClient(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initClient();
    }
    await this.initPromise;
  }

  private async mfs(): Promise<any> {
    await this.ensureClient();
    return this.client.files;
  }

  /**
   * Write data to a file in IPFS network and MFS.
   * This ensures the file is available for P2P distribution.
   * 
   * Flow:
   * 1. Add content to IPFS network (makes it available P2P)
   * 2. Pin the CID locally (ensures it stays available)
   * 3. Copy to MFS path (for organization and file system-like access)
   */
  public async write(file: { path: string; content: Readable }): Promise<void> {
    this.logger.info(`📝 IPFS Write: ${file.path}`);
    await this.ensureClient();
    
    try {
      // Step 1: Add content to IPFS network
      // This makes the data available for P2P distribution
      this.logger.debug(`  ➜ Adding to IPFS network...`);
      const addResult = await this.client.add(file.content, {
        pin: true, // Automatically pin after adding
        cidVersion: 1,
        wrapWithDirectory: false
      });
      
      const cid = addResult.cid.toString();
      this.logger.info(`  ✅ Added to IPFS network: ${cid}`);
      this.logger.info(`  📌 Pinned locally for persistence`);
      
      // Step 2: Copy from IPFS network to MFS path
      // This allows file system-like organization while keeping P2P availability
      this.logger.debug(`  ➜ Copying to MFS: ${file.path}`);
      const mfs = await this.mfs();
      
      // Remove existing file if present (to overwrite)
      try {
        await mfs.rm(file.path);
      } catch (error: any) {
        // Ignore if file doesn't exist
        if (error.code !== 'ERR_NOT_FOUND' && !error.message?.includes('does not exist')) {
          throw error;
        }
      }
      
      // Copy from IPFS to MFS
      await mfs.cp(`/ipfs/${cid}`, file.path, { parents: true });
      
      this.logger.info(`  ✅ File ready: ${file.path}`);
      this.logger.info(`  🌐 Available in P2P network as: ${cid}`);
      
    } catch (error: any) {
      this.logger.error(`❌ IPFS write failed for ${file.path}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Read data from a file in IPFS MFS
   */
  public async read(path: string): Promise<Readable> {
    this.logger.debug(`Reading from IPFS: ${path}`);
    const mfs = await this.mfs();
    return Readable.from(mfs.read(path));
  }

  /**
   * Get file/directory statistics
   */
  public async lstat(path: string): Promise<IpfsStats> {
    this.logger.debug(`IPFS lstat: ${path}`);
    try {
      const mfs = await this.mfs();
      const stats = await mfs.stat(path);

      return {
        isDirectory: (): boolean => stats.type === 'directory',
        isFile: (): boolean => stats.type === 'file',
        isBlockDevice: (): boolean => false,
        isCharacterDevice: (): boolean => false,
        isSymbolicLink: (): boolean => false,
        isFIFO: (): boolean => false,
        isSocket: (): boolean => false,
        dev: 0,
        ino: 0,
        mode: stats.mode || 0,
        nlink: 1,
        uid: 0,
        gid: 0,
        rdev: 0,
        size: stats.size,
        blksize: 0,
        blocks: 0,
        atimeMs: stats.mtime?.secs ? stats.mtime.secs * 1000 : Date.now(),
        mtimeMs: stats.mtime?.secs ? stats.mtime.secs * 1000 : Date.now(),
        ctimeMs: stats.mtime?.secs ? stats.mtime.secs * 1000 : Date.now(),
        birthtimeMs: stats.mtime?.secs ? stats.mtime.secs * 1000 : Date.now(),
        atime: stats.mtime?.secs ? new Date(stats.mtime.secs * 1000) : new Date(),
        mtime: stats.mtime?.secs ? new Date(stats.mtime.secs * 1000) : new Date(),
        ctime: stats.mtime?.secs ? new Date(stats.mtime.secs * 1000) : new Date(),
        birthtime: stats.mtime?.secs ? new Date(stats.mtime.secs * 1000) : new Date(),
        cid: stats.cid,
      };
    } catch (error: unknown) {
      // Handle both ERR_NOT_FOUND code and various error message formats
      const errorCode = (error as any).code;
      const errorMessage = (error as any).message || '';
      if (errorCode === 'ERR_NOT_FOUND' || errorMessage.includes('file does not exist') || errorMessage.includes('does not exist')) {
        const sysError: SystemError = {
          ...(error as SystemError),
          code: 'ENOENT',
          syscall: 'stat',
          errno: -2,
          path
        };
        throw sysError;
      }
      throw error;
    }
  }

  /**
   * Create a directory in IPFS MFS
   */
  public async mkdir(path: string): Promise<void> {
    this.logger.debug(`IPFS mkdir: ${path}`);
    try {
      const mfs = await this.mfs();
      await mfs.mkdir(path, { parents: true });
      this.logger.debug(`Created directory: ${path}`);
    } catch (error: unknown) {
      // IPFS returns different error codes, need to map them
      const errorCode = (error as any).code;
      const errorMessage = (error as any).message || '';
      if (errorCode === 'ERR_LOCK_EXISTS' || errorMessage.includes('already exists')) {
        const sysError: SystemError = {
          ...(error as SystemError),
          code: 'EEXIST',
          syscall: 'mkdir',
          errno: -17,
          path
        };
        throw sysError;
      }
      throw error;
    }
  }

  /**
   * List directory contents
   */
  public async readdir(path: string): Promise<string[]> {
    this.logger.debug(`Reading directory: ${path}`);
    const mfs = await this.mfs();
    const entries: string[] = [];

    try {
      for await (const entry of mfs.ls(path)) {
        entries.push(entry.name);
      }
    } catch (error: unknown) {
      const errorCode = (error as any).code;
      const errorMessage = (error as any).message || '';
      if (errorCode === 'ERR_NOT_FOUND' || errorMessage.includes('file does not exist') || errorMessage.includes('does not exist')) {
        const sysError: SystemError = {
          ...(error as SystemError),
          code: 'ENOENT',
          syscall: 'readdir',
          errno: -2,
          path
        };
        throw sysError;
      }
      throw error;
    }

    return entries;
  }

  /**
   * Remove a directory (recursively)
   */
  public async rmdir(path: string): Promise<void> {
    this.logger.debug(`Removing directory: ${path}`);
    const mfs = await this.mfs();
    try {
      await mfs.rm(path, { recursive: true });
    } catch (error: unknown) {
      const errorCode = (error as any).code;
      const errorMessage = (error as any).message || '';
      if (errorCode === 'ERR_NOT_FOUND' || errorMessage.includes('file does not exist') || errorMessage.includes('does not exist')) {
        const sysError: SystemError = {
          ...(error as SystemError),
          code: 'ENOENT',
          syscall: 'rmdir',
          errno: -2,
          path
        };
        throw sysError;
      }
      throw error;
    }
  }

  /**
   * Remove a file
   */
  public async unlink(path: string): Promise<void> {
    this.logger.debug(`Unlinking file: ${path}`);
    const mfs = await this.mfs();
    try {
      await mfs.rm(path);
    } catch (error: unknown) {
      const errorCode = (error as any).code;
      const errorMessage = (error as any).message || '';
      if (errorCode === 'ERR_NOT_FOUND' || errorMessage.includes('file does not exist') || errorMessage.includes('does not exist')) {
        const sysError: SystemError = {
          ...(error as SystemError),
          code: 'ENOENT',
          syscall: 'unlink',
          errno: -2,
          path
        };
        throw sysError;
      }
      throw error;
    }
  }

  /**
   * Add content to IPFS network WITHOUT copying to MFS.
   * Used for large files — blocks are pinned locally but no MFS directory entry is created.
   * Returns the CID string of the added content.
   */
  public async addContent(content: Readable): Promise<string> {
    await this.ensureClient();
    this.logger.info('Adding content to IPFS network (staging pin — provider will be sole long-term pinner)...');
    // Add WITHOUT implicit pin first — older ipfs-http-client versions silently drop
    // the pin:true option for dag-pb (chunked) CIDv1 content.
    const addResult = await this.client.add(content, {
      pin: false,
      cidVersion: 1,
      wrapWithDirectory: false,
    });
    const cid = addResult.cid.toString();

    // Explicitly pin via client.pin.add() which is more reliable than pin:true in add().
    // This is a TEMPORARY staging pin — staging-cleanup removes it once the provider
    // has confirmed pinning so that CSS never becomes the permanent storage node.
    try {
      await this.client.pin.add(addResult.cid);
      this.logger.info(`✅ Added & staging-pinned: ${cid}`);
      this.logger.info(`📌 Staging pin created — will be removed after provider confirms deal`);
    } catch (pinErr: any) {
      this.logger.warn(`⚠️  pin.add() failed for ${cid}: ${pinErr.message}`);
      this.logger.warn(`    Content is in blockstore but unprotected — provider must fetch before next repo gc`);
    }

    return cid;
  }

  /**
   * Stream content by CID from the IPFS network.
   * If pinned locally, blocks are served from local store; otherwise fetched from peers.
   */
  public async cat(cid: string): Promise<Readable> {
    await this.ensureClient();
    this.logger.debug(`Streaming CID from IPFS network: ${cid}`);
    return Readable.from(this.client.cat(cid));
  }

  /**
   * Check if an MFS path exists without throwing on ENOENT.
   */
  public async exists(path: string): Promise<boolean> {
    try {
      await this.lstat(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stop/close the IPFS client
   */
  public async stop(): Promise<void> {
    this.logger.info('Disconnecting from IPFS node');
    if (this.client) {
      // HTTP client doesn't need explicit cleanup
      this.client = null;
      this.initPromise = null;
    }
  }
}

/**
 * Extended stats interface that includes IPFS CID
 */
export interface IpfsStats extends StatsBase<number> {
  cid: any; // CID type from multiformats
}
