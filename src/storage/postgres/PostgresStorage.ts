import type { KeyValueStorage } from '../keyvalue/KeyValueStorage';
import { getLoggerFor } from '../../logging/LogUtil';
import { Pool } from 'pg';

/**
 * PostgreSQL-backed KeyValueStorage for storing account data, cookies, and OIDC information.
 * This allows persistent identity storage while keeping pod data in IPFS.
 */
export class PostgresStorage<T = unknown> implements KeyValueStorage<string, T> {
  private readonly logger = getLoggerFor(this);
  private readonly pool: Pool;
  private readonly tableName: string;

  public constructor(tableName: string = 'accounts') {
    this.tableName = tableName;
    
    const config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'solid_identity',
      user: process.env.POSTGRES_USER || 'solid_user',
      password: process.env.POSTGRES_PASSWORD || 'solid_password_change_me',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.pool = new Pool(config);
    this.logger.info(`PostgreSQL storage initialized for table: ${this.tableName}`);
    
    // Test connection
    this.pool.query('SELECT NOW()')
      .then(() => this.logger.info('✅ PostgreSQL connection successful'))
      .catch((error: Error): void => {
        this.logger.error(`❌ PostgreSQL connection failed: ${error.message}`);
      });
  }

  public async get(key: string): Promise<T | undefined> {
    try {
      const keyField = this.tableName === 'account_index' ? 'index_key' : 
                      this.tableName === 'cookies' ? 'cookie_id' :
                      this.tableName === 'oidc_storage' ? 'storage_key' : 'account_id';
      
      const query = `SELECT data FROM ${this.tableName} WHERE ${keyField} = $1`;
      const result = await this.pool.query(query, [key]);
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      return result.rows[0].data as T;
    } catch (error) {
      this.logger.error(`Error getting key ${key} from ${this.tableName}: ${(error as Error).message}`);
      return undefined;
    }
  }

  public async has(key: string): Promise<boolean> {
    try {
      const keyField = this.tableName === 'account_index' ? 'index_key' : 
                      this.tableName === 'cookies' ? 'cookie_id' :
                      this.tableName === 'oidc_storage' ? 'storage_key' : 'account_id';
      
      const query = `SELECT 1 FROM ${this.tableName} WHERE ${keyField} = $1 LIMIT 1`;
      const result = await this.pool.query(query, [key]);
      
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error(`Error checking key ${key} in ${this.tableName}: ${(error as Error).message}`);
      return false;
    }
  }

  public async set(key: string, value: T): Promise<this> {
    try {
      const keyField = this.tableName === 'account_index' ? 'index_key' : 
                      this.tableName === 'cookies' ? 'cookie_id' :
                      this.tableName === 'oidc_storage' ? 'storage_key' : 'account_id';
      
      const data = JSON.stringify(value);
      
      const query = `
        INSERT INTO ${this.tableName} (${keyField}, data, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (${keyField})
        DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP
      `;
      
      await this.pool.query(query, [key, data]);
      
      return this;
    } catch (error) {
      this.logger.error(`Error setting key ${key} in ${this.tableName}: ${(error as Error).message}`);
      throw error;
    }
  }

  public async delete(key: string): Promise<boolean> {
    try {
      const keyField = this.tableName === 'account_index' ? 'index_key' : 
                      this.tableName === 'cookies' ? 'cookie_id' :
                      this.tableName === 'oidc_storage' ? 'storage_key' : 'account_id';
      
      const query = `DELETE FROM ${this.tableName} WHERE ${keyField} = $1`;
      const result = await this.pool.query(query, [key]);
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      this.logger.error(`Error deleting key ${key} from ${this.tableName}: ${(error as Error).message}`);
      return false;
    }
  }

  public async* entries(): AsyncIterableIterator<[string, T]> {
    try {
      const keyField = this.tableName === 'account_index' ? 'index_key' : 
                      this.tableName === 'cookies' ? 'cookie_id' :
                      this.tableName === 'oidc_storage' ? 'storage_key' : 'account_id';
      
      const query = `SELECT ${keyField} as key, data FROM ${this.tableName}`;
      const result = await this.pool.query(query);
      
      for (const row of result.rows) {
        yield [row.key as string, row.data as T];
      }
    } catch (error) {
      this.logger.error(`Error iterating entries in ${this.tableName}: ${(error as Error).message}`);
    }
  }

  /**
   * Close the database connection pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
    this.logger.info(`PostgreSQL connection pool closed for ${this.tableName}`);
  }
}
