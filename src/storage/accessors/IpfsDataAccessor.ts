import type { Readable } from 'node:stream';
import type { Representation } from '../../http/representation/Representation';
import { RepresentationMetadata } from '../../http/representation/RepresentationMetadata';
import type { ResourceIdentifier } from '../../http/representation/ResourceIdentifier';
import { getLoggerFor } from '../../logging/LogUtil';
import { NotFoundHttpError } from '../../util/errors/NotFoundHttpError';
import { isSystemError } from '../../util/errors/SystemError';
import { UnsupportedMediaTypeHttpError } from '../../util/errors/UnsupportedMediaTypeHttpError';
import { guardStream } from '../../util/GuardedStream';
import type { Guarded } from '../../util/GuardedStream';
import { parseContentType } from '../../util/HeaderUtil';
import { isContainerIdentifier, isContainerPath, joinFilePath } from '../../util/PathUtil';
import { parseQuads, serializeQuads } from '../../util/QuadUtil';
import { addResourceMetadata, updateModifiedDate } from '../../util/ResourceUtil';
import { toLiteral, toNamedTerm } from '../../util/TermUtil';
import { CONTENT_TYPE_TERM, DC, IANA, LDP, POSIX, RDF, SOLID_META, XSD } from '../../util/Vocabularies';
import type { FileIdentifierMapper, ResourceLink } from '../mapping/FileIdentifierMapper';
import type { IpfsHelper, IpfsStats } from '../ipfs/IpfsHelper';
import type { DataAccessor } from './DataAccessor';

/**
 * DataAccessor that uses IPFS to store documents as files and containers as folders.
 * This is adapted from FileDataAccessor to work with IPFS Mutable File System (MFS).
 */
export class IpfsDataAccessor implements DataAccessor {
  protected readonly logger = getLoggerFor(this);

  protected readonly resourceMapper: FileIdentifierMapper;
  protected readonly ipfsHelper: IpfsHelper;

  public constructor(resourceMapper: FileIdentifierMapper, ipfsHelper: IpfsHelper) {
    this.resourceMapper = resourceMapper;
    this.ipfsHelper = ipfsHelper;
  }

  /**
   * Ensures that the path starts with a leading slash as required by IPFS MFS.
   * Also removes Windows drive letters and absolute paths to create IPFS-compatible paths.
   * @param path - The file path to normalize (can be absolute Windows/Unix path).
   */
  private ensureLeadingSlash(path: string): string {
    // Remove Windows drive letter if present (C:/, D:/, etc.)
    let normalized = path.replace(/^[a-zA-Z]:[\\/]/, '/');
    
    // Replace backslashes with forward slashes
    normalized = normalized.replace(/\\/g, '/');
    
    // Extract relative path from root filepath
    // Remove any leading path components before .data
    const dataIndex = normalized.indexOf('/.data/');
    if (dataIndex !== -1) {
      // Keep everything from .data onwards
      normalized = normalized.substring(dataIndex);
    }
    
    // Ensure it starts with a single leading slash
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    
    // Remove double slashes
    normalized = normalized.replace(/\/+/g, '/');
    
    this.logger.debug(`Path normalized: ${path} -> ${normalized}`);
    return normalized;
  }

  /**
   * Only binary data can be directly stored as files so will error on non-binary data.
   */
  public async canHandle(representation: Representation): Promise<void> {
    if (!representation.binary) {
      throw new UnsupportedMediaTypeHttpError('Only binary data is supported.');
    }
  }

  /**
   * Will return data stream directly to the file corresponding to the resource.
   * Will throw NotFoundHttpError if the input is a container.
   */
  public async getData(identifier: ResourceIdentifier): Promise<Guarded<Readable>> {
    const link = await this.resourceMapper.mapUrlToFilePath(identifier, false);
    const stats = await this.getStats(this.ensureLeadingSlash(link.filePath));

    if (stats.isFile()) {
      return guardStream(await this.ipfsHelper.read(this.ensureLeadingSlash(link.filePath)));
    }

    throw new NotFoundHttpError();
  }

