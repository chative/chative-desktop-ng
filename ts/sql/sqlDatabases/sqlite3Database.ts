import SQL from '@signalapp/better-sqlite3';
import type { Database } from '@signalapp/better-sqlite3';

import { LoggerType } from '../../logger/types';
import { formatError } from '../../logger/utils';
import { consoleLogger } from '../../logger/consoleLogger';

import {
  backup,
  getSchemaVersion,
  getUserVersion,
  isValidDBKey,
  keyDatabase,
  pragmaRun,
  setUserVersion,
  switchToWAL,
} from '../utils/sqlUtils';

import { isString } from 'lodash';

import mkdirp from 'mkdirp';
import rimraf from 'rimraf';

export class Sqlite3Database {
  private db: Database | undefined;
  private dbFilePath: string | undefined;
  protected logger: LoggerType;

  constructor(logger?: LoggerType) {
    this.db = undefined;

    if (logger) {
      this.logger = logger;
    } else {
      this.logger = consoleLogger;
    }
  }

  protected getConnection(): Database {
    if (!this.db) {
      throw new Error('database is not opened.');
    }

    return this.db;
  }

  // close opened connection
  protected closeConnection(optimize: boolean = false): void {
    const db = this.db;
    if (db) {
      if (optimize) {
        // https://www.sqlite.org/lang_analyze.html
        pragmaRun(db, 'analysis_limit=400');
        pragmaRun(db, 'optimize');
      }

      db.close();
    }

    this.db = undefined;
  }

  // migrate schema_version to user_version
  protected migrateSchemaVersion(db: Database): void {
    const userVersion = getUserVersion(db);
    if (userVersion > 0) {
      return;
    }

    const schemaVersion = getSchemaVersion(db);

    const newUserVersion = schemaVersion > 24 ? 24 : schemaVersion;

    this.logger.info(
      'migrateSchemaVersion: Migrating from schema_version ' +
        `${schemaVersion} to user_version ${newUserVersion}`
    );

    setUserVersion(db, newUserVersion);
  }

  // try to open db with default cipher_compatibility = 4
  // and migrate schema version
  private openAndMigrateWithNoCipherChanges(
    filePath: string,
    key: string
  ): Database {
    this.closeConnection();

    const db = new SQL(filePath);
    keyDatabase(db, key);
    switchToWAL(db);
    this.migrateSchemaVersion(db);

    return (this.db = db);
  }

  // try to open db with cipher_compatibility = 3
  // and migrate schema version
  private openAndMigrateWithCompatibility3(
    filePath: string,
    key: string
  ): Database {
    this.closeConnection();

    const db = new SQL(filePath);
    keyDatabase(db, key);

    // https://www.zetetic.net/blog/2018/11/30/sqlcipher-400-release/#compatability-sqlcipher-4-0-0
    pragmaRun(db, 'cipher_compatibility = 3');
    this.migrateSchemaVersion(db);

    return (this.db = db);
  }

  // migrate cipher_compatibility from 3 to 4
  private openWithCipherMigrate(filePath: string, key: string): Database {
    this.closeConnection();

    const db = new SQL(filePath);
    keyDatabase(db, key);

    pragmaRun(db, 'cipher_migrate');
    switchToWAL(db);

    return (this.db = db);
  }

  // open db and migrate schema_version and cipher_compatibility
  private openAndMigrateDatabase(filePath: string, key: string): Database {
    // First, we try to open the database without any cipher changes
    try {
      return this.openAndMigrateWithNoCipherChanges(filePath, key);
    } catch (error) {
      this.logger.error(
        'openAndMigrateDatabase: Migration without cipher change failed',
        formatError(error)
      );
    }

    try {
      // If that fails, we try to open the database with 3.x compatibility to extract the
      //   user_version (previously stored in schema_version, blown away by cipher_migrate).
      this.openAndMigrateWithCompatibility3(filePath, key);

      // After migrating user_version -> schema_version, we reopen database, because we can't
      //   migrate to the latest ciphers after we've modified the defaults.
      return this.openWithCipherMigrate(filePath, key);
    } catch (error) {
      this.logger.error(
        'openAndMigrateDatabase: Cipher compatibilty migration failed',
        formatError(error)
      );
      this.closeConnection();

      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('openAndMigrateDatabase failed');
      }
    }
  }

  // open db with sql cipher and return db instance
  private openWithSQLCipher(filePath: string, key: string): Database {
    if (!isValidDBKey(key)) {
      throw new Error(`setupSQLCipher: key '${key}' is not valid`);
    }

    return this.openAndMigrateDatabase(filePath, key);
  }

  protected getDBDirPath(_configDir: string): string {
    throw new Error('Method not implemented.');
  }

  protected getDBFilePath(_dbDir: string): string {
    throw new Error('Method not implemented.');
  }

  protected updateSchema(_db: Database, _logger: LoggerType) {
    throw new Error('Method not implemented.');
  }

  protected testWithSQL(_db: Database) {
    throw new Error('Method not implemented.');
  }

  public initialize(configDir: string, key: string, logger?: LoggerType): void {
    if (!isString(configDir)) {
      throw new Error('initialize: configDir is required!');
    }

    if (!isString(key)) {
      throw new Error('initialize: key is required!');
    }

    if (logger) {
      this.logger = logger;
    }

    try {
      const dbDirPath = this.getDBDirPath(configDir);
      mkdirp.sync(dbDirPath);

      const dbFilePath = this.getDBFilePath(dbDirPath);

      backup(dbFilePath);

      const db = this.openWithSQLCipher(dbFilePath, key);

      // For profiling use:
      // pragmaRun(db, "cipher_profile='sqlProfile.log'");

      this.updateSchema(db, this.logger);

      // test database
      this.testWithSQL(db);

      this.dbFilePath = dbFilePath;
    } catch (error) {
      this.logger.error('Database startup error:', formatError(error));

      this.closeConnection();
      throw error;
    }
  }

  public close() {
    this.closeConnection();
  }

  public removeDB(): void {
    const dbFilePath = this.dbFilePath;
    if (!dbFilePath) {
      throw new Error('removeDB: database filePath was not set!');
    }

    if (this.db) {
      throw new Error('removeDB: Cannot erase database when it is open!');
    }

    rimraf.sync(dbFilePath);
    rimraf.sync(`${dbFilePath}-shm`);
    rimraf.sync(`${dbFilePath}-wal`);
  }
}
