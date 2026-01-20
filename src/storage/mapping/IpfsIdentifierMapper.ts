import type { ResourceIdentifier } from '../../http/representation/ResourceIdentifier';
import { getLoggerFor } from '../../logging/LogUtil';
import { ExtensionBasedMapper } from './ExtensionBasedMapper';
import type { FileIdentifierMapper, ResourceLink } from './FileIdentifierMapper';

/**
 * Maps resource identifiers to IPFS MFS (Mutable File System) paths.
 * Converts absolute Windows/Unix file paths to relative IPFS MFS paths.
 * 
 * Example transformations:
 * - C:\ATM\UPGRADE\CommunitySolidServer\.data\test.txt -> /test.txt
 * - /home/user/solid/.data/pod/file.txt -> /pod/file.txt
 */
export class IpfsIdentifierMapper implements FileIdentifierMapper {
  protected readonly logger = getLoggerFor(this);
  private readonly baseMapper: ExtensionBasedMapper;
  private readonly rootFilepath: string;

  public constructor(base: string, rootFilepath: string) {
    this.baseMapper = new ExtensionBasedMapper(base, rootFilepath);
    this.rootFilepath = rootFilepath;
    this.logger.debug(`IpfsIdentifierMapper initialized with base: ${base}, rootFilepath: ${rootFilepath}`);
  }

  public async mapUrlToFilePath(
    identifier: ResourceIdentifier,
    isMetadata: boolean,
    contentType?: string,
  ): Promise<ResourceLink> {
    const link = await this.baseMapper.mapUrlToFilePath(identifier, isMetadata, contentType);
    
    // Convert Windows/Unix absolute path to IPFS MFS relative path
    const ipfsPath = this.convertToIpfsPath(link.filePath);
    
    this.logger.debug(`Mapped URL ${identifier.path} to IPFS path ${ipfsPath}`);
    
    return {
      ...link,
      filePath: ipfsPath,
    };
  }

  public async mapFilePathToUrl(
    filePath: string,
    isContainer: boolean,
  ): Promise<ResourceLink> {
    // For reverse mapping, we need to convert IPFS path back to what the base mapper expects
    // We'll prepend the rootFilepath to make it look like an absolute path
    const absolutePath = this.convertFromIpfsPath(filePath);
    return this.baseMapper.mapFilePathToUrl(absolutePath, isContainer);
  }

  /**
   * Converts an absolute file system path to an IPFS MFS relative path.
   * 
   * @param absolutePath - The absolute file path from FileIdentifierMapper
   * @returns IPFS MFS path starting with /
   */
  private convertToIpfsPath(absolutePath: string): string {
    // Remove Windows drive letter if present (C:/, D:/, etc.)
    let path = absolutePath.replace(/^[a-zA-Z]:[\\/]/, '');
    
    // Convert backslashes to forward slashes
    path = path.replace(/\\/g, '/');
    
    // Normalize the rootFilepath for comparison
    let normalizedRoot = this.rootFilepath.replace(/^[a-zA-Z]:[\\/]/, '');
    normalizedRoot = normalizedRoot.replace(/\\/g, '/');
    
    // Remove trailing slash from root if present
    if (normalizedRoot.endsWith('/')) {
      normalizedRoot = normalizedRoot.slice(0, -1);
    }
    
    // If path starts with the root filepath, extract the relative part
    if (path.startsWith(normalizedRoot)) {
      path = path.substring(normalizedRoot.length);
    }
    
    // Ensure path starts with a single leading slash
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    
    // Remove double slashes
    path = path.replace(/\/+/g, '/');
    
    this.logger.debug(`Converted ${absolutePath} -> ${path}`);
    return path;
  }

  /**
   * Converts an IPFS MFS path back to an absolute file system path.
   * Used for reverse mapping (IPFS path -> URL).
   * 
   * @param ipfsPath - The IPFS MFS path
   * @returns Absolute file path
   */
  private convertFromIpfsPath(ipfsPath: string): string {
    // Remove leading slash
    const relativePath = ipfsPath.startsWith('/') ? ipfsPath.substring(1) : ipfsPath;
    
    // Combine with rootFilepath
    let absolutePath = `${this.rootFilepath}/${relativePath}`;
    
    // Remove double slashes
    absolutePath = absolutePath.replace(/\/+/g, '/');
    
    this.logger.debug(`Converted IPFS path ${ipfsPath} -> ${absolutePath}`);
    return absolutePath;
  }
}
