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

  public constructor(options?: { url?: string; repo?: string; swarmKey?: string; privateNetwork?: boolean }) {
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
      const id = await this.client.id();
      this.logger.info(`✅ Connected to IPFS node`);
      this.logger.info(`📌 Peer ID: ${id.id}`);
      
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
   * Write data to a file in IPFS MFS
   */
  public async write(file: { path: string; content: Readable }): Promise<void> {
    this.logger.warn(`🔴 IPFS WRITE CALLED: ${file.path}`);
    const mfs = await this.mfs();
    await mfs.write(file.path, file.content, {
      create: true,
      parents: true,
      mtime: new Date()
    });
    this.logger.warn(`✅ IPFS WRITE SUCCESS: ${file.path}`);
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
