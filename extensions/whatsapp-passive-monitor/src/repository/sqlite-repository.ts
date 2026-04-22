import fs from "node:fs";
import path from "node:path";
import type { SQLInputValue } from "node:sqlite";

// Accepted SQL parameter types (matches node:sqlite SQLInputValue)
export type SqlParam = SQLInputValue;

// Result shape from run() — mirrors node:sqlite StatementResultingChanges
export type StatementResult = { lastInsertRowid: number | bigint; changes: number | bigint };

// Generic prepared statement — consumers cast .all() results to their types
export type PreparedStatement = {
  run: (...params: SqlParam[]) => StatementResult;
  all: (...params: SqlParam[]) => unknown[];
};

export type SqliteRepository = {
  exec: (sql: string) => void;
  prepare: (sql: string) => PreparedStatement;
  close: () => void;
};

/**
 * Generic SQLite wrapper over node:sqlite (Node 22+ built-in).
 * Manages DB lifecycle. Knows nothing about table schemas or domain types.
 */
export class SqliteRepositoryImpl implements SqliteRepository {
  private readonly db: InstanceType<typeof import("node:sqlite").DatabaseSync>;

  constructor(dbPath: string) {
    // Ensure parent directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Dynamic import of node:sqlite via createRequire (same pattern as core)
    const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
    this.db = new DatabaseSync(dbPath);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: SqlParam[]) => {
        return stmt.run(...params);
      },
      all: (...params: SqlParam[]) => stmt.all(...params) as unknown[],
    };
  }

  close(): void {
    this.db.close();
  }
}
