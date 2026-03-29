#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';

const DEFAULT_API_URL = 'https://api-production-1b45.up.railway.app';

function demoDerivedAddress() {
  const hash = createHash('sha256').update('kroxy-demo-wallet').digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

function resolveConfigPath() {
  const explicit = process.env.OPENCLAW_CONFIG_PATH?.trim();
  if (explicit) return explicit;
  const stateDir = process.env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), '.openclaw');
  return path.join(stateDir, 'openclaw.json');
}

function ensureObject(parent, key) {
  const current = parent[key];
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    parent[key] = {};
  }
  return parent[key];
}

async function askYesNo(rl, question, defaultYes = true) {
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  const answer = (await rl.question(`${question}${suffix}`)).trim().toLowerCase();
  if (!answer) return defaultYes;
  if (['y', 'yes'].includes(answer)) return true;
  if (['n', 'no'].includes(answer)) return false;
  return defaultYes;
}

function parseJsonConfig(raw, configPath) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('top-level JSON value must be an object');
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Could not parse ${configPath} as strict JSON (${String(err)}).\n` +
      'Run: openclaw config set plugins.entries.kroxy.config.KROXY_API_URL ' +
      `"${DEFAULT_API_URL}"`
    );
  }
}

async function runSetup({ postinstall }) {
  const configPath = resolveConfigPath();
  const commandHint = 'node ~/.openclaw/extensions/kroxy/scripts/setup-openclaw.mjs';

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    if (postinstall) {
      console.log(`[kroxy] Skipping interactive setup (non-interactive terminal). Run ${commandHint}`);
    }
    return 0;
  }

  if (!fs.existsSync(configPath)) {
    console.log(`[kroxy] OpenClaw config not found at ${configPath}.`);
    console.log('[kroxy] Run OpenClaw once, then run this setup wizard again.');
    return 0;
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const cfg = parseJsonConfig(raw, configPath);
  const plugins = ensureObject(cfg, 'plugins');
  const entries = ensureObject(plugins, 'entries');
  const kroxy = ensureObject(entries, 'kroxy');
  const pluginConfig = ensureObject(kroxy, 'config');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const start = await askYesNo(rl, 'Configure Kroxy in OpenClaw now?', true);
    if (!start) return 0;

    if (await askYesNo(rl, `Set KROXY_API_URL to ${DEFAULT_API_URL}?`, !pluginConfig.KROXY_API_URL)) {
      pluginConfig.KROXY_API_URL = DEFAULT_API_URL;
    }

    const defaultDemo = pluginConfig.KROXY_DEMO_MODE !== '0';
    if (await askYesNo(rl, 'Enable demo mode by default (recommended for first run)?', defaultDemo)) {
      pluginConfig.KROXY_DEMO_MODE = '1';
    } else if (pluginConfig.KROXY_DEMO_MODE === '1') {
      delete pluginConfig.KROXY_DEMO_MODE;
    }

    if (pluginConfig.KROXY_DEMO_MODE === '1') {
      const shouldSetDemoWallet = await askYesNo(
        rl,
        'Auto-set a demo wallet address for KROXY_AGENT_WALLET?',
        !pluginConfig.KROXY_AGENT_WALLET
      );
      if (shouldSetDemoWallet) {
        pluginConfig.KROXY_AGENT_WALLET = pluginConfig.KROXY_AGENT_WALLET || demoDerivedAddress();
      }
    }

    const setApiKeyNow = await askYesNo(rl, 'Set KROXY_API_KEY now?', false);
    if (setApiKeyNow) {
      const key = (await rl.question('Paste KROXY_API_KEY: ')).trim();
      if (key) pluginConfig.KROXY_API_KEY = key;
    }

    const save = await askYesNo(rl, `Save changes to ${configPath}?`, true);
    if (!save) {
      console.log('[kroxy] Setup canceled; no changes saved.');
      return 0;
    }

    fs.writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
    console.log('[kroxy] Saved OpenClaw config for plugin "kroxy".');
    console.log('[kroxy] Restart the gateway to load the new config.');
    return 0;
  } finally {
    rl.close();
  }
}

const postinstall = process.argv.includes('--postinstall');
runSetup({ postinstall }).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`[kroxy] Setup wizard failed: ${String(err)}`);
    process.exitCode = 1;
  }
);
