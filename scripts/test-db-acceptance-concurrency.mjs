import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npx';
const commandEnvironment = {
  ...process.env,
  SUPABASE_TELEMETRY_DISABLED: '1',
};

const files = {
  setup: 'supabase/verification/concurrency_setup.sql',
  first: 'supabase/verification/concurrency_accept_a.sql',
  second: 'supabase/verification/concurrency_accept_b.sql',
  verify: 'supabase/verification/concurrency_verify.sql',
};

function commandArguments(args) {
  return isWindows ? ['/d', '/s', '/c', 'npx', ...args] : args;
}

function runSync(args, label) {
  const result = spawnSync(command, commandArguments(args), {
    cwd: process.cwd(),
    env: commandEnvironment,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit ${result.status}\n${result.error ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }

  return result;
}

function runConcurrent(file) {
  return new Promise((resolve) => {
    const child = spawn(
      command,
      commandArguments(['supabase', 'db', 'query', '--local', '--file', file]),
      {
        cwd: process.cwd(),
        env: commandEnvironment,
      },
    );
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, stdout, stderr, file }));
  });
}

let failure;

try {
  runSync(['supabase', 'db', 'reset'], 'initial local reset');
  runSync(
    ['supabase', 'db', 'query', '--local', '--file', files.setup],
    'concurrency fixture setup',
  );

  const attempts = await Promise.all([
    runConcurrent(files.first),
    runConcurrent(files.second),
  ]);
  const successfulAttempts = attempts.filter(({ code }) => code === 0);
  const rejectedAttempts = attempts.filter(({ code }) => code !== 0);

  if (successfulAttempts.length !== 1 || rejectedAttempts.length !== 1) {
    throw new Error(
      `expected exactly one accepted and one rejected concurrent call; results=${JSON.stringify(
        attempts.map(({ code, file, stderr }) => ({ code, file, stderr })),
      )}`,
    );
  }

  runSync(
    ['supabase', 'db', 'query', '--local', '--file', files.verify],
    'post-concurrency invariant verification',
  );

  process.stdout.write(
    `Concurrent acceptance passed: winner=${successfulAttempts[0].file}; rejected=${rejectedAttempts[0].file}; matches=1; conversations=1; agreements=1; members=2; accepted=1; rejected=1.\n`,
  );
} catch (error) {
  failure = error;
} finally {
  const cleanup = spawnSync(
    command,
    commandArguments(['supabase', 'db', 'reset']),
    {
      cwd: process.cwd(),
      env: commandEnvironment,
      encoding: 'utf8',
    },
  );

  if (cleanup.status !== 0 && failure === undefined) {
    failure = new Error(
      `final local reset failed with exit ${cleanup.status}\n${cleanup.stdout}\n${cleanup.stderr}`,
    );
  }
}

if (failure !== undefined) {
  throw failure;
}
