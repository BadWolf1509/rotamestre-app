#!/usr/bin/env node
/**
 * PreToolUse hook: blocks edits to sensitive files.
 *
 * Triggered on Edit | Write | MultiEdit | NotebookEdit. Reads the tool input
 * JSON from stdin, extracts the target path, and exits with code 2 if the
 * path matches a sensitive pattern. Exit code 2 with a stderr message
 * surfaces the reason in Claude's transcript.
 *
 * Cross-platform: uses only Node stdlib, no shell.
 */

'use strict';

const SENSITIVE_PATTERNS = [
  // Environment / secrets
  /(^|[\\/])\.env(\..+)?$/i,
  // Android signing
  /\.keystore$/i,
  /\.jks$/i,
  // Google / Firebase service files
  /google-services\.json$/i,
  /GoogleService-Info\.plist$/i,
  // EAS / Play Store
  /(^|[\\/])eas\.json$/i,
  /play-store-credentials\.json$/i,
  // Generic credential files
  /service-account.*\.json$/i,
  // SSH keys
  /id_rsa(\.pub)?$/i,
  /id_ed25519(\.pub)?$/i,
];

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
    // Safety: if no stdin arrives within 5s, give up gracefully (allow).
    setTimeout(() => resolve(''), 5000).unref();
  });
}

(async () => {
  let input;
  try {
    const raw = await readStdin();
    if (!raw.trim()) {
      // No input — let the action proceed.
      process.exit(0);
    }
    input = JSON.parse(raw);
  } catch (err) {
    // Malformed input — fail open (allow), but emit a debug line on stderr.
    console.error(`[block-sensitive-files] could not parse stdin: ${err.message}`);
    process.exit(0);
  }

  const inputs = input.tool_input || {};
  const candidates = [
    inputs.file_path,
    inputs.notebook_path,
    inputs.path,
    // MultiEdit passes file_path at the top level too.
  ].filter(Boolean);

  for (const candidate of candidates) {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(candidate)) {
        console.error(
          `BLOCKED by .claude/hooks/block-sensitive-files.js:\n  Path: ${candidate}\n  Reason: matches sensitive-file pattern ${pattern}.\n  If this is intentional, edit the file manually outside the assistant.`
        );
        // Exit code 2 = block the tool call with the stderr message.
        process.exit(2);
      }
    }
  }

  process.exit(0);
})();
