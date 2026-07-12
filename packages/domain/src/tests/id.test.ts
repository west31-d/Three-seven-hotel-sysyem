import { describe, expect, it } from 'vitest';
import { newId } from '../id';

describe('newId', () => {
  it('returns a Postgres-compatible UUID even when a prefix is supplied', () => {
    expect(newId('his')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
