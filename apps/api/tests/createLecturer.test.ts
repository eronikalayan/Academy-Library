import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createLecturer } from '../scripts/createLecturer.js';
import { verifyPassword } from '../src/lib/password.js';

const password = 'Long-test-password-9';
const databaseUrl = 'postgresql://test:fake-secret@example.invalid/library';
const validAnswers = [
  '  Ada Lovelace  ',
  ' Ada@EXAMPLE.COM ',
  password,
  password,
  databaseUrl,
  'PRODUCTION',
];

function setup(answers = validAnswers) {
  const pending = [...answers];
  const ask = vi.fn((_label: string, _hidden?: boolean) => {
    const answer = pending.shift();
    if (answer === undefined) return Promise.reject(new Error('Input closed'));
    return Promise.resolve(answer);
  });
  const create = vi.fn((_args: Prisma.UserCreateArgs) => Promise.resolve({ id: 'lecturer-id' }));
  const disconnect = vi.fn(() => Promise.resolve());
  const connect = vi.fn(() => ({ user: { create }, $disconnect: disconnect }));
  const report = vi.fn();
  return {
    ask,
    create,
    disconnect,
    connect,
    report,
    run: () => createLecturer(ask, report, connect),
  };
}

describe('lecturer CLI', () => {
  it.each([
    [0, '   '],
    [0, 'a'.repeat(161)],
    [1, 'invalid-email'],
    [2, 'Ab1!'.padEnd(15, 'x')],
    [2, 'Ab1!'.padEnd(129, 'x')],
    [2, password.toLowerCase()],
    [2, password.toUpperCase()],
    [2, password.replace('9', 'x')],
    [2, 'Long test password 9'],
    [3, 'different'],
    [4, ''],
    [5, 'production'],
  ] as const)(
    'rejects invalid input at answer %s (%s) without connecting',
    async (index, answer) => {
      const answers = [...validAnswers];
      answers[index] = answer;
      const { run, connect } = setup(answers);
      expect(await run()).toBe(1);
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it('creates one normalized, active lecturer with an Argon2id hash after confirmation', async () => {
    const { run, ask, connect, create, disconnect, report } = setup();
    expect(await run()).toBe(0);
    expect(ask).toHaveBeenNthCalledWith(3, 'Password: ', true);
    expect(ask).toHaveBeenNthCalledWith(4, 'Confirm password: ', true);
    expect(ask).toHaveBeenNthCalledWith(5, 'Production Neon connection URL: ', true);
    expect(ask.mock.invocationCallOrder[5]).toBeLessThan(connect.mock.invocationCallOrder[0]!);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(databaseUrl);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        passwordHash: create.mock.calls[0]![0].data.passwordHash,
        role: 'LECTURER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    const hash = create.mock.calls[0]![0].data.passwordHash;
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(report.mock.calls).toEqual([['Lecturer account created.']]);
  });

  it('reports a duplicate without retrying or exposing the database error', async () => {
    const { run, create, disconnect, report } = setup();
    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(databaseUrl, {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    expect(await run()).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(report.mock.calls).toEqual([['An account with this email already exists.']]);
  });

  it('disconnects and redacts unexpected database failures', async () => {
    const { run, create, disconnect, report } = setup();
    create.mockRejectedValueOnce(new Error(databaseUrl));
    expect(await run()).toBe(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(report.mock.calls).toEqual([['Could not confirm lecturer creation.']]);
  });

  it('reports a disconnect failure without obscuring the successful insert', async () => {
    const { run, disconnect, report } = setup();
    disconnect.mockRejectedValueOnce(new Error(databaseUrl));
    expect(await run()).toBe(1);
    expect(report.mock.calls).toEqual([
      ['Lecturer account created.'],
      ['Could not close the database connection.'],
    ]);
  });

  it('stops without connecting when input closes', async () => {
    const { run, connect } = setup(validAnswers.slice(0, -1));
    expect(await run()).toBe(1);
    expect(connect).not.toHaveBeenCalled();
  });
});
