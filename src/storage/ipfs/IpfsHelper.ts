import type { StatsBase } from 'node:fs';
import { Readable } from 'node:stream';
import type { SystemError } from '../../util/errors/SystemError';
import { getLoggerFor } from '../../logging/LogUtil';

/* eslint-disable @typescript-eslint/naming-convention */

// Use dynamic import for ESM modules
let createClient: any;
let clientPromise: Promise<void>;

/**
 * Helper class to interact with IPFS using the Mutable File System (MFS).
 * This class wraps IPFS operations and harmonizes them with Node.js file system interface.
 */
export class IpfsHelper {
  protected readonly logger = getLoggerFor(this);
  private client: any;
  private readonly initPromise: Promise<void>;

  public constructor(options?: { url?: string; repo?: string }) {
    // Create IPFS client - can connect to external IPFS node or create embedded one
    const url = options?.url || 'http://127.0.0.1:5002';
    this.logger.info(`Connecting to IPFS at ${url}`);
    
    // Initialize client asynchronously
    this.initPromise = this.initClient(url);
  }

  private async initClient(url: string): Promise<void> {
    if (!clientPromise) {
      clientPromise = import('kubo-rpc-client').then((module) => {
        createClient = module.create;
      });
    }
    await clientPromise;
    this.client = createClient({ url });
  }

  private async ensureClient(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Write data to a file in IPFS MFS
   */
  public async write(file: { path: string; content: Readable }): Promise<void> {
    await this.ensureClient();
    this.logger.debug(`Writing to IPFS: ${file.path}`);
    const mfs = this.client.files;
    await mfs.write(file.path, file.content, { 
      create: true, 
      parents: true,
      mtime: new Date() 
    });
  }

  /**
   * Read data from a file in IPFS MFS
   */
  public async read(path: string): Promise<Readable> {
    await this.ensureClient();
    this.logger.debug(`Reading from IPFS: ${path}`);
    const mfs = this.client.files;
    return Readable.from(mfs.read(path));
  }

  /**
   * Get file/directory statistics
   */
  public async lstat(path: string): Promise<IpfsStats> {
    await this.ensureClient();
    this.logger.debug(`IPFS lstat: ${path}`);
    try {
      const mfs = this.client.files;
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
      if ((error as any).code && (error as any).code === 'ERR_NOT_FOUND') {
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
    await this.ensureClient();
    this.logger.debug(`IPFS mkdir: ${path}`);
    try {
      const mfs = this.client.files;
      await mfs.mkdir(path, { parents: true });
      this.logger.debug(`Created directory: ${path}`);
    } catch (error: unknown) {
      // IPFS returns different error codes, need to map them
      if ((error as any).code && ((error as any).code === 'ERR_LOCK_EXISTS' || (error as any).message?.includes('already exists'))) {
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
    await this.ensureClient();
    this.logger.debug(`Reading directory: ${path}`);
    const mfs = this.client.files;
    const entries: string[] = [];
    
    try {
      for await (const entry of mfs.ls(path)) {
        entries.push(entry.name);
      }
    } catch (error: unknown) {
      if ((error as any).code && (error as any).code === 'ERR_NOT_FOUND') {
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
    await this.ensureClient();
    this.logger.debug(`Removing directory: ${path}`);
    const mfs = this.client.files;
    try {
      await mfs.rm(path, { recursive: true });
    } catch (error: unknown) {
      if ((error as any).code && (error as any).code === 'ERR_NOT_FOUND') {
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
    await this.ensureClient();
    this.logger.debug(`Unlinking file: ${path}`);
    const mfs = this.client.files;
    try {
      await mfs.rm(path);
    } catch (error: unknown) {
      if ((error as any).code && (error as any).code === 'ERR_NOT_FOUND') {
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
    this.logger.info('Stopping IPFS client');
    // HTTP client doesn't need explicit stop
  }
}

/**
 * Extended stats interface that includes IPFS CID
 */
export interface IpfsStats extends StatsBase<number> {
  cid: any; // CID type from multiformats
}
