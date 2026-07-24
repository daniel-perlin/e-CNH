/**
 * Barrel do schema de persistência da aplicação.
 * Novas tabelas (profissionais, agendamentos, sync_runs) entram aqui.
 */
export { ORIGEM_PROJETO_ECNH, pessoasSqlite } from './pessoas.sqlite.js';
export { pessoasPostgres } from './pessoas.pg.js';
