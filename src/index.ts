/**
 * Entrypoint de produção.
 *
 * Railway/Nixpacks frequentemente executam `node dist/index.js` (Start Command
 * detectado ou sobrescrito no painel). Este módulo delega ao mesmo fluxo one-shot
 * validado na E2E (`sync-agenda`), sem alterar regras de negócio.
 *
 * Equivalente: `npm start` / `node dist/scripts/sync-agenda.js` (ADR-020).
 */
import './scripts/sync-agenda.js';
