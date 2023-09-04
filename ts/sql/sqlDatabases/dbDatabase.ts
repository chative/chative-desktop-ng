// SQL connection and operations

import SQL from '@signalapp/better-sqlite3';
import type { Database } from '@signalapp/better-sqlite3';

import { LocalDatabase } from '../dbInterface';

import {
  backup,
  batchQueryWithMultiVar,
  countTableRows,
  generateUUID,
  getAllCreateSQLs,
  getSchemaVersion,
  getUserVersion,
  jsonToObject,
  keyDatabase,
  mapWithJsonToObject,
  objectToJSON,
  pragmaRun,
  setUserVersion,
  StatementCache,
  switchToWAL,
} from '../utils/sqlUtils';
import { Dictionary, fromPairs, isString } from 'lodash';
import {
  ArrayQuery,
  AttachmentDownloadJobDBType,
  ConversationDBType,
  EmptyQuery,
  FileRiskDBType,
  IdentityKeyDBType,
  ItemDBType,
  LightTaskDBType,
  MessageDBType,
  PreKeyDBType,
  Query,
  ReadPositionDBType,
  SearchResultDBType,
  // RecordWithIdString,
  SessionDBType,
  SignedPreKeyDBType,
  UnprocessedDBType,
  UrlRiskDBType,
  VoteDBType,
  SessionV2DBType,
} from '../sqlTypes';
import { updateSchema } from '../schemaMigrate/database';
import { formatError } from '../../logger/utils';
import rimraf from 'rimraf';

import { LoggerType } from '../../logger/types';
import { getUnprocessedDuplicatedCountInner } from '../schemaMigrate/database/schemaUpdater_21-25';
import { consoleLogger } from '../../logger/consoleLogger';
import {
  TableIdentityKeys,
  TableItems,
  TablePreKeys,
  TableSessions,
  TableSignedPreKeys,
} from '../sqlTables/sqlCommonTable';
import { join } from 'path';
import mkdirp from 'mkdirp';
import { TableAttachmentDownloads } from '../sqlTables/sqlTableAttachmentDownloads';

const INVALID_KEY = /[^0-9A-Fa-f]/;

export class SqliteDatabase implements LocalDatabase {
  private db: Database | undefined;
  private dbFilePath: string | undefined;
  private indexedDBPath: string | undefined;
  private logger: LoggerType | undefined;
  private tablePreKeys: TablePreKeys;
  private tableIdentityKeys: TableIdentityKeys;
  private tableSignedPreKeys: TableSignedPreKeys;
  private tableItems: TableItems;
  private tableSessions: TableSessions;
  private tableAttachmentDownloads: TableAttachmentDownloads;

  constructor(logger?: LoggerType) {
    this.db = undefined;

    this.tablePreKeys = new TablePreKeys();
    this.tableIdentityKeys = new TableIdentityKeys();
    this.tableSignedPreKeys = new TableSignedPreKeys();
    this.tableItems = new TableItems();
    this.tableSessions = new TableSessions();
    this.tableAttachmentDownloads = new TableAttachmentDownloads();

    if (logger) {
      this.logger = logger;
    }
  }

  private getLogger() {
    return this.logger || consoleLogger;
  }

  private getConnection(): Database {
    if (!this.db) {
      throw new Error('database is not opened.');
    }

    return this.db;
  }

