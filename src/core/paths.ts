/**
 * XDG Base Directory Specification compliant path resolution
 * Provides consistent paths across Linux, macOS, and Windows
 */

import { homedir } from 'os';
import { join } from 'path';

/**
 * Paths manager following XDG Base Directory spec
 * https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
 */
export class Paths {
  private static instance: Paths;

  private constructor() {}

  static getInstance(): Paths {
    if (!Paths.instance) {
      Paths.instance = new Paths();
    }
    return Paths.instance;
  }

  get skillDir(): string {
    return process.env.NOTEBOOKLM_SKILL_DIR || join(homedir(), '.claude', 'skills', 'notebooklm');
  }

  get dataDir(): string {
    // Use skill directory for backward compatibility with Python version
    return join(this.skillDir, 'data');
  }

  get configDir(): string {
    return join(this.skillDir, 'config');
  }

  get cacheDir(): string {
    // Use skill directory for backward compatibility
    return join(this.skillDir, 'cache');
  }

  get browserStateDir(): string {
    return join(this.dataDir, 'browser_state');
  }

  get browserProfileDir(): string {
    return join(this.browserStateDir, 'browser_profile');
  }

  get stateFile(): string {
    return join(this.browserStateDir, 'state.json');
  }

  get authInfoFile(): string {
    return join(this.dataDir, 'auth_info.json');
  }

  get libraryFile(): string {
    return join(this.dataDir, 'library.json');
  }

  get cacheFile(): string {
    return join(this.cacheDir, 'response_cache.json');
  }

  get logsDir(): string {
    return join(this.dataDir, 'logs');
  }
}
