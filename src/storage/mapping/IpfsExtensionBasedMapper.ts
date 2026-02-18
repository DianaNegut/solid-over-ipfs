import { getLoggerFor } from '../../logging/LogUtil';
import type { IpfsHelper } from '../ipfs/IpfsHelper';
import { ExtensionBasedMapper } from './ExtensionBasedMapper';

/**
 * Extension of {@link ExtensionBasedMapper} that uses IPFS MFS for directory listing
 * instead of the local filesystem. This is necessary because in the IPFS backend,
 * files (including those with `$` content-type extensions) are stored in IPFS MFS,
 * not on the local disk.
 *
 * Without this override, `mapUrlToDocumentPath` cannot find files like `card$.ttl`
 * because `fsPromises.readdir` reads the local filesystem where they don't exist.
 */
export class IpfsExtensionBasedMapper extends ExtensionBasedMapper {
  protected override readonly logger = getLoggerFor(this);
  private readonly ipfsHelper: IpfsHelper;

  public constructor(
    base: string,
    rootFilepath: string,
    ipfsHelper: IpfsHelper,
    customTypes?: Record<string, string>,
  ) {
    super(base, rootFilepath, customTypes);
    this.ipfsHelper = ipfsHelper;
    this.logger.info(`IpfsExtensionBasedMapper initialized with IPFS-backed directory listing`);
  }

  /**
   * Converts an absolute file system path to an IPFS MFS path.
   * Removes Windows drive letters, normalizes separators,
   * and strips the path prefix up to the .data* directory.
   *
   * @param absolutePath - The absolute file path (e.g., C:\ATM\...\.data1\d\profile\)
   * @returns IPFS MFS path (e.g., /.data1/d/profile/)
   */
  private toIpfsPath(absolutePath: string): string {
    // Remove Windows drive letter if present (C:/, D:/, etc.)
    let path = absolutePath.replace(/^[a-zA-Z]:[\\/]/, '/');
    // Convert backslashes to forward slashes
    path = path.replace(/\\/g, '/');

    // Extract relative path from root filepath
    // Look for .data directory (with or without trailing slash/number)
    const dataMatch = path.match(/\/(\.data\d*)($|\/)/);
    if (dataMatch) {
      // Extract everything from .data onwards
      const dataIndex = path.indexOf(dataMatch[1]);
      path = '/' + path.substring(dataIndex);
    }

    // Remove double slashes
    path = path.replace(/\/+/g, '/');
    return path;
  }

  /**
   * Overrides the directory listing to use IPFS MFS instead of the local filesystem.
   * This allows the `$` extension resolution in `mapUrlToDocumentPath` to work
   * correctly when files are stored on IPFS.
   *
   * @param folder - The absolute directory path to list.
   * @returns Array of file/directory names from IPFS MFS.
   */
  protected override async getFilesInDirectory(folder: string): Promise<string[]> {
    const ipfsPath = this.toIpfsPath(folder);
    this.logger.debug(`IPFS readdir for: ${ipfsPath}`);
    return this.ipfsHelper.readdir(ipfsPath);
  }
}