  private closeConnection(optimize: boolean = false): void {
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

  private migrateSchemaVersion(db: Database): void {
    const userVersion = getUserVersion(db);
    if (userVersion > 0) {
      return;
    }

    const schemaVersion = getSchemaVersion(db);

    const newUserVersion = schemaVersion > 24 ? 24 : schemaVersion;

    const logger = this.getLogger();
    logger.info(
      'migrateSchemaVersion: Migrating from schema_version ' +
        `${schemaVersion} to user_version ${newUserVersion}`
    );

    setUserVersion(db, newUserVersion);
  }

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

  private openWithCipherMigrate(filePath: string, key: string): Database {
    this.closeConnection();

    const db = new SQL(filePath);
    keyDatabase(db, key);

    pragmaRun(db, 'cipher_migrate');
    switchToWAL(db);

    return (this.db = db);
  }

  private openAndMigrateDatabase(filePath: string, key: string): Database {
    // First, we try to open the database without any cipher changes
    try {
      return this.openAndMigrateWithNoCipherChanges(filePath, key);
    } catch (error) {
      console.log(
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
      console.log(
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

  private openWithSQLCipher(filePath: string, key: string): Database {
    const match = INVALID_KEY.exec(key);
    if (match) {
      throw new Error(`setupSQLCipher: key '${key}' is not valid`);
    }

    return this.openAndMigrateDatabase(filePath, key);
  }

  private getDefaultDBDirPath(configDir: string): string {
    return join(configDir, 'sql');
  }

  private getDefaultDBFilePath(dbDir: string): string {
    return join(dbDir, 'db.sqlite');
  }

  private getIndexedDBPath(configDir: string): string {
    return join(configDir, 'IndexedDB');
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
      const dbDirPath = this.getDefaultDBDirPath(configDir);
      mkdirp.sync(dbDirPath);

      const dbFilePath = this.getDefaultDBFilePath(dbDirPath);

      backup(dbFilePath);

      const db = this.openWithSQLCipher(dbFilePath, key);

      // For profiling use:
      // pragmaRun(db, "cipher_profile='sqlProfile.log'");

      updateSchema(db, this.getLogger());

      // test database
      this.getAllMessageCount();

      this.dbFilePath = dbFilePath;
      this.indexedDBPath = this.getIndexedDBPath(configDir);
    } catch (error) {
      this.getLogger().error('Database startup error:', formatError(error));

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
      throw new Error('removeDB: database filePath was not set.');
    }

    if (this.db) {
      throw new Error('removeDB: Cannot erase database when it is open!');
    }

    rimraf.sync(dbFilePath);
    rimraf.sync(`${dbFilePath}-shm`);
    rimraf.sync(`${dbFilePath}-wal`);
  }

  public removeIndexedDBFiles(): void {
    const indexedDBPath = this.indexedDBPath;
    if (!indexedDBPath) {
      throw new Error('removeIndexedDBFiles: indexedDBPath was not set!');
    }

    const pattern = join(indexedDBPath, '*.leveldb');
    rimraf.sync(pattern);
    this.indexedDBPath = undefined;
  }

  // 'identityKeys'
  public createOrUpdateIdentityKey(data: IdentityKeyDBType): void {
    const db = this.getConnection();
    return this.tableIdentityKeys.createOrUpdateIdentityKey(db, data);
  }

  public getIdentityKeyById(id: string): IdentityKeyDBType | undefined {
    const db = this.getConnection();
    return this.tableIdentityKeys.getIdentityKeyById(db, id);
  }

  public bulkAddIdentityKeys(array: IdentityKeyDBType[]): void {
    const db = this.getConnection();
    return this.tableIdentityKeys.bulkAddIdentityKeys(db, array);
  }

  public removeIdentityKeyById(id: string): void {
    const db = this.getConnection();
    return this.tableIdentityKeys.removeIdentityKeyById(db, id);
  }

  public removeAllIdentityKeys(): void {
    const db = this.getConnection();
    return this.tableIdentityKeys.removeAllIdentityKeys(db);
  }

  public getAllIdentityKeys(): IdentityKeyDBType[] {
    const db = this.getConnection();
    return this.tableIdentityKeys.getAllIdentityKeys(db);
  }

  // 'preKeys'
  public createOrUpdatePreKey(data: PreKeyDBType): void {
    const db = this.getConnection();
    return this.tablePreKeys.createOrUpdatePreKey(db, data);
  }

  public getPreKeyById(id: string): PreKeyDBType | undefined {
    const db = this.getConnection();
    return this.tablePreKeys.getPreKeyById(db, id);
  }

  public bulkAddPreKeys(array: PreKeyDBType[]): void {
    const db = this.getConnection();
    return this.tablePreKeys.bulkAddPreKeys(db, array);
  }

  public removePreKeyById(id: string): void {
    const db = this.getConnection();
    return this.tablePreKeys.removePreKeyById(db, id);
  }

  public removeAllPreKeys(): void {
    const db = this.getConnection();
    return this.tablePreKeys.removeAllPreKeys(db);
  }

  public getAllPreKeys(): PreKeyDBType[] {
    const db = this.getConnection();
    return this.tablePreKeys.getAllPreKeys(db);
  }

  // 'signedPreKeys'
  public createOrUpdateSignedPreKey(data: SignedPreKeyDBType): void {
    const db = this.getConnection();
    return this.tableSignedPreKeys.createOrUpdateSignedPreKey(db, data);
  }

  public getSignedPreKeyById(id: string): SignedPreKeyDBType | undefined {
    const db = this.getConnection();
    return this.tableSignedPreKeys.getSignedPreKeyById(db, id);
  }

  public getAllSignedPreKeys(): SignedPreKeyDBType[] {
    const db = this.getConnection();
    return this.tableSignedPreKeys.getAllSignedPreKeys(db);
  }

  public bulkAddSignedPreKeys(array: SignedPreKeyDBType[]): void {
    const db = this.getConnection();
    return this.tableSignedPreKeys.bulkAddSignedPreKeys(db, array);
  }

  public removeSignedPreKeyById(id: string): void {
    const db = this.getConnection();
    return this.tableSignedPreKeys.removeSignedPreKeyById(db, id);
  }

  public removeAllSignedPreKeys(): void {
    const db = this.getConnection();
    return this.tableSignedPreKeys.removeAllSignedPreKeys(db);
  }

  // 'items'
  public createOrUpdateItem(data: ItemDBType): void {
    const db = this.getConnection();
    return this.tableItems.createOrUpdateItem(db, data);
  }

  public getItemById(id: string): ItemDBType | undefined {
    const db = this.getConnection();
    return this.tableItems.getItemById(db, id);
  }

  public getAllItems(): ItemDBType[] {
    const db = this.getConnection();
    return this.tableItems.getAllItems(db);
  }

  public bulkAddItems(array: ItemDBType[]): void {
    const db = this.getConnection();
    return this.tableItems.bulkAddItems(db, array);
  }

  public removeItemById(id: string): void {
    const db = this.getConnection();
    return this.tableItems.removeItemById(db, id);
  }

  public removeAllItems(): void {
    const db = this.getConnection();
    return this.tableItems.removeAllItems(db);
  }

  // 'sessions'
  public createOrUpdateSession(data: SessionDBType): void {
    const db = this.getConnection();
    return this.tableSessions.createOrUpdateSession(db, data);
  }

  public getSessionById(id: string): SessionDBType | undefined {
    const db = this.getConnection();
    return this.tableSessions.getSessionById(db, id);
  }

  public getSessionsByNumber(number: string): SessionDBType[] {
    const db = this.getConnection();
    return this.tableSessions.getSessionsByNumber(db, number);
  }

  public bulkAddSessions(array: SessionDBType[]): void {
    const db = this.getConnection();
    return this.tableSessions.bulkAddSessions(db, array);
  }

  public removeSessionById(id: string): void {
    const db = this.getConnection();
    return this.tableSessions.removeSessionById(db, id);
  }

  public removeSessionsByNumber(number: string): void {
    const db = this.getConnection();
    return this.tableSessions.removeSessionsByNumber(db, number);
  }

  public removeAllSessions(): void {
    const db = this.getConnection();
    return this.tableSessions.removeAllSessions(db);
  }

  public getAllSessions(): SessionDBType[] {
    const db = this.getConnection();
    return this.tableSessions.getAllSessions(db);
  }

  // 'attachment_downloads'
  public getNextAttachmentDownloadJobs(
    limit: number,
    options: { timestamp?: number }
  ): AttachmentDownloadJobDBType[] {
    const db = this.getConnection();
    return this.tableAttachmentDownloads.getNextAttachmentDownloadJobs(
      db,
      limit,
      options
    );
  }

  public saveAttachmentDownloadJob(job: AttachmentDownloadJobDBType): void {
    const db = this.getConnection();
    return this.tableAttachmentDownloads.saveAttachmentDownloadJob(db, job);
  }

  public setAttachmentDownloadJobPending(id: string, pending: number): void {
    const db = this.getConnection();
    return this.tableAttachmentDownloads.setAttachmentDownloadJobPending(
      db,
      id,
      pending
    );
  }

  public resetAttachmentDownloadPending(): void {
    const db = this.getConnection();
    return this.tableAttachmentDownloads.resetAttachmentDownloadPending(db);
  }

  public removeAttachmentDownloadJob(id: string[] | string): void {
    const db = this.getConnection();
    return this.tableAttachmentDownloads.removeAttachmentDownloadJob(db, id);
  }

  public removeAllAttachmentDownloadJobs(): void {
    const db = this.getConnection();
    return this.tableAttachmentDownloads.removeAllAttachmentDownloadJobs(db);
  }

  // "conversations"
  public getConversationCount(): number {
    const db = this.getConnection();
    return countTableRows(db, 'conversations');
  }

  public getStickConversationCount(): number {
    const db = this.getConnection();

    // use index conversation_isSticker
    return StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT
        COUNT(*)
      FROM
        conversations
      WHERE
        json_extract(json, '$.isStick') = true;
      `
    )
      .pluck()
      .get();
  }

  public saveConversation(data: ConversationDBType): void {
    const {
      id,
      active_at = null,
      type,
      members,
      name = null,
      profileName = null,
    } = data;

    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      `
      INSERT INTO conversations (
        id,
        json,

        active_at,
        type,
        members,
        name,
        profileName
      ) values (
        $id,
        $json,

        $active_at,
        $type,
        $members,
        $name,
        $profileName
      );
      `
    ).run({
      id,
      json: objectToJSON(data),

      active_at,
      type,
      members: members ? members.join(' ') : null,
      name,
      profileName,
    });
  }

  public saveConversations(arrayOfConversations: ConversationDBType[]): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const conversation of arrayOfConversations) {
        this.saveConversation(conversation);
      }
    })();
  }

  public updateConversation(data: ConversationDBType): void {
    // eslint-disable-next-line camelcase
    const {
      id,
      active_at = null,
      type,
      members,
      name = null,
      profileName = null,
    } = data;

    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      `
      UPDATE
        conversations
      SET
        json = $json,
        active_at = $active_at,
        type = $type,
        members = $members,
        name = $name,
        profileName = $profileName
      WHERE
        id = $id;
      `
    ).run({
      id,
      json: objectToJSON(data),

      active_at,
      type,
      members: members ? members.join(' ') : null,
      name,
      profileName,
    });
  }

  public updateConversations(arrayOfConversations: ConversationDBType[]): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const conversation of arrayOfConversations) {
        this.updateConversation(conversation);
      }
    })();
  }

  private removeConversations(ids: string[]): void {
    if (!ids?.length) {
      throw new Error('removeConversation: No id(s) to delete!');
    }

    const db = this.getConnection();
    // Our node interface doesn't seem to allow you to replace one single ? with an array
    db.prepare<ArrayQuery>(
      `
      DELETE FROM conversations
      WHERE id IN ( ${ids.map(() => '?').join(', ')} );
      `
    ).run(ids);
  }

  public removeConversation(id: string[] | string): void {
    const db = this.getConnection();
    batchQueryWithMultiVar(
      db,
      Array.isArray(id) ? id : [id],
      this.removeConversations.bind(this)
    );
  }

  public getConversationById(id: string): ConversationDBType | undefined {
    const db = this.getConnection();

    const json = StatementCache.prepare<Query>(
      db,
      'SELECT json FROM conversations WHERE id = $id;'
    )
      .pluck()
      .get({ id });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  public getAllConversations(): ConversationDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      'SELECT json FROM conversations ORDER BY id ASC;'
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public getAllConversationIds(): string[] {
    const db = this.getConnection();
    return StatementCache.prepare<EmptyQuery>(
      db,
      'SELECT id FROM conversations ORDER BY id ASC;'
    )
      .pluck()
      .all();
  }

  public getAllPrivateConversations(): ConversationDBType[] {
    // USING INDEX conversations_type (type=?)
    // no need order by
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `SELECT json FROM conversations WHERE type = 'private';`
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public getAllGroupsInvolvingId(id: string): ConversationDBType[] {
    // USING INDEX conversations_type (type=?)
    // no need order by id.
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        json
      FROM
        conversations
      WHERE
        type = 'group'
        AND (members LIKE $idInner OR members LIKE $idEnd);
      `
    )
      .pluck()
      .all({
        idInner: `%${id} %`,
        idEnd: `%${id}`,
      });

    return mapWithJsonToObject(jsons);
  }

  public searchConversations(
    query: string,
    { limit }: { limit?: number } = {}
  ): ConversationDBType[] {
    // using index conversations_names
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM conversations
      WHERE
        (
          id LIKE $id escape $escape OR
          name LIKE $name escape $escape OR
          profileName LIKE $profileName escape $escape OR
          (json_extract(json, '$.email') LIKE $email escape $escape) OR
          (json_extract(json, '$.signature') LIKE $signature escape $escape) OR
          (
            (name IS NULL OR name = '') AND
            (json_extract(json, '$.groupDisplayName') LIKE $name escape $escape)
          ) OR members LIKE $members escape $escape
        )
        AND
        (
          active_at IS NOT NULL OR
          json_extract(json, '$.directoryUser') IS TRUE OR
          (
            type = 'group' AND
            json_extract(json, '$.left') IS NOT TRUE AND
            json_extract(json, '$.disbanded') IS NOT TRUE
          )
        )
      ORDER BY active_at DESC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        id: `%${query}%`,
        name: `%${query}%`,
        profileName: `%${query}%`,
        email: `%${query}%`,
        signature: `%${query}%`,
        members: `%${query}%`,
        limit: limit || 500,
        escape: '\\',
      });

    return mapWithJsonToObject(jsons);
  }

  // 'messages'
  public getAllMessageCount(conversationId?: string): number {
    const db = this.getConnection();

    if (conversationId === undefined) {
      return countTableRows(db, 'messages');
    } else {
      return StatementCache.prepare<Query>(
        db,
        `
        SELECT COUNT(*)
        FROM messages
        WHERE conversationId = $conversationId;
        `
      )
        .pluck()
        .get({ conversationId });
    }
  }

  public getMessageCountWithoutPin(conversationId?: string): number {
    const db = this.getConnection();
    if (conversationId === undefined) {
      // USING COVERING INDEX messages_pin (pin=?)
      return StatementCache.prepare<EmptyQuery>(
        db,
        'SELECT COUNT(*) FROM messages WHERE pin IS NULL;'
      )
        .pluck()
        .get();
    } else {
      //
      return StatementCache.prepare<Query>(
        db,
        `
        SELECT COUNT(*)
        FROM messages
        WHERE conversationId = $conversationId
          AND pin IS NULL;
        `
      )
        .pluck()
        .get({ conversationId });
    }
  }

  public searchMessages(
    query: string,
    { limit }: { limit?: number } = {}
  ): SearchResultDBType[] {
    const db = this.getConnection();
    const rows: Array<{ json: string; snippet: string }> =
      StatementCache.prepare<Query>(
        db,
        `
        SELECT
          messages.json,
          snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 50) as snippet
        FROM messages_fts
        INNER JOIN messages on messages_fts.id = messages.id
        WHERE
          messages_fts match $query AND
          messages.pin is NULL AND
          json_extract(messages.json, '$.hasBeenRecalled') IS NOT TRUE
        ORDER BY messages.serverTimestamp DESC
        LIMIT $limit;
        `
      ).all({
        query,
        limit: limit || 100,
      });

    return rows.map(row => ({
      ...jsonToObject<MessageDBType>(row.json),
      snippet: row.snippet,
    }));
  }

  public searchMessagesInConversation(
    query: string,
    conversationId: string,
    { limit }: { limit?: number } = {}
  ): SearchResultDBType[] {
    const db = this.getConnection();
    const rows: Array<{ json: string; snippet: string }> =
      StatementCache.prepare<Query>(
        db,
        `
        SELECT
          messages.json,
          snippet(messages_fts, -1, '<<left>>', '<<right>>', '...', 15) as snippet
        FROM messages_fts
        INNER JOIN messages on messages_fts.id = messages.id
        WHERE
          messages_fts match $query AND
          messages.pin is NULL AND
          messages.conversationId = $conversationId AND
          json_extract(messages.json, '$.hasBeenRecalled') IS NOT TRUE
        ORDER BY messages.serverTimestamp DESC
        LIMIT $limit;
        `
      ).all({
        query,
        conversationId,
        limit: limit || 100,
      });

    return rows.map(row => ({
      ...jsonToObject<MessageDBType>(row.json),
      snippet: row.snippet,
    }));
  }

  public saveMessage(
    data: MessageDBType,
    { forceSave }: { forceSave?: boolean } = {}
  ): string {
    const {
      body = null,
      conversationId,
      expires_at = null,
      hasAttachments,
      hasFileAttachments,
      hasVisualMediaAttachments,
      id = null,
      received_at,
      schemaVersion,
      sent_at,
      source = null,
      sourceDevice = null,
      type,
      unread,
      atPersons,
      expireTimer = null,
      expirationStartTimestamp = null,
      pin = null,
    } = data;

    const serverTimestamp = data.serverTimestamp || sent_at;

    // update serverTimestamp
    Object.assign(data, { serverTimestamp });

    const payload = {
      body,
      conversationId,
      expires_at,
      hasAttachments: hasAttachments ? 1 : 0,
      hasFileAttachments: hasFileAttachments ? 1 : 0,
      hasVisualMediaAttachments: hasVisualMediaAttachments ? 1 : 0,
      id,
      received_at,
      schemaVersion,
      sent_at,
      source,
      sourceDevice,
      type,
      unread,
      atPersons,
      expireTimer,
      expirationStartTimestamp,
      pin,
      serverTimestamp,
    };

    const db = this.getConnection();
    if (id && !forceSave) {
      StatementCache.prepare<Query>(
        db,
        `
        UPDATE messages SET
          json = $json,
          body = $body,
          conversationId = $conversationId,
          expirationStartTimestamp = $expirationStartTimestamp,
          expires_at = $expires_at,
          expireTimer = $expireTimer,
          hasAttachments = $hasAttachments,
          hasFileAttachments = $hasFileAttachments,
          hasVisualMediaAttachments = $hasVisualMediaAttachments,
          id = $id,
          received_at = $received_at,
          schemaVersion = $schemaVersion,
          sent_at = $sent_at,
          source = $source,
          sourceDevice = $sourceDevice,
          type = $type,
          unread = $unread,
          atPersons = $atPersons,
          pin = $pin,
          serverTimestamp = $serverTimestamp
        WHERE id = $id;
        `
      ).run({
        ...payload,
        json: objectToJSON(data),
      });

      return id;
    }

    const toCreate = {
      ...data,
      id: id || generateUUID(),
    };

    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR IGNORE INTO messages (
        id,
        json,

        body,
        conversationId,
        expirationStartTimestamp,
        expires_at,
        expireTimer,
        hasAttachments,
        hasFileAttachments,
        hasVisualMediaAttachments,
        received_at,
        schemaVersion,
        sent_at,
        source,
        sourceDevice,
        type,
        unread,
        atPersons,
        pin,
        serverTimestamp
      ) VALUES (
        $id,
        $json,

        $body,
        $conversationId,
        $expirationStartTimestamp,
        $expires_at,
        $expireTimer,
        $hasAttachments,
        $hasFileAttachments,
        $hasVisualMediaAttachments,
        $received_at,
        $schemaVersion,
        $sent_at,
        $source,
        $sourceDevice,
        $type,
        $unread,
        $atPersons,
        $pin,
        $serverTimestamp
      );
      `
    ).run({
      ...payload,
      id: toCreate.id,
      json: objectToJSON(toCreate),
    });

    return toCreate.id;
  }

  public saveMessages(
    arrayOfMessages: MessageDBType[],
    { forceSave }: { forceSave?: boolean } = {}
  ): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const message of arrayOfMessages) {
        this.saveMessage(message, { forceSave });
      }
    })();
  }

  private removeMessages(ids: string[]): void {
    if (!ids.length) {
      throw new Error('removeMessages: No id(s) to delete!');
    }

    const db = this.getConnection();
    db.transaction(() => {
      db.prepare<ArrayQuery>(
        `
        DELETE FROM votes
        WHERE voteId IN
        (
          SELECT json_extract(json, '$.vote.voteId')
          FROM messages WHERE id IN ( ${ids.map(() => '?').join(', ')} )
        );
        `
      ).run(ids);

      db.prepare<ArrayQuery>(
        `
        DELETE FROM vote_messages
        WHERE messageId IN ( ${ids.map(() => '?').join(', ')} );
        `
      ).run(ids);

      db.prepare<ArrayQuery>(
        `
        DELETE FROM messages
        WHERE id IN ( ${ids.map(() => '?').join(', ')} );
        `
      ).run(ids);
    })();
  }

  public removeMessage(id: string[] | string): void {
    const db = this.getConnection();
    batchQueryWithMultiVar(
      db,
      Array.isArray(id) ? id : [id],
      this.removeMessages.bind(this)
    );
  }

  public getMessageById(id: string): MessageDBType | undefined {
    const db = this.getConnection();
    const json = StatementCache.prepare<Query>(
      db,
      'SELECT json FROM messages WHERE id = $id;'
    )
      .pluck()
      .get({ id });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  public getAllMessages(): MessageDBType[] {
    // USING INDEX messages_pin (pin=?)
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `SELECT json FROM messages WHERE pin is NULL;`
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public getAllMessageIds(): string[] {
    // USING INDEX messages_pin (pin=?)
    const db = this.getConnection();
    return StatementCache.prepare<EmptyQuery>(
      db,
      `SELECT id FROM messages WHERE pin is NULL;`
    )
      .pluck()
      .all();
  }

  public getMessageBySender({
    source,
    sourceDevice,
    sent_at,
    fromOurDevice,
  }: {
    source: string;
    sourceDevice: number;
    sent_at: number;
    fromOurDevice?: boolean;
  }): MessageDBType[] {
    // USING INDEX messages_duplicate_check
    let jsons: any[] = [];

    const db = this.getConnection();

    db.transaction(() => {
      jsons = StatementCache.prepare<Query>(
        db,
        `
        SELECT json FROM messages
        WHERE
          source = $source AND
          sourceDevice = $sourceDevice AND
          sent_at = $sent_at AND
          pin is NULL;
        `
      )
        .pluck()
        .all({ source, sourceDevice, sent_at });

      if (fromOurDevice && !jsons?.length) {
        jsons = StatementCache.prepare<Query>(
          db,
          `
          SELECT json FROM messages
          WHERE
            source IS NULL AND
            sourceDevice IS NULL AND
            sent_at = $sent_at AND
            pin is NULL;
          `
        )
          .pluck()
          .all({ sent_at });
      }
    })();

    return mapWithJsonToObject(jsons);
  }

  // upward = true, load messages older than serverTimestamp,
  // these messages showed over current messages of serverTimestamp
  // upward = false, load messages newer than serverTimestamp
  // these messages showed blow current messages of serverTimestamp
  // default: load neweset 50 messages
  public getMessagesByConversation(
    conversationId: string,
    {
      limit = 50,
      serverTimestamp = Number.MAX_VALUE,
      upward = true,
      equal = false,
      threadId,
      onlyUnread = false,
    }: {
      limit?: number;
      serverTimestamp?: number;
      upward?: boolean;
      equal?: boolean;
      threadId?: string;
      onlyUnread?: boolean;
    } = {}
  ): MessageDBType[] {
    const db = this.getConnection();

    let upwardOperator = upward ? '<' : '>';
    if (equal) {
      upwardOperator = upward ? '<=' : '>=';
    }
    const orderBy = upward ? 'DESC' : 'ASC';

    const queryParams = {
      conversationId,
      serverTimestamp,
      limit,
    };

    if (threadId) {
      Object.assign(queryParams, { threadId });
    }

    // USING INDEX messages_conversation_visible
    // USING INDEX messages_conversation_visible_unread
    // USING INDEX messages_conversation_thread_visible
    // USING INDEX messages_conversation_thread_visible_unread
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json
      FROM messages
      WHERE conversationId = $conversationId
        AND pin is NULL
        AND ${threadId ? `json_extract(json, '$.threadId') = $threadId` : '1=1'}
        AND ${onlyUnread ? 'unread = 1' : '1=1'}
        AND serverTimestamp ${upwardOperator} $serverTimestamp
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.flags') IS NOT 2
        AND
          (
            type IS NULL OR
            type NOT IN ('keychange', 'verified-change')
          )
        ORDER BY serverTimestamp ${orderBy}
        LIMIT $limit;
      `
    )
      .pluck()
      .all(queryParams);

    return mapWithJsonToObject(jsons);
  }

