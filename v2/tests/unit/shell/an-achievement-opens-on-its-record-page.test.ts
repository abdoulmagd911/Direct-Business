/**
 * GC-4, V377: a notification, a search hit or a Recently deleted row naming an achievement opens its record page. Only the
 * achievement itself has an address; its references and participants stay plain text. Sabotage: tests/sabotage/screens.mjs
 * "achievement-record-has-no-address".
 */
import { describe, expect, it } from 'vitest';
import { entityRoute } from '../../../src/ui/entity-route';

describe('where an achievement opens', () => {
  it('on its record page', () => {
    expect(entityRoute('achievement', 'a1'), 'an achievement opens on its record page').toBe('/kpis/achievements/a1');
  });
  it('and nothing else of it has an address, nor does a missing id', () => {
    expect(entityRoute('achievement_ref', 'a1')).toBeNull();
    expect(entityRoute('achievement_participant', 'a1')).toBeNull();
    expect(entityRoute('achievement', null)).toBeNull();
  });
});
