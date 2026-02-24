import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG = path.resolve('docs/reference/dev/browser-regression-gates.json');

function fail(message) {
  console.error(`Browser regression gate failed: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      fail(`unexpected argument '${token}'`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (!key) {
      fail('empty argument key');
    }

    if (!value || value.startsWith('--')) {
      fail(`missing value for '--${key}'`);
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function normalizeValue(value) {
  return String(value).trim().toLowerCase();
}

function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('config must be a JSON object');
  }

  if (!Array.isArray(config.allowedMatrix) || config.allowedMatrix.length === 0) {
    throw new Error("config.allowedMatrix must be a non-empty array");
  }

  for (let index = 0; index < config.allowedMatrix.length; index += 1) {
    const entry = config.allowedMatrix[index];

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`allowedMatrix[${index}] must be an object`);
    }

    if (typeof entry.browser !== 'string' || entry.browser.trim() === '') {
      throw new Error(`allowedMatrix[${index}].browser must be a non-empty string`);
    }

    if (typeof entry.channel !== 'string' || entry.channel.trim() === '') {
      throw new Error(`allowedMatrix[${index}].channel must be a non-empty string`);
    }
  }
}

function readConfig(configPath) {
  const resolvedPath = path.resolve(configPath);
  let raw;

  try {
    raw = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    throw new Error(`unable to read config at '${resolvedPath}': ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid JSON in '${resolvedPath}': ${error.message}`);
  }

  validateConfig(parsed);
  return { config: parsed, resolvedPath };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const browser = normalizeValue(args.browser ?? '');
  const channel = normalizeValue(args.channel ?? '');
  const configPath = args.config ?? DEFAULT_CONFIG;

  if (!browser) {
    fail("missing required argument '--browser'");
  }

  if (!channel) {
    fail("missing required argument '--channel'");
  }

  let loaded;
  try {
    loaded = readConfig(configPath);
  } catch (error) {
    fail(error.message);
  }

  const matches = loaded.config.allowedMatrix.some((entry) => {
    return normalizeValue(entry.browser) === browser && normalizeValue(entry.channel) === channel;
  });

  if (!matches) {
    const allowedPairs = loaded.config.allowedMatrix
      .map((entry) => `${normalizeValue(entry.browser)}/${normalizeValue(entry.channel)}`)
      .join(', ');

    fail(
      `unsupported browser/channel '${browser}/${channel}'. Allowed combinations: ${allowedPairs}. Config: ${loaded.resolvedPath}`,
    );
  }

  console.log(
    `Browser regression gate passed: '${browser}/${channel}' is allowed by ${loaded.resolvedPath}`,
  );
}

main();