  public getMessagesBySentAt(sentAt: number): MessageDBType[] {
    // USING INDEX messages_receipt (sent_at=?)
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_receipt
      WHERE sent_at = $sent_at
        AND pin is NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
      ORDER BY serverTimestamp DESC;
      `
    )
      .pluck()
      .all({ sent_at: sentAt });

    return mapWithJsonToObject(jsons);
  }

  public getExpiredMessagesCount(expiresAt?: number): number {
    const db = this.getConnection();
    return StatementCache.prepare<Query>(
      db,
      `
      SELECT COUNT(*)
      FROM messages
      INDEXED BY messages_expires_at
      WHERE
        pin is NULL AND
        expires_at <= $expires_at;
      `
    )
      .pluck()
      .get({ expires_at: expiresAt || Date.now() });
  }

  public getExpiredMessages(): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json
      FROM messages
      INDEXED BY messages_expires_at
      WHERE
        pin is NULL AND
        expires_at <= $expires_at
      ORDER BY expires_at ASC
      LIMIT 1000;
      `
    )
      .pluck()
      .all({ expires_at: Date.now() });

    return mapWithJsonToObject(jsons);
  }

  public getOutgoingWithoutExpiresAt(): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_without_timer
      WHERE
        pin is NULL AND
        expireTimer > 0 AND
        expires_at IS NULL AND
        type IS 'outgoing';
      `
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public getNextExpiringMessage(): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_expires_at
      WHERE expires_at > 0
        AND pin is NULL
      ORDER BY expires_at ASC
      LIMIT 1;
      `
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  // unprocessed
  public saveUnprocessed(
    data: UnprocessedDBType,
    { forceSave }: { forceSave?: boolean } = {}
  ): string {
    const { id } = data;
    if (!id) {
      throw new Error('saveUnprocessed: id was falsey');
    }

    const { timestamp, version, attempts, envelope } = data;

    const db = this.getConnection();
    if (forceSave) {
      StatementCache.prepare<Query>(
        db,
        `
        INSERT INTO unprocessed (
          id,
          timestamp,
          version,
          attempts,
          envelope
        ) values (
          $id,
          $timestamp,
          $version,
          $attempts,
          $envelope
        );
        `
      ).run({
        id,
        timestamp,
        version,
        attempts,
        envelope,
      });
    } else {
      StatementCache.prepare<Query>(
        db,
        `
        UPDATE unprocessed SET
          timestamp = $timestamp,
          version = $version,
          attempts = $attempts,
          envelope = $envelope
        WHERE id = $id;
        `
      ).run({
        id,
        timestamp,
        version,
        attempts,
        envelope,
      });
    }

    return id;
  }

  public saveUnprocesseds(
    arrayOfUnprocessed: UnprocessedDBType[],
    { forceSave }: { forceSave?: boolean } = {}
  ): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const unprocessed of arrayOfUnprocessed) {
        this.saveUnprocessed(unprocessed, { forceSave });
      }
    })();
  }

  public updateUnprocessedWithData(id: string, data: UnprocessedDBType): void {
    const db = this.getConnection();

    const {
      source = null,
      sourceDevice = null,
      serverTimestamp = null,
      decrypted = null,
      external = null,
      attempts,
      requiredProtocolVersion = null,
    } = data;

    StatementCache.prepare<Query>(
      db,
      `
      UPDATE unprocessed SET
        source = $source,
        sourceDevice = $sourceDevice,
        serverTimestamp = $serverTimestamp,
        decrypted = $decrypted,
        external = $external,
        attempts = $attempts,
        requiredProtocolVersion = $requiredProtocolVersion
      WHERE id = $id;
      `
    ).run({
      id,
      source,
      sourceDevice,
      serverTimestamp,
      decrypted,
      external: objectToJSON(external),
      attempts,
      requiredProtocolVersion,
    });
  }

  public updateUnprocessedsWithData(
    arrayOfUnprocessed: { id: string; data: UnprocessedDBType }[]
  ): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const unprocessed of arrayOfUnprocessed) {
        const { id, data } = unprocessed;
        this.updateUnprocessedWithData(id, data);
      }
    })();
  }

  public getUnprocessedById(id: string): UnprocessedDBType | undefined {
    const db = this.getConnection();

    const row = StatementCache.prepare<Query>(
      db,
      'SELECT * FROM unprocessed WHERE id = $id;'
    ).get({ id });

    if (!row) {
      return undefined;
    }

    if (row.external) {
      row.external = jsonToObject(row.external);
    }

    return row;
  }

  public getUnprocessedCount(): number {
    return countTableRows(this.getConnection(), 'unprocessed');
  }

  public getUnprocessedDuplicatedCount(): number {
    return getUnprocessedDuplicatedCountInner(this.getConnection());
  }

  public getAllUnprocessed(): UnprocessedDBType[] {
    const db = this.getConnection();
    const rows = StatementCache.prepare<EmptyQuery>(
      db,
      'SELECT * FROM unprocessed ORDER BY timestamp ASC;'
    ).all();

    return rows.map<UnprocessedDBType>(row => {
      if (row.external) {
        row.external = jsonToObject(row.external);
      }

      return row;
    });
  }

  private removeUnprocesseds(ids: string[]): void {
    if (!ids.length) {
      throw new Error('removeConversation: No id(s) to delete!');
    }

    const db = this.getConnection();
    // Our node interface doesn't seem to allow you to replace one single ? with an array
    db.prepare<ArrayQuery>(
      `
      DELETE FROM unprocessed
      WHERE id IN ( ${ids.map(() => '?').join(', ')} );
      `
    ).run(ids);
  }

  public removeUnprocessed(id: string[] | string): void {
    const db = this.getConnection();
    batchQueryWithMultiVar(
      db,
      Array.isArray(id) ? id : [id],
      this.removeUnprocesseds.bind(this)
    );
  }

  public removeAllUnprocessed(): void {
    this.getConnection().exec('DELETE FROM unprocessed;');
  }

  public deduplicateUnprocessed(): void {
    const db = this.getConnection();
    StatementCache.prepare<EmptyQuery>(
      db,
      `
      DELETE FROM unprocessed
      WHERE unprocessed.ROWID NOT IN (
        SELECT MAX(unprocessed.ROWID) FROM unprocessed
        GROUP BY envelope, source, sourceDevice, external
      );
      `
    );
  }

  // All data in database
  public removeAll(): void {
    const db = this.getConnection();
    const logger = this.getLogger();

    db.transaction(() => {
      db.exec(
        `
        DELETE FROM identityKeys;
        DELETE FROM items;
        DELETE FROM preKeys;
        DELETE FROM sessions;
        DELETE FROM signedPreKeys;
        DELETE FROM unprocessed;

        DELETE FROM attachment_downloads;
        DELETE FROM conversations;

        -- DELETE FROM messages;
        -- DELETE FROM messages_expired;
        DELETE FROM messages_fts;
        DELETE FROM read_positions;

        DELETE FROM tasks;
        DELETE FROM task_messages;
        DELETE FROM task_roles;
        DELETE FROM task_conversations;

        DELETE FROM votes;
        DELETE FROM vote_messages;
        `
      );

      if (countTableRows(db, 'messages') > 0) {
        const createSQLs = getAllCreateSQLs(db, 'messages');
        const {
          table: tableRows,
          index: indexRows,
          trigger: triggerRows,
        } = createSQLs;

        if (!tableRows?.length) {
          logger.info('empty table 1 sql');
        }

        const sqls: string[] = [];

        // drop all indexes
        if (indexRows?.length) {
          for (const row of indexRows) {
            const { name, sql } = row;
            db.prepare<EmptyQuery>(`DROP INDEX IF EXISTS ${name}`).run();
            sqls.push(sql);
          }
        } else {
          logger.info(`there is no table index sql.`);
        }

        // drop all triggers
        if (triggerRows?.length) {
          for (const row of triggerRows) {
            const { name, sql } = row;
            db.prepare<EmptyQuery>(`DROP TRIGGER IF EXISTS ${name};`).run();
            sqls.push(sql);
          }
        } else {
          logger.info(`there is no table trigger sql.`);
        }

        // clear records
        db.exec(`DELETE FROM messages;`);

        //recreate indexes and triggers
        for (const sql of sqls) {
          db.exec(sql);
        }
      }

      // clear records
      db.exec(`DELETE FROM messages_expired;`);
    })();
  }

  // Anything that isn't user-visible data
  public removeAllConfiguration(): void {
    const db = this.getConnection();

    db.exec(
      `
      DELETE FROM identityKeys;
      DELETE FROM items;
      DELETE FROM preKeys;
      DELETE FROM sessions;
      DELETE FROM signedPreKeys;
      DELETE FROM unprocessed;
      `
    );
  }

  public getMessagesNeedingUpgrade(
    limit: number,
    { maxVersion }: { maxVersion: number }
  ): MessageDBType[] {
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_schemaVersion
      WHERE
        schemaVersion IS NULL
        OR schemaVersion < $maxVersion
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        maxVersion,
        limit,
      });

    return mapWithJsonToObject(jsons);
  }

  public getMessagesWithVisualMediaAttachments(
    conversationId: string,
    { limit, isPin }: { limit: number; isPin: boolean }
  ): MessageDBType[] {
    // USING INDEX messages_hasVisualMediaAttachments
    // OR USING INDEX messages_hasVisualMediaAttachments_pin
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      WHERE conversationId = $conversationId
        AND hasVisualMediaAttachments = 1
        AND pin IS ${isPin ? `NOT NULL` : 'NULL'}
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
      ORDER BY serverTimestamp DESC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({ conversationId, limit });

    return mapWithJsonToObject(jsons);
  }

  public getMessagesWithFileAttachments(
    conversationId: string,
    { limit }: { limit: number }
  ): MessageDBType[] {
    // USING INDEX messages_hasFileAttachments
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_hasFileAttachments
      WHERE pin IS NULL
        AND conversationId = $conversationId
        AND hasFileAttachments = 1
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
      ORDER BY serverTimestamp DESC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({ conversationId, limit });

    return mapWithJsonToObject(jsons);
  }

  public removeKnownAttachments(allAttachments: string[]): string[] {
    const logger = this.getLogger();

    // const db = this.getConnection();
    const lookup: Dictionary<boolean> = fromPairs(
      allAttachments.map((file: any) => [file, true])
    );
    // const chunkSize = 50;

    const total = this.getAllMessageCount();
    logger.info(
      `removeKnownAttachments: About to iterate through ${total} messages`
    );

    // let count = 0;

    // for (const message of new TableIterator<any>(db, 'messages')) {
    //   const externalFiles = getExternalFilesForMessage(message);
    //   forEach(externalFiles, (file: string) => {
    //     delete lookup[file];
    //   });
    //   count += 1;
    // }

    // logger.info(`removeKnownAttachments: Done processing ${count} messages`);

    // let complete = false;
    // count = 0;
    // let id = '';

    const conversationTotal = this.getConversationCount();
    logger.info(
      `removeKnownAttachments: About to iterate through ${conversationTotal} conversations`
    );

    // const fetchConversations =  StatementCache.prepare<Query>(db,
    //   `
    //     SELECT json FROM conversations
    //     WHERE id > $id
    //     ORDER BY id ASC
    //     LIMIT $chunkSize;
    //   `
    // );

    // while (!complete) {
    //   const rows = fetchConversations.all({
    //     id,
    //     chunkSize,
    //   });

    //   const conversations: any[] = map(rows, (row: { json: string }) =>
    //     jsonToObject(row.json)
    //   );
    //   conversations.forEach(conversation => {
    //     const externalFiles = getExternalFilesForConversation(conversation);
    //     externalFiles.forEach(file => {
    //       delete lookup[file];
    //     });
    //   });

    //   const lastMessage: any = last(conversations);
    //   if (lastMessage) {
    //     ({ id } = lastMessage);
    //   }
    //   complete = conversations.length < chunkSize;
    //   count += conversations.length;
    // }

    // logger.info(
    //   `removeKnownAttachments: Done processing ${count} conversations`
    // );

    return Object.keys(lookup);
  }

  // light task
  public createOrUpdateLightTask(data: LightTaskDBType): void {
    const {
      taskId,
      version,
      uid = null,
      gid = null,
      creator = null,
      timestamp = null,
      name = null,
      notes = null,
      dueTime = null,
      priority = null,
      status = null,
      updater = null, // 终态执行人
      updateTime = null, // 终态执行时间
      roles,
    } = data;

    const db = this.getConnection();
    db.transaction(() => {
      StatementCache.prepare<Query>(
        db,
        `
        INSERT INTO tasks (
          taskId,
          uid,
          gid,
          version,
          creator,
          timestamp,
          name,
          notes,
          dueTime,
          priority,
          status,
          updater,
          updateTime
        ) values (
          $taskId,
          $uid,
          $gid,
          $version,
          $creator,
          $timestamp,
          $name,
          $notes,
          $dueTime,
          $priority,
          $status,
          $updater,
          $updateTime
        ) ON CONFLICT(taskId) DO UPDATE SET
          uid = $uid,
          gid = $gid,
          version = $version,
          creator = $creator,
          timestamp = $timestamp,
          name = $name,
          notes = $notes,
          dueTime = $dueTime,
          priority = $priority,
          status = $status,
          updater = $updater,
          updateTime = $updateTime
        ;
        `
      ).run({
        taskId,
        uid,
        gid,
        version,
        creator,
        timestamp,
        name,
        notes,
        dueTime,
        priority,
        status,
        updater,
        updateTime,
      });

      if (Array.isArray(roles) && roles.length) {
        StatementCache.prepare<Query>(
          db,
          'DELETE FROM task_roles WHERE taskId = $taskId;'
        ).run({ taskId });

        for (const role of roles) {
          StatementCache.prepare<Query>(
            db,
            `
            INSERT OR IGNORE INTO task_roles (
              taskId,
              uid,
              role
            ) VALUES (
              $taskId,
              $uid,
              $role
            );
            `
          ).run({
            taskId,
            uid: role.uid,
            role: role.role,
          });
        }
      }
    })();
  }

  public updateTaskReadAtVersion(
    taskId: string,
    readAtTime: number,
    readAtVersion: number
  ): void {
    // USING INDEX tasks_taskId_version_readAtVersion
    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      `
      UPDATE tasks
      SET
        readAtTime = $readAtTime,
        readAtVersion = $readAtVersion
      WHERE
        taskId = $taskId
        AND (
          readAtVersion IS NULL
          OR readAtVersion < $readAtVersion
        )
        AND version <= $readAtVersion;
      `
    ).run({
      taskId,
      readAtTime,
      readAtVersion,
    });
  }

  public setTaskFirstCardMessage(taskId: string, message: any): void {
    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      UPDATE tasks
      SET message = $message
      WHERE
        taskId = $taskId
        AND message IS NULL;
      `
    ).run({
      taskId,
      message: objectToJSON(message),
    });
  }

  public linkTaskConversation(taskId: string, conversationId: string): void {
    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR IGNORE INTO task_conversations
      (
        taskId,
        conversationId
      )
      VALUES
      (
        $taskId,
        $conversationId
      );
      `
    ).run({ taskId, conversationId });
  }

  public getLightTask(taskId: string): LightTaskDBType | undefined {
    const db = this.getConnection();
    return StatementCache.prepare<Query>(
      db,
      'SELECT * FROM tasks WHERE taskId = $taskId;'
    ).get({ taskId });
  }

  public deleteLocalTask(taskId: string): void {
    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      'UPDATE tasks SET remove = 1 WHERE taskId = $taskId;'
    ).run({ taskId });
  }

  public deleteLightTask(taskId: string): void {
    const db = this.getConnection();

    db.transaction(() => {
      StatementCache.prepare<Query>(
        db,
        'DELETE FROM tasks WHERE taskId = $taskId;'
      ).run({
        taskId,
      });
      StatementCache.prepare<Query>(
        db,
        'DELETE FROM task_roles WHERE taskId = $taskId;'
      ).run({
        taskId,
      });
      StatementCache.prepare<Query>(
        db,
        'DELETE FROM task_conversations WHERE taskId = $taskId;'
      ).run({ taskId });
    })();
  }

  public getLightTaskExt(taskId: string): any {
    const db = this.getConnection();

    const ext = StatementCache.prepare<Query>(
      db,
      'SELECT ext FROM tasks WHERE taskId = $taskId;'
    )
      .pluck()
      .get({ taskId });

    if (!ext) {
      return undefined;
    }

    return jsonToObject(ext);
  }

  public setLightTaskExt(taskId: string, ext: any): void {
    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      'UPDATE tasks SET ext = $ext WHERE taskId = $taskId;'
    ).run({
      taskId,
      ext: objectToJSON(ext),
    });
  }

  public getAllTasks(): LightTaskDBType[] {
    const db = this.getConnection();
    return StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT * FROM tasks
      WHERE
        remove IS NOT 1
      ORDER BY timestamp DESC;
      `
    ).all();
  }

  public getTaskRoles(taskId: string, role: number): { uid: string }[] {
    const db = this.getConnection();
    return StatementCache.prepare<Query>(
      db,
      `
      SELECT uid FROM task_roles
      WHERE
        taskId = $taskId
        AND role = $role;
      `
    ).all({ taskId, role });
  }

  public linkTaskMessage(taskId: string, messageId: string): void {
    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR IGNORE INTO task_messages
      (
        taskId,
        messageId
      )
      VALUES
      (
        $taskId,
        $messageId
      );
      `
    ).run({ taskId, messageId });
  }

  public getLinkedMessages(taskId: string): { messageId: string }[] {
    const db = this.getConnection();
    return StatementCache.prepare<Query>(
      db,
      'SELECT messageId FROM task_messages WHERE taskId = $taskId;'
    ).all({ taskId });
  }

  public delLinkedMessages(taskId: string): void {
    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      'DELETE FROM task_messages WHERE taskId = $taskId;'
    ).run({ taskId });
  }

  // vote
  public createOrUpdateBasicVote(data: VoteDBType): void {
    const {
      voteId,
      gid = null,
      creator = null,
      version = null,
      name = null,
      multiple,
      options = null,
      dueTime = null,
      anonymous,
    } = data;

    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      INSERT INTO votes (
        voteId,
        gid,
        creator,
        version,
        name,
        multiple,
        options,
        dueTime,
        anonymous
      ) values (
        $voteId,
        $gid,
        $creator,
        $version,
        $name,
        $multiple,
        $options,
        $dueTime,
        $anonymous
      ) ON CONFLICT(voteId) DO UPDATE SET
        gid = $gid,
        version = $version,
        creator = $creator,
        name = $name,
        multiple = $multiple,
        options = $options,
        dueTime = $dueTime,
        anonymous = $anonymous
      ;
      `
    ).run({
      voteId,
      gid,
      creator,
      version,
      name,
      multiple: multiple ? 1 : 0,
      options: objectToJSON(options),
      dueTime,
      anonymous: anonymous === 2 ? 2 : 1,
    });
  }

  public createOrUpdateChangeableVote(data: VoteDBType): void {
    const {
      voteId,
      version = null,
      selected = null,
      optionsCount = null,
      votersCount = null,
      totalVotes = null,
      status = null,
    } = data;

    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      INSERT INTO votes (
        voteId,
        version,
        selected,
        optionsCount,
        votersCount,
        totalVotes,
        status
      ) values (
        $voteId,
        $version,
        $selected,
        $optionsCount,
        $votersCount,
        $totalVotes,
        $status
      ) ON CONFLICT(voteId) DO UPDATE SET
        version = $version,
        selected = $selected,
        optionsCount = $optionsCount,
        votersCount = $votersCount,
        totalVotes = $totalVotes,
        status = $status
      ;
      `
    ).run({
      voteId,
      version,
      selected: objectToJSON(selected),
      optionsCount: objectToJSON(optionsCount),
      votersCount,
      totalVotes,
      status,
    });
  }

  public getVote(voteId: string): any {
    const db = this.getConnection();

    const vote = StatementCache.prepare<Query>(
      db,
      'SELECT * FROM votes WHERE voteId = $voteId;'
    ).get({ voteId });

    if (!vote) {
      return undefined;
    }

    const { selected, options, optionsCount } = vote;
    return Object.assign(vote, {
      selected: jsonToObject(selected),
      options: jsonToObject(options),
      optionsCount: jsonToObject(optionsCount),
    });
  }

  public deleteVote(voteId: string): void {
    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      'DELETE FROM votes WHERE voteId = $voteId;'
    ).run({
      voteId,
    });
  }

  public voteLinkMessage(voteId: string, messageId: string): void {
    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR IGNORE INTO vote_messages (
        voteId,
        messageId
      ) values (
        $voteId,
        $messageId
      );
      `
    ).run({ voteId, messageId });
  }

  public getVoteLinkedMessages(voteId: string): { messageId: string }[] {
    const db = this.getConnection();

    return StatementCache.prepare<Query>(
      db,
      'SELECT messageId FROM vote_messages WHERE voteId = $voteId'
    ).all({ voteId });
  }

  public delVoteLinkedMessages(voteId: string): void {
    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      'DELETE FROM vote_messages WHERE voteId = $voteId;'
    ).run({
      voteId,
    });
  }

  public getThreadMessagesUnreplied(
    conversationId: string,
    threadId: string,
    serverTimestamp: number = Number.MAX_VALUE,
    limit: number = 50
  ): MessageDBType[] {
    // USING INDEX messages_thread_unreplied
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_thread_unreplied
      WHERE pin IS NULL
      AND conversationId = $conversationId
      AND json_extract(json, '$.threadId') = $threadId
      AND json_extract(json, '$.threadReplied') IS NOT TRUE
      AND serverTimestamp <= $serverTimestamp
      ORDER BY serverTimestamp DESC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        conversationId,
        threadId,
        serverTimestamp,
        limit,
      });

    return mapWithJsonToObject(jsons);
  }

  public findNewerThreadReplied(
    conversationId: string,
    threadId: string,
    serverTimestamp: number = Number.MAX_VALUE
  ): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_thread_replied
      WHERE pin IS NULL
      AND conversationId = $conversationId
      AND json_extract(json, '$.threadId') = $threadId
      AND (
        json_extract(json, '$.threadReplied') IS TRUE
        OR json_extract(json, '$.botContext') IS NULL
      )
      AND serverTimestamp > $serverTimestamp
      LIMIT 1;
      `
    )
      .pluck()
      .all({
        conversationId,
        threadId,
        serverTimestamp,
      });

    return mapWithJsonToObject(jsons);
  }

  public getQuoteMessages(offset: number = 0): MessageDBType[] {
    const db = this.getConnection();

    // USING INDEX message_quote_without_thread
    // group id always bigger or equal than 16
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json
      FROM messages
      INDEXED BY message_quote_without_thread
      WHERE
        pin IS NULL
        AND json_extract(json, '$.threadContext') IS NULL
        AND json_extract(json, '$.quote') IS NOT NULL
        AND LENGTH(conversationId) >= 16
      ORDER BY serverTimestamp
      LIMIT 100 OFFSET $offset;
      `
    )
      .pluck()
      .all({ offset });

    return mapWithJsonToObject(jsons);
  }

  public deletePinMessagesByConversationId(conversationId: string): void {
    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      DELETE FROM messages
        INDEXED BY messages_conversation_pin
      WHERE conversationId = $conversationId AND pin > '';
      `
    ).run({ conversationId });
  }

  public getPinMessagesByConversationId(
    conversationId: string
  ): MessageDBType[] {
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_conversation_pin
        WHERE conversationId = $conversationId AND pin > '';
      `
    )
      .pluck()
      .all({ conversationId });

    return mapWithJsonToObject(jsons);
  }

  public getPinMessageById(pinId: string): MessageDBType | undefined {
    const db = this.getConnection();

    const json = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_pin
      WHERE pin = $pinId;
      `
    )
      .pluck()
      .get({ pinId });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  public cleanupExpiredTable(db: Database): void {
    const isChative = true;
    if (isChative) {
      db.exec('DELETE FROM messages_expired;');
    }
  }

  // must be called before sql_channel functions called
  public cleanupExpiredMessagesAtStartup(): void {
    const db = this.getConnection();

    this.cleanupExpiredTable(db);

    const logger = this.getLogger();

    const total = this.getAllMessageCount();
    if (total > 100000) {
      logger.info(`total message count ${total}, just return`);
      return;
    }

    db.transaction(() => {
      db.prepare<EmptyQuery>(
        `
        CREATE INDEX IF NOT EXISTS messages_expires_at
        ON messages (
          expires_at ASC
        )
        WHERE pin IS NULL;
        `
      ).run();

      const now = Date.now();

      const expiredCount = this.getExpiredMessagesCount(now);
      if (!expiredCount) {
        logger.info('expired message count is zero.');
        return;
      }

      logger.info('detected expired message count:', expiredCount);

      const createSQLs = getAllCreateSQLs(db, 'messages');
      const {
        table: tableRows,
        index: indexRows,
        trigger: triggerRows,
      } = createSQLs;

      if (!tableRows?.length) {
        logger.error(`there is no table create sql.`);
        return;
      }

      const messagesTableSQL = tableRows[0].sql;

      // create messages_expired if not exists
      const expiredTableSQL = messagesTableSQL.replace(
        /(CREATE TABLE) "?messages"?/i,
        '$1 IF NOT EXISTS messages_expired'
      );
      db.prepare<EmptyQuery>(expiredTableSQL).run();

      // // select expired messages into messages_expired
      // // using index messages_expires_at
      // db.prepare<Query>(
      //   `
      //   REPLACE INTO messages_expired
      //   SELECT * FROM messages
      //   INDEXED BY messages_expires_at
      //   WHERE
      //     pin is NULL AND
      //     expires_at <= $expires_at;
      //   `
      // ).run({ expires_at: now });

      // create temp index for moving messages
      db.prepare<EmptyQuery>(
        `
        CREATE INDEX IF NOT EXISTS messages_expires_temp
        ON messages (
          expires_at ASC
        );
        `
      ).run();

      const messages_old = `messages_old_${now}`;

      // rename table messages to messages_old
      db.exec(`ALTER TABLE messages RENAME TO ${messages_old};`);

      // re-create table messages
      db.exec(messagesTableSQL);

      // select normal messages into table messages
      // using index messages_expires_temp
      // using index messages_pin
      db.prepare<Query>(
        `
        REPLACE INTO messages
        SELECT * FROM ${messages_old}
        WHERE
          expires_at > $expires_at
          OR expires_at IS NULL
          OR pin > '';
        `
      ).run({ expires_at: now });

      // re-construct messsages_fts
      db.exec(
        `
        DELETE FROM messages_fts;

        INSERT INTO messages_fts(id, body)
          SELECT id, body FROM messages;

        -- drop unused table messages_old
        DROP TABLE ${messages_old};
        `
      );

      // re-create indexes
      if (indexRows?.length) {
        for (const row of indexRows) {
          db.prepare<EmptyQuery>(row.sql).run();
        }
      } else {
        logger.info(`there is no table index sql.`);
      }

      // re-creaet triggers
      if (triggerRows?.length) {
        for (const row of triggerRows) {
          db.prepare<EmptyQuery>(row.sql).run();
        }
      } else {
        logger.info(`there is no table trigger sql.`);
      }
    })();
  }

  // 1 generated by local read
  //   sourceDevice, conversationId, maxServerTimestamp, readAt, sender, sentAt
  // 2 generated by synced form other devices
  //   sourceDevice, conversationId, maxServerTimestamp, readAt sender, sentAt

  // how to deal with readAt when local record conflicting with synced ?
  public saveReadPosition(readPosition: ReadPositionDBType): void {
    const {
      sourceDevice,
      conversationId,
      maxServerTimestamp,
      readAt,
      sender = null,
      sentAt = null,
      maxNotifySequenceId = null,
    } = readPosition;

    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      `
      INSERT INTO read_positions(
        sourceDevice,
        conversationId,
        maxServerTimestamp,
        readAt,
        sender,
        sentAt,
        maxNotifySequenceId
      ) VALUES (
        $sourceDevice,
        $conversationId,
        $maxServerTimestamp,
        $readAt,
        $sender,
        $sentAt,
        $maxNotifySequenceId
      )
      ON CONFLICT(sourceDevice, conversationId, maxServerTimestamp) DO UPDATE
        SET
          readAt =
            CASE
              WHEN readAt > $readAt THEN $readAt
              ELSE readAt
            END,
          sentAt = $sentAt,
          maxNotifySequenceId = $maxNotifySequenceId
        WHERE readAt > $readAt
          OR sentAt IS NULL
          OR maxNotifySequenceId IS NULL;
      `
    ).run({
      sourceDevice,
      conversationId,
      maxServerTimestamp,
      readAt,
      sender,
      sentAt,
      maxNotifySequenceId,
    });
  }

  public saveReadPositions(readPositions: ReadPositionDBType[]): void {
    const db = this.getConnection();

    db.transaction(() => {
      for (const position of readPositions) {
        this.saveReadPosition(position);
      }
    })();
  }

  // get top read position in conversation
  // using index read_position_conversation
  public topReadPosition(
    conversationId: string
  ): ReadPositionDBType | undefined {
    const db = this.getConnection();
    return StatementCache.prepare<Query>(
      db,
      `
      SELECT * FROM read_positions
      INDEXED BY read_position_conversation
      WHERE conversationId = $conversationId
      ORDER BY maxServerTimestamp DESC
      LIMIT 1;
      `
    ).get({ conversationId });
  }

  // using index read_position_conversation
  public getReadPositions(
    conversationId: string,
    {
      begin = 0,
      end = Number.MAX_VALUE,
      includeBegin = false,
      includeEnd = false,
      limit = 50,
    }: {
      begin?: number;
      end?: number;
      includeBegin?: boolean;
      includeEnd?: boolean;
      limit?: number;
    } = {}
  ): ReadPositionDBType[] {
    const db = this.getConnection();

    const beginCompare = includeBegin ? '>=' : '>';
    const endCompare = includeEnd ? '<=' : '<';

    return StatementCache.prepare<Query>(
      db,
      `
      SELECT * FROM read_positions
      INDEXED BY read_position_conversation
      WHERE
        conversationId = $conversationId
        AND maxServerTimestamp ${beginCompare} $begin
        AND maxServerTimestamp ${endCompare} $end
      ORDER BY maxServerTimestamp ASC
      LIMIT $limit;
      `
    ).all({
      conversationId,
      begin,
      end,
      limit,
    });
  }

  // using index messages_conversation
  public getUnreadMessages(
    conversationId: string,
    start: number,
    end: number,
    limit: number = 50
  ): MessageDBType[] {
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_conversation
      WHERE
        conversationId = $conversationId AND
        serverTimestamp > $start AND
        serverTimestamp <= $end AND
        pin is NULL
      ORDER BY serverTimestamp ASC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        conversationId,
        start,
        end,
        limit,
      });

    return mapWithJsonToObject(jsons);
  }

  // using index messages_conversation_unread_count
  public getUnreadMessageCount(
    conversationId: string,
    start: number,
    end: number
  ): number {
    const db = this.getConnection();

    return StatementCache.prepare<Query>(
      db,
      `
      SELECT COUNT(*) FROM messages
      INDEXED BY messages_conversation_unread_count
      WHERE
        conversationId = $conversationId AND
        type IS 'incoming' AND
        serverTimestamp > $start AND
        serverTimestamp <= $end AND
        json_extract(json, '$.hasBeenRecalled') IS NOT TRUE AND
        json_extract(json, '$.recall') IS NULL AND
        pin is NULL;
      `
    )
      .pluck()
      .get({
        conversationId,
        start,
        end,
      });
  }

  // using index messages_conversation_has_read
  public findLastReadMessage(
    conversationId: string
  ): MessageDBType | undefined {
    const db = this.getConnection();

    const json = StatementCache.prepare<Query>(
      db,
      `
      SELECT json FROM messages
      INDEXED BY messages_conversation_has_read
      WHERE
        conversationId = $conversationId
        AND unread IS NULL
        AND pin IS NULL
        AND json_extract(json, '$.recall') IS NULL
      ORDER BY serverTimestamp DESC
      LIMIT 1;
      `
    )
      .pluck()
      .get({ conversationId });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  public findLastMessageForMarkRead(
    conversationId: string,
    serverTimestamp: number = Number.MAX_VALUE
  ): (MessageDBType | undefined)[] {
    const db = this.getConnection();

    const lastMessages: Array<MessageDBType | undefined> = [];
    db.transaction(() => {
      const first = StatementCache.prepare<Query>(
        db,
        `
        SELECT json
        FROM
          messages INDEXED BY messages_conversation_unread_count
        WHERE
          conversationId = $conversationId
          AND type IS 'incoming'
          AND serverTimestamp <= $serverTimestamp
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.recall') IS NULL
          AND pin is NULL
        ORDER BY serverTimestamp DESC
        LIMIT 1;
        `
      )
        .pluck()
        .get({
          conversationId,
          serverTimestamp,
        });

      lastMessages.push(first ? jsonToObject(first) : undefined);

      const second = StatementCache.prepare<Query>(
        db,
        `
        SELECT json
        FROM
          messages INDEXED BY messages_conversation_non_outgoing
        WHERE
          conversationId = $conversationId
          AND serverTimestamp <= $serverTimestamp
          AND type IS NOT 'outgoing'
          AND pin is NULL
        ORDER BY serverTimestamp DESC
        LIMIT 1;
        `
      )
        .pluck()
        .get({
          conversationId,
          serverTimestamp,
        });

      lastMessages.push(second ? jsonToObject(second) : undefined);
    })();

    return lastMessages;
  }

  public findLastUserMessage(
    conversationId: string
  ): MessageDBType | undefined {
    const db = this.getConnection();

    const json = StatementCache.prepare<Query>(
      db,
      `
      SELECT json
      FROM
        messages INDEXED BY messages_conversation_unread_count
      WHERE
        conversationId = $conversationId
        AND (type IS 'incoming' OR type IS 'outgoing')
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.recall') IS NULL
        AND pin is NULL
      ORDER BY serverTimestamp DESC
      LIMIT 1;
      `
    )
      .pluck()
      .get({ conversationId });

    if (!json) {
      return undefined;
    }

    return jsonToObject(json);
  }

  public getMentionsYouMessageCount(
    conversationId: string,
    startTimestamp: number,
    endTimestamp: number
  ): number {
    const db = this.getConnection();

    return StatementCache.prepare<Query>(
      db,
      `
      SELECT
        COUNT(*)
      FROM
        messages
      WHERE
        conversationId = $conversationId
        AND type IS 'incoming'
        AND serverTimestamp > $startTimestamp
        AND serverTimestamp <= $endTimestamp
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.recall') IS NULL
        AND pin is NULL
        AND (
          json_extract(json, '$.mentionsQuoteFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x2
        );
      `
    )
      .pluck()
      .get({
        conversationId,
        startTimestamp,
        endTimestamp,
      });
  }

  public getMentionsYouMessage(
    conversationId: string,
    serverTimestamp: number,
    limit: number = 50
  ): MessageDBType[] {
    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        json
      FROM
        messages
      WHERE
        conversationId = $conversationId
        AND type IS 'incoming'
        AND serverTimestamp > $serverTimestamp
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.recall') IS NULL
        AND pin is NULL
        AND (
          json_extract(json, '$.mentionsQuoteFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x2
        )
      ORDER BY serverTimestamp ASC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        conversationId,
        serverTimestamp,
        limit,
      });

    return mapWithJsonToObject(jsons);
  }

  public getMentionsAtMessage(
    conversationId: string,
    serverTimestamp: number = 0,
    who: 'YOU' | 'ALL',
    limit: number = 50
  ): MessageDBType[] {
    let flag = 0x1;

    if (who === 'YOU') {
      flag = 0x1;
    } else if (who === 'ALL') {
      flag = 0x2;
    } else {
      throw new Error(`Unsupported at flag for ${who}`);
    }

    const db = this.getConnection();

    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        json
      FROM
        messages
      WHERE
        conversationId = $conversationId
        AND type IS 'incoming'
        AND serverTimestamp > $serverTimestamp
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.recall') IS NULL
        AND pin is NULL
        AND json_extract(json, '$.mentionsAtFlags') & $flag
      ORDER BY serverTimestamp ASC
      LIMIT $limit;
      `
    )
      .pluck()
      .all({
        conversationId,
        serverTimestamp,
        limit,
        flag,
      });

    return mapWithJsonToObject(jsons);
  }

  public getMentionsAtYouMessage(
    conversationId: string,
    serverTimestamp: number = 0,
    limit: number = 50
  ): MessageDBType[] {
    return this.getMentionsAtMessage(
      conversationId,
      serverTimestamp,
      'YOU',
      limit
    );
  }

  public getMentionsAtAllMessage(
    conversationId: string,
    serverTimestamp: number = 0,
    limit: number = 50
  ): MessageDBType[] {
    return this.getMentionsAtMessage(
      conversationId,
      serverTimestamp,
      'ALL',
      limit
    );
  }

  public integrateMentions(ourNumber: string): void {
    if (!ourNumber) {
      throw new Error('invalid ourNumber.');
    }

    const logger = this.getLogger();

    logger.info('start integrateMentions ...');

    const db = this.getConnection();

    db.transaction(() => {
      const createSQLs = getAllCreateSQLs(db, 'messages');
      const { index: indexRows, trigger: triggerRows } = createSQLs;

      // remove all indexes
      if (indexRows?.length) {
        for (const row of indexRows) {
          db.prepare<EmptyQuery>(`DROP INDEX IF EXISTS ${row.name};`).run();
        }
      } else {
        logger.info('there is no table index sql.');
      }

      // remove all triggers
      if (triggerRows?.length) {
        for (const row of triggerRows) {
          db.prepare<EmptyQuery>(`DROP TRIGGER IF EXISTS ${row.name};`).run();
        }
      } else {
        logger.info('there is no table trigger sql.');
      }

      // create index atPersons
      db.exec(
        `
        DROP INDEX IF EXISTS messages_atpersons_temp;

        CREATE INDEX
        messages_atpersons_temp ON messages (
          atPersons
        ) WHERE atPersons > '';

        DROP INDEX IF EXISTS messages_quote_temp;
        CREATE INDEX
        messages_quote_temp ON messages (
          json_extract(json, '$.quote.author')
        ) WHERE json_extract(json, '$.quote.author') > '';
        `
      );

      const count = StatementCache.prepare<EmptyQuery>(
        db,
        `
        SELECT COUNT(*) FROM messages
        WHERE atPersons > ''
        OR json_extract(json, '$.quote.author') > '';
        `
      )
        .pluck()
        .get();

      logger.info('total mentions count:', count);

      const statement = StatementCache.prepare<Query>(
        db,
        `
        SELECT
          id, json
        FROM
          messages
        WHERE
          atPersons > ''
          OR json_extract(json, '$.quote.author') > ''
        ORDER BY serverTimestamp
        LIMIT 100
        OFFSET $offset;
        `
      );

      let offset = 0;

      do {
        const rows = statement.all({ offset });
        if (!rows?.length) {
          break;
        }

        logger.info(
          `handling mentions offset: ${offset} count: ${rows.length}`
        );

        offset += rows.length;

        for (const row of rows) {
          const { id, json: jsonString } = row;
          const jsonObj = jsonToObject<{
            atPersons?: string;
            quote?: { author?: string };
          }>(jsonString);
          const { atPersons, quote } = jsonObj;

          if (atPersons) {
            let mentionsAtFlags = 0;
            const atList = atPersons.split(';').filter(at => at.trim().length);
            for (const person of atList) {
              if (person === ourNumber) {
                mentionsAtFlags |= 0x1;
              } else if (person === 'MENTIONS_ALL') {
                mentionsAtFlags |= 0x2;
              } else {
                mentionsAtFlags |= 0x4;
              }

              if (mentionsAtFlags === 0x7) {
                break;
              }
            }

            Object.assign(jsonObj, { mentionsAtFlags });
          }

          if (quote?.author) {
            let mentionsQuoteFlags = 0;

            if (quote.author === ourNumber) {
              mentionsQuoteFlags = 0x1;
            } else {
              mentionsQuoteFlags = 0x2;
            }

            Object.assign(jsonObj, { mentionsQuoteFlags });
          }

          StatementCache.prepare<Query>(
            db,
            `UPDATE messages SET json=$json WHERE id=$id;`
          ).run({
            json: objectToJSON(jsonObj),
            id,
          });
        }
      } while (true);

      db.exec(
        `
        DROP INDEX IF EXISTS messages_atpersons_temp;
        DROP INDEX IF EXISTS messages_quote_temp;
        `
      );

      if (indexRows?.length) {
        for (const row of indexRows) {
          db.prepare<EmptyQuery>(row.sql).run();
        }
      } else {
        logger.info('there is no index in table');
      }

      if (triggerRows?.length) {
        for (const row of triggerRows) {
          db.prepare<EmptyQuery>(row.sql).run();
        }
      } else {
        logger.info('there is no trigger in table');
      }
    });
  }

  public rebuildMessagesMeta(): void {
    this.rebuildMessagesIndexesIfNotExists();
    this.rebuildMessagesTriggersIfNotExists();
  }

  public rebuildMessagesIndexesIfNotExists(): void {
    const db = this.getConnection();

    const logger = this.getLogger();

    logger.info('rebuildMessagesIndexesIfNotExists begin ...');

    db.exec(
      `
      DROP INDEX IF EXISTS messages_quote_temp;
      DROP INDEX IF EXISTS messages_atpersons_temp;

      CREATE INDEX IF NOT EXISTS messages_schemaVersion
        ON messages (
          schemaVersion
        );

      CREATE INDEX IF NOT EXISTS messages_quote_without_threadContext
        ON messages (
          sent_at
        )
        WHERE pin IS NULL
          AND json_extract(json, '$.threadContext') IS NULL
          AND json_extract(json, '$.quote') IS NOT NULL
          AND sent_at IS NOT NULL;

      CREATE INDEX IF NOT EXISTS messages_expires_at
        ON messages (
          expires_at ASC
        )
        WHERE pin IS NULL;

      CREATE INDEX IF NOT EXISTS messages_without_timer
        ON messages (
          type,
          expireTimer
        )
        WHERE pin IS NULL
          AND expires_at IS NULL
          AND expireTimer IS NOT NULL;

      CREATE INDEX IF NOT EXISTS messages_conversation_pin
        ON messages (
          conversationId,
          pin
        )
        WHERE pin IS NOT NULL;

      CREATE INDEX IF NOT EXISTS messages_unread
        ON messages (
          conversationId,
          unread,
          serverTimestamp DESC
        )
        WHERE pin IS NULL
          AND unread IS NOT NULL;

      CREATE INDEX IF NOT EXISTS messages_thread_unread
        ON messages (
          conversationId,
          json_extract(json, '$.threadId'),
          unread,
          serverTimestamp DESC
        )
        WHERE pin IS NULL
          AND unread IS NOT NULL;

      CREATE INDEX IF NOT EXISTS messages_hasAttachments
        ON messages (
          conversationId,
          hasAttachments,
          serverTimestamp
        );

      CREATE INDEX IF NOT EXISTS messages_conversation
        ON messages (
            conversationId,
            serverTimestamp ASC
          )
        WHERE pin IS NULL;

      CREATE INDEX IF NOT EXISTS messages_conversation_source
        ON messages (
            conversationId,
            source,
            type,
            serverTimestamp ASC
          )
        WHERE pin IS NULL;

      CREATE INDEX IF NOT EXISTS messages_hasVisualMediaAttachments
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND hasVisualMediaAttachments = 1
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_hasVisualMediaAttachments_pin
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NOT NULL
          AND hasVisualMediaAttachments = 1
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_hasFileAttachments
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND hasFileAttachments = 1
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_thread_replied
        ON messages (
            conversationId,
            json_extract(json, '$.threadId'),
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.threadId') IS NOT NULL
          AND (
            json_extract(json, '$.threadReplied') IS TRUE
            OR json_extract(json, '$.botContext') IS NULL
          );

      CREATE INDEX IF NOT EXISTS messages_thread_unreplied
        ON messages (
            conversationId,
            json_extract(json, '$.threadId'),
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.threadId') IS NOT NULL
          AND json_extract(json, '$.threadReplied') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_conversation_visible
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.flags') IS NOT 2
          AND (
            type IS NULL
            OR type NOT IN (
              'keychange',
              'verified-change'
            )
          );

      CREATE INDEX IF NOT EXISTS messages_conversation_visible_unread
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.flags') IS NOT 2
          AND (
            type IS NULL
            OR type NOT IN (
              'keychange',
              'verified-change'
            )
          )
          AND unread = 1;

      CREATE INDEX IF NOT EXISTS messages_conversation_thread_visible
        ON messages (
            conversationId,
            json_extract(json, '$.threadId'),
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.threadId') IS NOT NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.flags') IS NOT 2
          AND (
            type IS NULL
            OR type NOT IN (
              'keychange',
              'verified-change'
            )
          );

      CREATE INDEX IF NOT EXISTS messages_conversation_thread_visible_unread
        ON messages (
            conversationId,
            json_extract(json, '$.threadId'),
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.threadId') IS NOT NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.flags') IS NOT 2
          AND (
            type IS NULL
            OR type NOT IN (
              'keychange',
              'verified-change'
            )
          )
          AND unread = 1;

      CREATE INDEX IF NOT EXISTS messages_duplicate_check
        ON messages (
            source,
            sourceDevice,
            sent_at
          )
        WHERE pin IS NULL;

      CREATE INDEX IF NOT EXISTS messages_pin
        ON messages (
            pin
          )
        WHERE pin IS NOT NULL;

      CREATE INDEX IF NOT EXISTS messages_receipt
        ON messages (
            sent_at,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS message_quote_without_thread
        ON messages (
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.quote') IS NOT NULL
          AND json_extract(json, '$.threadContext') IS NULL;

      CREATE INDEX IF NOT EXISTS messages_conversation_has_read
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND unread IS NULL
          AND json_extract(json, '$.recall') IS NULL;

      CREATE INDEX IF NOT EXISTS messages_conversation_unread_count
        ON messages (
            conversationId,
            type,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND json_extract(json, '$.recall') IS NULL
          AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      CREATE INDEX IF NOT EXISTS messages_conversation_non_outgoing
        ON messages (
            conversationId,
            serverTimestamp DESC
          )
        WHERE
          pin IS NULL
          AND type IS NOT 'outgoing';

      CREATE INDEX IF NOT EXISTS messages_mentions_you
        ON messages (
          conversationId,
          type,
          serverTimestamp
        )
        WHERE
          json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
          AND json_extract(json, '$.recall') IS NULL
          AND pin IS NULL
          AND (
            json_extract(json, '$.mentionsQuoteFlags') & 0x1
            OR json_extract(json, '$.mentionsAtFlags') & 0x1
            OR json_extract(json, '$.mentionsAtFlags') & 0x2
          );

      CREATE INDEX IF NOT EXISTS messages_recall_source
        ON messages (
          serverTimestamp ASC
        )
        WHERE
          json_type(json, '$.recall') = 'object'
          AND json_extract(json, '$.recall.target') IS NULL;
      `
    );

    logger.info('rebuildMessagesIndexesIfNotExists end ...');
  }

  public rebuildMessagesTriggersIfNotExists(): void {
    const db = this.getConnection();
    const logger = this.getLogger();

    logger.info('rebuildMessagesTriggersIfNotExists start ...');

    db.exec(
      `
      CREATE TRIGGER IF NOT EXISTS messages_on_insert
      AFTER INSERT ON messages
      BEGIN
        INSERT INTO messages_fts (
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;

      CREATE TRIGGER IF NOT EXISTS messages_on_delete
      AFTER DELETE ON messages
      BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS messages_on_update
      AFTER UPDATE ON messages
      BEGIN
        DELETE FROM messages_fts WHERE id = old.id;
        INSERT INTO messages_fts(
          id,
          body
        ) VALUES (
          new.id,
          new.body
        );
      END;
      `
    );

    logger.info('rebuildMessagesTriggersIfNotExists end ...');
  }

  public getGroupMemberLastActiveList(
    conversationId: string
  ): { number: string; lastActive: number }[] {
    const db = this.getConnection();
    const rows = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        source,
        MAX(serverTimestamp)
      FROM
        messages INDEXED BY messages_conversation_source
      WHERE
        pin IS NULL
        AND conversationId = $conversationId
        AND type = 'incoming'
        AND source IN (
          SELECT
            value
          FROM
            (
              SELECT
                json_extract(json, '$.members') AS members
              FROM
                conversations
              WHERE
                id = $conversationId
            ) AS temp,
            json_each(temp.members)
        )
      GROUP BY
        source;
      `
    ).all({ conversationId });

    return rows.map(row => ({
      number: '+' + row.source,
      lastActive: row['MAX(serverTimestamp)'],
    }));
  }

  // list all threads in conversation and return newest message in each of them
  public listThreadsWithNewestMessage(conversationId: string): MessageDBType[] {
    const conditions = conversationId
      ? 'AND conversationId = $conversationId'
      : `AND conversationId > ''`;

    const db = this.getConnection();
    const jsons = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        json,
        MAX(serverTimestamp)
      FROM messages INDEXED BY messages_conversation_thread_visible
        JOIN (
          SELECT
            DISTINCT conversationId AS cid,
            json_extract(json, '$.threadId') AS tid
          FROM
            messages INDEXED BY messages_conversation_thread_visible
          WHERE
            pin IS NULL
            AND json_extract (json, '$.threadId') IS NOT NULL
            AND json_extract (json, '$.hasBeenRecalled') IS NOT TRUE
            AND json_extract (json, '$.flags') IS NOT 2
            AND (
              type IS NULL
              OR type NOT IN (
                'keychange',
                'verified-change'
              )
            )
            ${conditions}
        ) ON tid = json_extract(json, '$.threadId')
        AND cid = conversationId
      WHERE
        pin IS NULL
        AND json_extract(json, '$.threadId') IS NOT NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.flags') IS NOT 2
        AND (
          type IS NULL
          OR type NOT IN (
            'keychange',
            'verified-change'
          )
        )
        AND conversationId > ''
      GROUP BY
        json_extract(json, '$.threadId'),
        conversationId;
      `
    )
      .pluck()
      .all({ conversationId });

    return mapWithJsonToObject(jsons);
  }

  public getUnhandledRecalls(): MessageDBType[] {
    const db = this.getConnection();
    const jsons = StatementCache.prepare<EmptyQuery>(
      db,
      `
      SELECT
        json
      FROM
        messages
      WHERE
        json_type(json, '$.recall') = 'object'
        AND json_extract(json, '$.recall.target') IS NULL
      ORDER BY serverTimestamp ASC;
      `
    )
      .pluck()
      .all();

    return mapWithJsonToObject(jsons);
  }

  public saveFileRiskInfo(data: FileRiskDBType) {
    const { sha256, fileSize, riskStatus, createdAt, checkedAt } = data;

    const now = Date.now();

    const db = this.getConnection();
    StatementCache.prepare<Query>(
      db,
      `
      INSERT INTO file_risk (
        sha256,
        file_size,
        risk_status,
        created_at,
        checked_at
      ) VALUES (
        $sha256,
        $file_size,
        $risk_status,
        $created_at,
        $checked_at
      ) ON CONFLICT(sha256, file_size) DO UPDATE SET
        checked_at = $checked_at;
      `
    ).run({
      sha256,
      file_size: fileSize,
      risk_status: riskStatus,
      created_at: createdAt || now,
      checked_at: checkedAt || now,
    });
  }

  public getFileRiskInfo(
    sha256: string,
    fileSize: number
  ): FileRiskDBType | undefined {
    const db = this.getConnection();

    const row = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        file_id,
        risk_status,
        created_at,
        checked_at
      FROM file_risk
      WHERE
        sha256 = $sha256
        AND file_size = $fileSize;
      `
    ).get({ sha256, fileSize });

    if (!row) {
      return undefined;
    }

    const {
      file_id: fileId,
      risk_status: riskStatus,
      created_at: createdAt,
      checked_at: checkedAt,
    } = row;

    return {
      fileId,
      sha256,
      fileSize,
      riskStatus,
      createdAt,
      checkedAt,
    };
  }

  public saveUrlRiskInfo(data: UrlRiskDBType) {
    const { url, riskStatus, createdAt, checkedAt } = data;

    const now = Date.now();

    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      INSERT INTO url_risk (
        url,
        risk_status,
        created_at,
        checked_at
      ) VALUES (
        $url,
        $risk_status,
        $created_at,
        $checked_at
      ) ON CONFLICT(url) DO UPDATE SET
        checked_at = $checked_at;
      `
    ).run({
      url,
      risk_status: riskStatus,
      created_at: createdAt || now,
      checked_at: checkedAt || now,
    });
  }

  public getUrlRiskInfo(url: string): UrlRiskDBType | undefined {
    const db = this.getConnection();
    const row = StatementCache.prepare<Query>(
      db,
      `
      SELECT
        url_id,
        risk_status,
        created_at,
        checked_at
      FROM url_risk
      WHERE
        url = $url;
      `
    ).get({ url });

    if (!row) {
      return undefined;
    }

    const {
      url_id: urlId,
      risk_status: riskStatus,
      created_at: createdAt,
      checked_at: checkedAt,
    } = row;

    return {
      urlId,
      url,
      riskStatus,
      createdAt,
      checkedAt,
    };
  }

  // sessions v2
  public createOrUpdateSessionV2(data: SessionV2DBType): void {
    const { uid, identityKey, registrationId, msgEncVersion } = data;

    const db = this.getConnection();

    StatementCache.prepare<Query>(
      db,
      `
      INSERT OR REPLACE INTO sessions_v2 (
        uid,
        json
      ) VALUES (
        $uid,
        $json
      );
      `
    ).run({
      uid,
      json: objectToJSON({
        identityKey,
        registrationId,
        msgEncVersion,
      }),
    });
  }

  public getSessionV2ById(uid: string): SessionV2DBType | undefined {
    const db = this.getConnection();
    const row = StatementCache.prepare<Query>(
      db,
      'SELECT * FROM sessions_v2 WHERE uid = $uid;'
    ).get({ uid });
    if (!row) {
      return undefined;
    }
    const { identityKey, registrationId, msgEncVersion } = JSON.parse(row.json);

    return {
      uid: row.uid + '', // should be string
      identityKey,
      registrationId,
      msgEncVersion,
    };
  }
}
