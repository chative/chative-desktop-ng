import type { Database, Statement } from '@signalapp/better-sqlite3';
import { isNumber, groupBy, Dictionary } from 'lodash';
import { EmptyQuery, Query, SQLType, TableType } from '../sqlTypes';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

const INVALID_KEY_REGEX = /[^0-9A-Fa-f]/;
export function isValidDBKey(key: string) {
  return !INVALID_KEY_REGEX.exec(key);
}

export function objectToJSON<T>(data: T): string {
  return JSON.stringify(data);
}

export function jsonToObject<T>(json: string): T {
  return JSON.parse(json);
}

export function mapWithJsonToObject<T>(jsons: Array<string>): Array<T> {
  return jsons.map(json => jsonToObject(json));
}

export function pragmaGet(db: Database, pragmaKey: string) {
  return db.pragma(pragmaKey, { simple: true });
}

export function pragmaRun(db: Database, pragmaCmd: string): void {
  return db.pragma(pragmaCmd);
}

export function keyDatabase(db: Database, key: string): void {
  // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
  pragmaRun(db, `key = "x'${key}'"`);
}

export function switchToWAL(db: Database): void {
  // https://sqlite.org/wal.html
  pragmaRun(db, 'journal_mode = WAL');
  pragmaRun(db, 'synchronous = FULL');
  pragmaRun(db, 'fullfsync = ON');
}

export function getSQLiteVersion(db: Database): string {
  const { sqlite_version: version } = db
    .prepare<EmptyQuery>('select sqlite_version() AS sqlite_version;')
    .get();

  return version;
}

export function getSchemaVersion(db: Database): number {
  return pragmaGet(db, 'schema_version');
}

export function getSQLCipherVersion(db: Database): string | undefined {
  return pragmaGet(db, 'cipher_version');
}

export function setUserVersion(db: Database, version: number): void {
  if (!isNumber(version)) {
    throw new Error(`setUserVersion: version ${version} is not a number`);
  }

  pragmaRun(db, `user_version = ${version}`);
}

export function getUserVersion(db: Database): number {
  return pragmaGet(db, 'user_version');
}

export function countTableRows(db: Database, table: TableType): number {
  const result: null | number = db
    .prepare<EmptyQuery>(`SELECT COUNT(*) FROM ${table};`)
    .pluck()
    .get();

  if (isNumber(result)) {
    return result;
  }

  throw new Error(`countTableRows: Unable to count rows of table ${table}`);
}

// This value needs to be below SQLITE_MAX_VARIABLE_NUMBER.
const MAX_VARIABLE_COUNT = 100;

export function batchQueryWithMultiVar<ValueT, ResultT>(
  db: Database,
  values: Array<ValueT>,
  query:
    | ((batch: Array<ValueT>) => void)
    | ((batch: Array<ValueT>) => Array<ResultT>)
): Array<ResultT> {
  if (values.length > MAX_VARIABLE_COUNT) {
    const result: Array<ResultT> = [];
    db.transaction(() => {
      for (let i = 0; i < values.length; i += MAX_VARIABLE_COUNT) {
        const batch = values.slice(i, i + MAX_VARIABLE_COUNT);
        const batchResult = query(batch);
        if (Array.isArray(batchResult)) {
          result.push(...batchResult);
        }
      }
    })();
    return result;
  }

  const result = query(values);
  return Array.isArray(result) ? result : [];
}

export function getCreateSQL(db: Database, type: SQLType, tableName: string) {
  const rows = StatementCache.prepare<Query>(
    db,
    `
    SELECT name, sql FROM sqlite_master
    WHERE type=$type
      AND tbl_name=$tbl_name;
    `
  ).all({ type, tbl_name: tableName });

  return rows.filter(r => r.sql);
}

export function getAllCreateSQLs(
  db: Database,
  tableName: TableType
): Dictionary<any[]> {
  const rows = StatementCache.prepare<Query>(
    db,
    `SELECT type, name, sql FROM sqlite_master WHERE tbl_name=$tbl_name;`
  ).all({ tbl_name: tableName });

  return groupBy(
    rows.filter(r => r.sql),
    r => r.type
  );
}

export function generateUUID() {
  return uuidv4();
}

export function backup(dbPath: string) {
  if (!fs.existsSync(dbPath)) {
    return;
  }

  const bkFile = `${dbPath}-bk`;
  if (fs.existsSync(bkFile)) {
    return;
  }

  fs.copyFileSync(dbPath, bkFile, fs.constants.COPYFILE_EXCL);
}

type QueryStatementMap = Map<string, Statement<Array<unknown>>>;
export class StatementCache {
  private static readonly stmCache = new WeakMap<Database, QueryStatementMap>();

  static prepare<T extends Array<unknown> | Record<string, unknown>>(
    db: Database,
    query: string
  ): Statement<T> {
    let statement;
    let cachedStms = this.stmCache.get(db);

    if (cachedStms) {
      statement = cachedStms.get(query) as Statement<T>;
    } else {
      cachedStms = new Map();
      this.stmCache.set(db, cachedStms);
    }

    if (!statement) {
      statement = db.prepare<T>(query);
      cachedStms.set(query, statement);
    }

    return statement;
  }
}