  /**
   * Will return corresponding metadata by reading the metadata file (if it exists)
   * and adding IPFS specific metadata elements.
   */
  public async getMetadata(identifier: ResourceIdentifier): Promise<RepresentationMetadata> {
    const link = await this.resourceMapper.mapUrlToFilePath(identifier, false);
    
    // For containers, try to get stats, and if it doesn't exist, create it
    if (isContainerIdentifier(identifier)) {
      try {
        const stats = await this.getStats(this.ensureLeadingSlash(link.filePath));
        return this.getDirectoryMetadata(link, stats);
      } catch (error: unknown) {
        if (isSystemError(error) && error.code === 'ENOENT') {
          // Directory doesn't exist, create it
          this.logger.debug(`Creating directory in IPFS: ${link.filePath}`);
          await this.ipfsHelper.mkdir(this.ensureLeadingSlash(link.filePath));
          // After creating, get the stats
          const stats = await this.getStats(this.ensureLeadingSlash(link.filePath));
          return this.getDirectoryMetadata(link, stats);
        }
        throw error;
      }
    }
    
    // For files
    const stats = await this.getStats(this.ensureLeadingSlash(link.filePath));
    if (stats.isFile()) {
      return this.getFileMetadata(link, stats);
    }
    throw new NotFoundHttpError();
  }

  public async* getChildren(identifier: ResourceIdentifier): AsyncIterableIterator<RepresentationMetadata> {
    const link = await this.resourceMapper.mapUrlToFilePath(identifier, false);
    yield* this.getChildMetadata(link);
  }

