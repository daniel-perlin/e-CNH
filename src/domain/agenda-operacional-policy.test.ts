import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AgendaOperacionalPolicy,
  agendaOperacionalPolicy
} from './agenda-operacional-policy.js';

describe('AgendaOperacionalPolicy', () => {
  // 20/07/2026 15:00 UTC = 12:00 America/Sao_Paulo
  const hoje = new Date('2026-07-20T15:00:00.000Z');
  const policy = new AgendaOperacionalPolicy();

  describe('classificarDataRelativaAHoje', () => {
    it('classifica passado, hoje e futuro', () => {
      assert.equal(policy.classificarDataRelativaAHoje('19/07/2026', hoje), 'passado');
      assert.equal(policy.classificarDataRelativaAHoje('20/07/2026', hoje), 'hoje');
      assert.equal(policy.classificarDataRelativaAHoje('21/07/2026', hoje), 'futuro');
    });

    it('marca data inválida', () => {
      assert.equal(policy.classificarDataRelativaAHoje('31/02/2026', hoje), 'invalida');
      assert.equal(policy.classificarDataRelativaAHoje('', hoje), 'invalida');
    });
  });

  describe('devePermanecerNaAgendaOperacional (contrato: hoje ou futuro)', () => {
    it('somente pacientes de hoje → permanecem', () => {
      assert.equal(policy.devePermanecerNaAgendaOperacional('20/07/2026', hoje), true);
    });

    it('somente pacientes futuros → permanecem', () => {
      assert.equal(policy.devePermanecerNaAgendaOperacional('21/07/2026', hoje), true);
      assert.equal(policy.devePermanecerNaAgendaOperacional('30/07/2026', hoje), true);
    });

    it('hoje + futuros → ambos permanecem; passado não', () => {
      assert.equal(policy.devePermanecerNaAgendaOperacional('19/07/2026', hoje), false);
      assert.equal(policy.devePermanecerNaAgendaOperacional('20/07/2026', hoje), true);
      assert.equal(policy.devePermanecerNaAgendaOperacional('21/07/2026', hoje), true);
    });

    it('nenhum paciente / data inválida → não permanece', () => {
      assert.equal(policy.devePermanecerNaAgendaOperacional('', hoje), false);
      assert.equal(policy.devePermanecerNaAgendaOperacional('2026-07-20', hoje), false);
    });
  });

  describe('aliases de negócio', () => {
    it('inclusão do portal e paciente ativo seguem a mesma regra operacional', () => {
      assert.equal(
        policy.deveIncluirAgendamentoDoPortalNaAgendaOperacional('20/07/2026', hoje),
        true
      );
      assert.equal(
        policy.pacientePermaneceAtivoNaAgendaOperacional('20/07/2026', hoje),
        true
      );
      assert.equal(
        policy.deveIncluirAgendamentoDoPortalNaAgendaOperacional('19/07/2026', hoje),
        false
      );
      assert.equal(
        policy.pacientePermaneceAtivoNaAgendaOperacional('19/07/2026', hoje),
        false
      );
    });

    it('instância padrão exportada usa a mesma política', () => {
      assert.equal(
        agendaOperacionalPolicy.devePermanecerNaAgendaOperacional('20/07/2026', hoje),
        true
      );
    });
  });

  describe('mudança de comportamento da policy (contrato documentado)', () => {
    it('hoje NÃO é tratado como passado (regressão da regra só-futuro)', () => {
      // Se a policy voltar a excluir “hoje”, este teste falha de propósito.
      assert.notEqual(policy.classificarDataRelativaAHoje('20/07/2026', hoje), 'passado');
      assert.equal(policy.classificarDataRelativaAHoje('20/07/2026', hoje), 'hoje');
      assert.equal(policy.devePermanecerNaAgendaOperacional('20/07/2026', hoje), true);
    });
  });
});
