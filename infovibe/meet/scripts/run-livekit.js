const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.join(__dirname, '..');

function loadEnvFile(filePath, override = false) {
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (override || !(key in process.env)) process.env[key] = value;
    }
  } catch {}
}

function readNumber(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readBooleanString(name, fallback) {
  const value = String(process.env[name] ?? fallback).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value) ? 'true' : 'false';
}

function yamlQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function resolveLivekitBinary() {
  const configuredBinary = String(process.env.LIVEKIT_SERVER_BIN || '').trim();
  if (configuredBinary) return configuredBinary;
  const bundledBinary = path.join(rootDir, 'tools', 'livekit', process.platform === 'win32' ? 'livekit-server.exe' : 'livekit-server');
  return fs.existsSync(bundledBinary) ? bundledBinary : 'livekit-server';
}

loadEnvFile(path.join(rootDir, '.env.example'));
loadEnvFile(path.join(rootDir, '.env'), true);

const signalPort = readNumber('LIVEKIT_SIGNAL_PORT', 7880);
const internalSignalPort = readNumber('LIVEKIT_INTERNAL_SIGNAL_PORT', signalPort);
const rtcTcpPort = readNumber('LIVEKIT_RTC_TCP_PORT', 7881);
const rtcPortRangeStart = readNumber('LIVEKIT_RTC_PORT_RANGE_START', 50000);
const rtcPortRangeEnd = readNumber('LIVEKIT_RTC_PORT_RANGE_END', 50050);
const apiKey = String(process.env.LIVEKIT_API_KEY || 'infovibex_meet_local').trim() || 'infovibex_meet_local';
const apiSecret = String(process.env.LIVEKIT_API_SECRET || 'infovibex_meet_local_secret_2026_04_01').trim() || 'infovibex_meet_local_secret_2026_04_01';
const redisAddress = String(process.env.LIVEKIT_REDIS_ADDRESS || '').trim();
const livekitBinary = resolveLivekitBinary();

const configLines = [
  `port: ${internalSignalPort}`,
  'log_level: info',
  'rtc:',
  `  tcp_port: ${rtcTcpPort}`,
  `  port_range_start: ${rtcPortRangeStart}`,
  `  port_range_end: ${rtcPortRangeEnd}`,
  `  use_external_ip: ${readBooleanString('LIVEKIT_RTC_USE_EXTERNAL_IP', false)}`
];

if (redisAddress) {
  configLines.push('redis:');
  configLines.push(`  address: ${yamlQuote(redisAddress)}`);
}

configLines.push('keys:');
configLines.push(`  ${yamlQuote(apiKey)}: ${yamlQuote(apiSecret)}`);

const child = spawn(livekitBinary, [], {
  cwd: rootDir,
  env: {
    ...process.env,
    LIVEKIT_CONFIG: configLines.join('\n')
  },
  shell: process.platform === 'win32',
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error(`Could not start ${livekitBinary}: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
