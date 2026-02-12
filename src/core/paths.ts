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
    const xdgDataHome = process.env.XDG_DATA_HOME;
    if (xdgDataHome) {
      return join(xdgDataHome, 'notebooklm');
    }
    return join(homedir(), '.local', 'share', 'notebooklm');
  }

  get configDir(): string {
    const xdgConfigHome = process.env.XDG_CONFIG_HOME;
    if (xdgConfigHome) {
      return join(xdgConfigHome, 'notebooklm');
    }
    return join(homedir(), '.config', 'notebooklm');
  }

  get cacheDir(): string {
    const xdgCacheHome = process.env.XDG_CACHE_HOME;
    if (xdgCacheHome) {
      return join(xdgCacheHome, 'notebooklm');
    }
    return join(homedir(), '.cache', 'notebooklm');
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