  /**
   * Writes the given data as a file (and potential metadata as additional file).
   * The metadata file will be written first and will be deleted if something goes wrong writing the actual data.
   */
  public async writeDocument(identifier: ResourceIdentifier, data: Guarded<Readable>, metadata: RepresentationMetadata):
  Promise<void> {
    const link = await this.resourceMapper.mapUrlToFilePath(identifier, false, metadata.contentType);

    // Check if we already have a corresponding file with a different extension
    await this.verifyExistingExtension(link);

    const wroteMetadata = await this.writeMetadataFile(link, metadata);

    try {
      await this.writeDataFile(this.ensureLeadingSlash(link.filePath), data);
    } catch (error: unknown) {
      // Delete the metadata if there was an error writing the file
      if (wroteMetadata) {
        const metaLink = await this.resourceMapper.mapUrlToFilePath(identifier, true);
        try {
          await this.ipfsHelper.unlink(this.ensureLeadingSlash(metaLink.filePath));
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }

  /**
   * Creates corresponding folder if necessary and writes metadata to metadata file if necessary.
   */
  public async writeContainer(identifier: ResourceIdentifier, metadata: RepresentationMetadata): Promise<void> {
    const link = await this.resourceMapper.mapUrlToFilePath(identifier, false);
    
    try {
      await this.ipfsHelper.mkdir(this.ensureLeadingSlash(link.filePath));
    } catch (error: unknown) {
      // Ignore if directory already exists
      if (!isSystemError(error) || error.code !== 'EEXIST') {
        throw error;
      }
    }

    await this.writeMetadataFile(link, metadata);
  }

  public async writeMetadata(identifier: ResourceIdentifier, metadata: RepresentationMetadata): Promise<void> {
    const metadataLink = await this.resourceMapper.mapUrlToFilePath(identifier, true);
    await this.writeMetadataFile(metadataLink, metadata);
  }

  /**
   * Removes the corresponding file/folder (and metadata file).
   */
  public async deleteResource(identifier: ResourceIdentifier): Promise<void> {
    const metaLink = await this.resourceMapper.mapUrlToFilePath(identifier, true);
    try {
      await this.ipfsHelper.unlink(this.ensureLeadingSlash(metaLink.filePath));
    } catch (error: unknown) {
      // Ignore if metadata file doesn't exist
      if (!isSystemError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }

    const link = await this.resourceMapper.mapUrlToFilePath(identifier, false);
    const stats = await this.getStats(this.ensureLeadingSlash(link.filePath));

    if (!isContainerIdentifier(identifier) && stats.isFile()) {
      await this.ipfsHelper.unlink(this.ensureLeadingSlash(link.filePath));
    } else if (isContainerIdentifier(identifier) && stats.isDirectory()) {
      await this.ipfsHelper.rmdir(this.ensureLeadingSlash(link.filePath));
    } else {
      throw new NotFoundHttpError();
    }
  }

  /**
   * Gets the Stats object corresponding to the given file path.
   *
   * @param path - File path to get info from.
   *
   * @throws NotFoundHttpError
   * If the file/folder doesn't exist.
   */
  protected async getStats(path: string): Promise<IpfsStats> {
    try {
      return await this.ipfsHelper.lstat(path);
    } catch (error: unknown) {
      if (isSystemError(error) && error.code === 'ENOENT') {
        throw new NotFoundHttpError('', { cause: error });
      }
      throw error;
    }
  }

  /**
   * Reads and generates all metadata relevant for the given file,
   * ingesting it into a RepresentationMetadata object.
   *
   * @param link - Path related metadata.
   * @param stats - Stats object of the corresponding file.
   */
  private async getFileMetadata(link: ResourceLink, stats: IpfsStats):
  Promise<RepresentationMetadata> {
    const metadata = await this.getBaseMetadata(link, stats, false);
    // If the resource is using an unsupported contentType, the original contentType was written to the metadata file.
    if (typeof metadata.contentType === 'undefined') {
      metadata.set(CONTENT_TYPE_TERM, link.contentType);
    }
    return metadata;
  }

  /**
   * Reads and generates all metadata relevant for the given directory,
   * ingesting it into a RepresentationMetadata object.
   *
   * @param link - Path related metadata.
   * @param stats - Stats object of the corresponding directory.
   */
  private async getDirectoryMetadata(link: ResourceLink, stats: IpfsStats):
  Promise<RepresentationMetadata> {
    return this.getBaseMetadata(link, stats, true);
  }

  /**
   * Writes the metadata of the resource to a meta file.
   *
   * @param link - Path related metadata of the resource.
   * @param metadata - Metadata to write.
   *
   * @returns True if data was written to a file.
   */
  protected async writeMetadataFile(link: ResourceLink, metadata: RepresentationMetadata): Promise<boolean> {
    // These are stored by file system conventions
    metadata.remove(RDF.terms.type, LDP.terms.Resource);
    metadata.remove(RDF.terms.type, LDP.terms.Container);
    metadata.remove(RDF.terms.type, LDP.terms.BasicContainer);
    metadata.removeAll(DC.terms.modified);
    // When writing metadata for a document, only remove the content-type when dealing with a supported media type.
    if (isContainerPath(link.filePath) || typeof link.contentType !== 'undefined') {
      metadata.removeAll(CONTENT_TYPE_TERM);
    }
    const quads = metadata.quads();
    const metadataLink = await this.resourceMapper.mapUrlToFilePath(link.identifier, true);
    let wroteMetadata: boolean;

    // Write metadata to file if there are quads remaining
    if (quads.length > 0) {
      const serializedMetadata = serializeQuads(quads, metadataLink.contentType);
      await this.writeDataFile(this.ensureLeadingSlash(metadataLink.filePath), serializedMetadata);
      wroteMetadata = true;
    } else {
      // Delete existing metadata file if no metadata needs to be stored
      try {
        await this.ipfsHelper.unlink(this.ensureLeadingSlash(metadataLink.filePath));
      } catch (error: unknown) {
        // Ignore if it doesn't exist
        if (!isSystemError(error) || error.code !== 'ENOENT') {
          throw error;
        }
      }
      wroteMetadata = false;
    }
    return wroteMetadata;
  }

  /**
   * Generates metadata relevant for any resources stored by this accessor.
   *
   * @param link - Path related metadata.
   * @param stats - Stats objects of the corresponding directory.
   * @param isContainer - If the path points to a container (directory) or not.
   */
  private async getBaseMetadata(link: ResourceLink, stats: IpfsStats, isContainer: boolean):
  Promise<RepresentationMetadata> {
    const metadata = await this.getRawMetadata(link.identifier);
    addResourceMetadata(metadata, isContainer);
    this.addPosixMetadata(metadata, stats);
    this.addIpfsMetadata(metadata, stats);
    return metadata;
  }

  /**
   * Reads the metadata from the corresponding metadata file.
   * Returns empty metadata if there is no metadata file.
   *
   * @param identifier - Identifier of the resource (not the metadata!).
   */
  private async getRawMetadata(identifier: ResourceIdentifier): Promise<RepresentationMetadata> {
    try {
      const metadataLink = await this.resourceMapper.mapUrlToFilePath(identifier, true);

      // Check if the metadata file exists first
      await this.ipfsHelper.lstat(this.ensureLeadingSlash(metadataLink.filePath));

      const readMetadataStream = guardStream(await this.ipfsHelper.read(this.ensureLeadingSlash(metadataLink.filePath)));
      const quads = await parseQuads(
        readMetadataStream,
        { format: metadataLink.contentType, baseIRI: identifier.path },
      );
      const metadata = new RepresentationMetadata(identifier).addQuads(quads);

      return metadata;
    } catch (error: unknown) {
      // Metadata file doesn't exist so return empty metadata
      if (!isSystemError(error) || error.code !== 'ENOENT') {
        throw error;
      }
      return new RepresentationMetadata(identifier);
    }
  }

  /**
   * Generate metadata for all children in a container.
   *
   * @param link - Path related metadata.
   */
  private async* getChildMetadata(link: ResourceLink): AsyncIterableIterator<RepresentationMetadata> {
    const files = await this.ipfsHelper.readdir(this.ensureLeadingSlash(link.filePath));

    // For every child in the container we want to generate specific metadata
    for (const childName of files) {
      // Obtain details of the entry
      const childPath = joinFilePath(this.ensureLeadingSlash(link.filePath), childName);
      let childStats;
      try {
        childStats = await this.getStats(this.ensureLeadingSlash(childPath));
      } catch {
        // Skip this entry if details could not be retrieved
        continue;
      }

      // Ignore non-file/directory entries
      if (!childStats.isFile() && !childStats.isDirectory()) {
        continue;
      }

      // Generate the URI corresponding to the child resource
      const childLink = await this.resourceMapper.mapFilePathToUrl(childPath, childStats.isDirectory());

      // Hide metadata files
      if (childLink.isMetadata) {
        continue;
      }

      // Generate metadata for this child
      const metadata = new RepresentationMetadata(childLink.identifier);
      addResourceMetadata(metadata, childStats.isDirectory());
      this.addPosixMetadata(metadata, childStats);
      
      // Containers will not have a content-type
      const { contentType, identifier } = childLink;
      if (contentType) {
        try {
          const { value } = parseContentType(contentType);
          metadata.add(RDF.terms.type, toNamedTerm(`${IANA.namespace}${value}#Resource`));
        } catch {
          this.logger.warn(`Detected an invalid content-type "${contentType}" for ${identifier.path}`);
        }
      }

      yield metadata;
    }
  }

  /**
   * Helper function to add file system related metadata.
   *
   * @param metadata - metadata object to add to
   * @param stats - Stats of the file/directory corresponding to the resource.
   */
  private addPosixMetadata(metadata: RepresentationMetadata, stats: IpfsStats): void {
    updateModifiedDate(metadata, stats.mtime);
    metadata.add(
      POSIX.terms.mtime,
      toLiteral(Math.floor(stats.mtime.getTime() / 1000), XSD.terms.integer),
      SOLID_META.terms.ResponseMetadata,
    );
    if (!stats.isDirectory()) {
      metadata.add(POSIX.terms.size, toLiteral(stats.size, XSD.terms.integer), SOLID_META.terms.ResponseMetadata);
    }
  }

  /**
   * Helper function to add IPFS specific metadata (CID).
   *
   * @param metadata - metadata object to add to
   * @param stats - Stats of the file/directory corresponding to the resource.
   */
  private addIpfsMetadata(metadata: RepresentationMetadata, stats: IpfsStats): void {
    // Add IPFS CID as metadata
    const cidString = stats.cid.toString();
    metadata.add(
      toNamedTerm('http://ipfs.io/ns/ipfs#cid'),
      toNamedTerm(`ipfs://${cidString}`),
      SOLID_META.terms.ResponseMetadata,
    );
  }

  /**
   * Verifies if there already is a file corresponding to the given resource.
   * If yes, that file is removed if it does not match the path given in the input ResourceLink.
   *
   * @param link - ResourceLink corresponding to the new resource data.
   */
  protected async verifyExistingExtension(link: ResourceLink): Promise<void> {
    try {
      // Delete the old file with the (now) wrong extension
      const oldLink = await this.resourceMapper.mapUrlToFilePath(link.identifier, false);
      if (oldLink.filePath !== link.filePath) {
        await this.ipfsHelper.unlink(this.ensureLeadingSlash(oldLink.filePath));
      }
    } catch (error: unknown) {
      // Ignore if old file doesn't exist
      if (!isSystemError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Helper function to create a data file in IPFS.
   *
   * @param path - The filepath of the file to be created.
   * @param data - The data to be put in the file.
   */
  protected async writeDataFile(path: string, data: Readable): Promise<void> {
    await this.ipfsHelper.write({ path, content: data });
  }
}
