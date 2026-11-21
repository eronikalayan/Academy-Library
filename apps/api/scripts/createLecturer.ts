import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { RegisterInputSchema } from '@academy-library/contracts';
import { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import { normalizeEmail } from '../src/modules/auth/normalizeEmail.js';

type Ask = (label: string, hidden?: boolean) => Promise<string>;
interface Database {
  user: { create(args: Prisma.UserCreateArgs): Promise<unknown> };
  $disconnect(): Promise<void>;
}

const { displayName: displayNameSchema, email: emailSchema } = RegisterInputSchema.shape;

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 16 &&
    password.length <= 128 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[\p{P}\p{S}]/u.test(password)
  );
}

export async function createLecturer(
  ask: Ask,
  report: (message: string) => void,
  connect: (databaseUrl: string) => Database,
): Promise<number> {
  let database: Database | undefined;
  let exitCode = 1;
  try {
    const displayName = displayNameSchema.safeParse(await ask('Lecturer full name: '));
    if (!displayName.success) {
      report('Enter a full name between 1 and 160 characters.');
      return 1;
    }

    const email = emailSchema.safeParse(normalizeEmail(await ask('Lecturer email: ')));
    if (!email.success) {
      report('Enter a valid email address of up to 255 characters.');
      return 1;
    }

    const password = await ask('Password: ', true);
    if (!isStrongPassword(password)) {
      report(
        'Use 16–128 characters with uppercase and lowercase Latin letters, a digit, and a special character.',
      );
      return 1;
    }
    if ((await ask('Confirm password: ', true)) !== password) {
      report('Passwords do not match.');
      return 1;
    }

    const databaseUrl = (await ask('Production Neon connection URL: ', true)).trim();
    if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
      report('Enter a PostgreSQL connection URL.');
      return 1;
    }
    if ((await ask('Type PRODUCTION to create the lecturer account: ')) !== 'PRODUCTION') {
      report('Cancelled.');
      return 1;
    }

    const passwordHash = await hashPassword(password);
    database = connect(databaseUrl);
    await database.user.create({
      data: {
        displayName: displayName.data,
        email: email.data,
        passwordHash,
        role: 'LECTURER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    report('Lecturer account created.');
    exitCode = 0;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      report('An account with this email already exists.');
    } else {
      report('Could not confirm lecturer creation.');
    }
  } finally {
    if (database) {
      try {
        await database.$disconnect();
      } catch {
        report('Could not close the database connection.');
        exitCode = 1;
      }
    }
  }
  return exitCode;
}

async function main(): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Run this command in an interactive terminal.');
    return 1;
  }

  return createLecturer(
    askInTerminal,
    (message) => process.stdout.write(`${message}\n`),
    (databaseUrl) => new PrismaClient({ datasourceUrl: databaseUrl, log: [] }),
  );
}

async function askInTerminal(label: string, hidden = false): Promise<string> {
  const muted = hidden
    ? new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      })
    : undefined;
  // Give each prompt its own line buffer and editing state.
  const terminal = createInterface({
    input: process.stdin,
    output: muted ?? process.stdout,
    terminal: true,
    historySize: 0,
  });
  const abort = new AbortController();
  terminal.once('close', () => abort.abort());
  terminal.on('SIGINT', () => terminal.close());

  try {
    if (hidden) process.stdout.write(label);
    return await terminal.question(hidden ? '' : label, { signal: abort.signal });
  } finally {
    terminal.close();
    muted?.destroy();
    if (hidden) process.stdout.write('\n');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      console.error('Could not complete lecturer creation.');
      process.exitCode = 1;
    },
  );
}
