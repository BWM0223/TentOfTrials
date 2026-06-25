/**
 * Diagnostic metadata comparison utilities.
 *
 * Parses `diagnostic/build-*.json` files and compares two builds to
 * surface added, removed, changed, failed, and recovered modules.
 *
 * ## Usage
 *
 * ```ts
 * const baseline  = parseDiagnosticMetadata(baselineJson);
 * const candidate = parseDiagnosticMetadata(candidateJson);
 * const diff      = compareDiagnosticMetadata(baseline, candidate);
 * console.log(diff.recovered);  // modules that were failing, now pass
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModuleStatus = 'pass' | 'fail' | 'skip' | 'unknown';

export interface ModuleEntry {
  name: string;
  status: ModuleStatus;
  artifactCount: number;
  artifactPaths: string[];
}

export interface DiagnosticMetadata {
  buildId: string;
  commitSha?: string;
  timestamp?: string;
  modules: Record<string, ModuleEntry>;
}

export interface DiagnosticDiff {
  /** Modules present in candidate but not in baseline. */
  added: ModuleEntry[];
  /** Modules present in baseline but not in candidate. */
  removed: ModuleEntry[];
  /** Modules present in both with status or artifact changes. */
  changed: Array<{ baseline: ModuleEntry; candidate: ModuleEntry }>;
  /** Modules that were failing in baseline and now pass in candidate. */
  recovered: ModuleEntry[];
  /** Modules that were passing in baseline and now fail in candidate. */
  newlyFailed: ModuleEntry[];
  /** Modules identical in both builds. */
  unchanged: ModuleEntry[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parses a raw `build-*.json` object into a typed DiagnosticMetadata.
 * Does not read the `.logd` artifact to avoid exposing encrypted content.
 */
export function parseDiagnosticMetadata(raw: unknown): DiagnosticMetadata {
  if (typeof raw !== 'object' || raw === null) {
    throw new TypeError('diagnostic metadata must be a non-null object');
  }

  const obj = raw as Record<string, unknown>;
  const buildId = typeof obj['build_id'] === 'string' ? obj['build_id'] : 'unknown';
  const commitSha = typeof obj['commit_sha'] === 'string' ? obj['commit_sha'] : undefined;
  const timestamp = typeof obj['timestamp'] === 'string' ? obj['timestamp'] : undefined;

  const rawModules = (obj['modules'] ?? {}) as Record<string, unknown>;
  const modules: Record<string, ModuleEntry> = {};

  for (const [name, entry] of Object.entries(rawModules)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const status = normalizeStatus(e['status']);
    const artifactPaths = Array.isArray(e['artifact_paths'])
      ? (e['artifact_paths'] as string[]).filter((p) => typeof p === 'string')
      : [];
    modules[name] = {
      name,
      status,
      artifactCount: artifactPaths.length,
      artifactPaths,
    };
  }

  return { buildId, commitSha, timestamp, modules };
}

function normalizeStatus(raw: unknown): ModuleStatus {
  if (raw === 'pass' || raw === 'fail' || raw === 'skip') return raw;
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Comparator
// ---------------------------------------------------------------------------

/**
 * Compares two parsed diagnostic metadata snapshots.
 * Produces a deterministic diff with no dependency on insertion order.
 */
export function compareDiagnosticMetadata(
  baseline: DiagnosticMetadata,
  candidate: DiagnosticMetadata,
): DiagnosticDiff {
  const diff: DiagnosticDiff = {
    added: [],
    removed: [],
    changed: [],
    recovered: [],
    newlyFailed: [],
    unchanged: [],
  };

  const allNames = new Set([
    ...Object.keys(baseline.modules),
    ...Object.keys(candidate.modules),
  ]);

  for (const name of [...allNames].sort()) {
    const b = baseline.modules[name];
    const c = candidate.modules[name];

    if (!b) {
      diff.added.push(c);
    } else if (!c) {
      diff.removed.push(b);
    } else if (isIdentical(b, c)) {
      diff.unchanged.push(c);
    } else {
      diff.changed.push({ baseline: b, candidate: c });
      if (b.status === 'fail' && c.status === 'pass') diff.recovered.push(c);
      if (b.status === 'pass' && c.status === 'fail') diff.newlyFailed.push(c);
    }
  }

  return diff;
}

function isIdentical(a: ModuleEntry, b: ModuleEntry): boolean {
  return (
    a.status === b.status &&
    a.artifactCount === b.artifactCount &&
    a.artifactPaths.slice().sort().join('|') ===
      b.artifactPaths.slice().sort().join('|')
  );
}
