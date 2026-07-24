import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveDatabaseConfig } from './database-config.js';

describe('resolveDatabaseConfig', () => {
  it('desliga quando DATABASE_PERSISTENCE_ENABLED=false', () => {
    const config = resolveDatabaseConfig({ DATABASE_PERSISTENCE_ENABLED: 'false' });
    assert.equal(config.enabled, false);
  });

  it('escolhe Postgres quando DATABASE_URL é postgresql', () => {
    const config = resolveDatabaseConfig({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/ecnh'
    });
    assert.equal(config.enabled, true);
    assert.equal(config.dialect, 'postgres');
    assert.equal(config.databaseUrl, 'postgresql://user:pass@localhost:5432/ecnh');
  });

  it('usa SQLite padrão quando não há URL Postgres', () => {
    const config = resolveDatabaseConfig({});
    assert.equal(config.enabled, true);
    assert.equal(config.dialect, 'sqlite');
    assert.equal(config.sqlitePath, '.data/ecnh.sqlite');
  });

  it('respeita DATABASE_SQLITE_PATH', () => {
    const config = resolveDatabaseConfig({ DATABASE_SQLITE_PATH: '/tmp/teste.sqlite' });
    assert.equal(config.sqlitePath, '/tmp/teste.sqlite');
  });
});
