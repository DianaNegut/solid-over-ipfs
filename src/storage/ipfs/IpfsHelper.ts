import type { StatsBase } from 'node:fs';
import { Readable } from 'node:stream';
import type { SystemError } from '../../util/errors/SystemError';
import { getLoggerFor } from '../../logging/LogUtil';

/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Helper class to interact with IPFS using the Mutable File System (MFS).
 * This class uses an embedded IPFS node for storage.
 */
export class IpfsHelper {
  protected readonly logger = getLoggerFor(this);
  private node: any;
  private readonly repo: string;
  private initPromise: Promise<void> | null = null;

  public constructor(options?: { url?: string; repo?: string }) {
    // Use repo path for embedded node, default to /tmp/solid-ipfs
    this.repo = options?.repo || '/tmp/solid-ipfs';
    this.logger.info(`Initializing embedded IPFS node with repo: ${this.repo}`);
  }

  private async initNode(): Promise<void> {
    if (this.node) {
      return;
    }

    try {
      // Dynamic import for ESM module
      const ipfsModule = await import('ipfs') as any;
      const create = ipfsModule.create;

      if (!create) {
        throw new Error('Could not find IPFS create function');
      }

      this.logger.info('Creating embedded IPFS node...');
      this.node = await create({
        repo: this.repo,
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
      this.logger.info('Embedded IPFS node started successfully');
    } catch (error) {
      this.logger.error(`Failed to create IPFS node: ${error}`);
      throw error;
    }
  }

  private async ensureNode(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initNode();
    }
    await this.initPromise;
  }

  private async mfs(): Promise<any> {
    await this.ensureNode();
    return this.node.files;
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
   * Stop/close the IPFS node
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping IPFS node');
    if (this.node) {
      await this.node.stop();
      this.node = null;
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
