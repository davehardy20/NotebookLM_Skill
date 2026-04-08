/**
 * Constants and mappings for NotebookLM API
 * Based on nlm CLI source code (reverse-engineered from notebooklm-mcp-cli)
 */

/**
 * Bidirectional mapping for API codes
 * Handles validation and human-readable lookups
 */
export class CodeMapper<T extends Record<string, number>> {
  private nameToCode: Map<string, number>;
  private codeToName: Map<number, string>;

  constructor(private mapping: T) {
    this.nameToCode = new Map();
    this.codeToName = new Map();

    for (const [name, code] of Object.entries(mapping)) {
      const lowerName = name.toLowerCase();
      this.nameToCode.set(lowerName, code);
      this.codeToName.set(code, name);
    }
  }

  getCode(name: string): number {
    if (!name) {
      throw new Error(`Invalid name: '${name}'. Must be one of: ${this.optionsStr}`);
    }
    const code = this.nameToCode.get(name.toLowerCase());
    if (code === undefined) {
      throw new Error(`Unknown name '${name}'. Must be one of: ${this.optionsStr}`);
    }
    return code;
  }

  getName(code: number | null | undefined): string {
    if (code === null || code === undefined) {
      return 'unknown';
    }
    return this.codeToName.get(code) ?? 'unknown';
  }

  get optionsStr(): string {
    return this.names.join(', ');
  }

  get names(): string[] {
    return Object.keys(this.mapping);
  }

  get codes(): number[] {
    return Object.values(this.mapping);
  }
}

// ============================================================================
// Ownership Constants
// ============================================================================

export const OWNERSHIP_MINE = 1;
export const OWNERSHIP_SHARED = 2;

// ============================================================================
// Chat Configuration
// ============================================================================

export const CHAT_GOAL_DEFAULT = 1;
export const CHAT_GOAL_CUSTOM = 2;
export const CHAT_GOAL_LEARNING_GUIDE = 3;

export const ChatGoals = new CodeMapper({
  default: CHAT_GOAL_DEFAULT,
  custom: CHAT_GOAL_CUSTOM,
  learning_guide: CHAT_GOAL_LEARNING_GUIDE,
});

export const CHAT_RESPONSE_DEFAULT = 1;
export const CHAT_RESPONSE_LONGER = 4;
export const CHAT_RESPONSE_SHORTER = 5;

export const ChatResponseLengths = new CodeMapper({
  default: CHAT_RESPONSE_DEFAULT,
  longer: CHAT_RESPONSE_LONGER,
  shorter: CHAT_RESPONSE_SHORTER,
});

// ============================================================================
// Research / Source Discovery
// ============================================================================

export const RESEARCH_SOURCE_WEB = 1;
export const RESEARCH_SOURCE_DRIVE = 2;

export const ResearchSources = new CodeMapper({
  web: RESEARCH_SOURCE_WEB,
  drive: RESEARCH_SOURCE_DRIVE,
});

export const RESEARCH_MODE_FAST = 1;
export const RESEARCH_MODE_DEEP = 5;

export const ResearchModes = new CodeMapper({
  fast: RESEARCH_MODE_FAST,
  deep: RESEARCH_MODE_DEEP,
});

export const RESULT_TYPE_WEB = 1;
export const RESULT_TYPE_GOOGLE_DOC = 2;
export const RESULT_TYPE_GOOGLE_SLIDES = 3;
export const RESULT_TYPE_DEEP_REPORT = 5;
export const RESULT_TYPE_GOOGLE_SHEETS = 8;

export const ResultTypes = new CodeMapper({
  web: RESULT_TYPE_WEB,
  google_doc: RESULT_TYPE_GOOGLE_DOC,
  google_slides: RESULT_TYPE_GOOGLE_SLIDES,
  deep_report: RESULT_TYPE_DEEP_REPORT,
  google_sheets: RESULT_TYPE_GOOGLE_SHEETS,
});

// ============================================================================
// Source Types (Notebook Content)
// ============================================================================

export const SOURCE_TYPE_GOOGLE_DOCS = 1;
export const SOURCE_TYPE_GOOGLE_OTHER = 2;
export const SOURCE_TYPE_PDF = 3;
export const SOURCE_TYPE_PASTED_TEXT = 4;
export const SOURCE_TYPE_WEB_PAGE = 5;
export const SOURCE_TYPE_GENERATED_TEXT = 8;
export const SOURCE_TYPE_YOUTUBE = 9;
export const SOURCE_TYPE_UPLOADED_FILE = 11;
export const SOURCE_TYPE_IMAGE = 13;
export const SOURCE_TYPE_WORD_DOC = 14;

export const SourceTypes = new CodeMapper({
  google_docs: SOURCE_TYPE_GOOGLE_DOCS,
  google_slides_sheets: SOURCE_TYPE_GOOGLE_OTHER,
  pdf: SOURCE_TYPE_PDF,
  pasted_text: SOURCE_TYPE_PASTED_TEXT,
  web_page: SOURCE_TYPE_WEB_PAGE,
  generated_text: SOURCE_TYPE_GENERATED_TEXT,
  youtube: SOURCE_TYPE_YOUTUBE,
  uploaded_file: SOURCE_TYPE_UPLOADED_FILE,
  image: SOURCE_TYPE_IMAGE,
  word_doc: SOURCE_TYPE_WORD_DOC,
});

// ============================================================================
// Studio Types
// ============================================================================

export const STUDIO_TYPE_AUDIO = 1;
export const STUDIO_TYPE_REPORT = 2;
export const STUDIO_TYPE_VIDEO = 3;
export const STUDIO_TYPE_FLASHCARDS = 4; // Also Quiz
export const STUDIO_TYPE_INFOGRAPHIC = 7;
export const STUDIO_TYPE_SLIDE_DECK = 8;
export const STUDIO_TYPE_DATA_TABLE = 9;

export const StudioTypes = new CodeMapper({
  audio: STUDIO_TYPE_AUDIO,
  report: STUDIO_TYPE_REPORT,
  video: STUDIO_TYPE_VIDEO,
  flashcards: STUDIO_TYPE_FLASHCARDS,
  infographic: STUDIO_TYPE_INFOGRAPHIC,
  slide_deck: STUDIO_TYPE_SLIDE_DECK,
  data_table: STUDIO_TYPE_DATA_TABLE,
});

// Index in the artifact data array where custom prompt/options are stored
export const STUDIO_ARTIFACT_FOCUS_INDEX = 6;

// ============================================================================
// Audio Overview
// ============================================================================

export const AUDIO_FORMAT_DEEP_DIVE = 1;
export const AUDIO_FORMAT_BRIEF = 2;
export const AUDIO_FORMAT_CRITIQUE = 3;
export const AUDIO_FORMAT_DEBATE = 4;

export const AudioFormats = new CodeMapper({
  deep_dive: AUDIO_FORMAT_DEEP_DIVE,
  brief: AUDIO_FORMAT_BRIEF,
  critique: AUDIO_FORMAT_CRITIQUE,
  debate: AUDIO_FORMAT_DEBATE,
});

export const AUDIO_LENGTH_SHORT = 1;
export const AUDIO_LENGTH_DEFAULT = 2;
export const AUDIO_LENGTH_LONG = 3;

export const AudioLengths = new CodeMapper({
  short: AUDIO_LENGTH_SHORT,
  default: AUDIO_LENGTH_DEFAULT,
  long: AUDIO_LENGTH_LONG,
});

// ============================================================================
// Video Overview
// ============================================================================

export const VIDEO_FORMAT_EXPLAINER = 1;
export const VIDEO_FORMAT_BRIEF = 2;
export const VIDEO_FORMAT_CINEMATIC = 3;

export const VideoFormats = new CodeMapper({
  explainer: VIDEO_FORMAT_EXPLAINER,
  brief: VIDEO_FORMAT_BRIEF,
  cinematic: VIDEO_FORMAT_CINEMATIC,
});

export const VIDEO_STYLE_AUTO_SELECT = 1;
export const VIDEO_STYLE_CUSTOM = 2;
export const VIDEO_STYLE_CLASSIC = 3;
export const VIDEO_STYLE_WHITEBOARD = 4;
export const VIDEO_STYLE_KAWAII = 5;
export const VIDEO_STYLE_ANIME = 6;
export const VIDEO_STYLE_WATERCOLOR = 7;
export const VIDEO_STYLE_RETRO_PRINT = 8;
export const VIDEO_STYLE_HERITAGE = 9;
export const VIDEO_STYLE_PAPER_CRAFT = 10;

export const VideoStyles = new CodeMapper({
  auto_select: VIDEO_STYLE_AUTO_SELECT,
  custom: VIDEO_STYLE_CUSTOM,
  classic: VIDEO_STYLE_CLASSIC,
  whiteboard: VIDEO_STYLE_WHITEBOARD,
  kawaii: VIDEO_STYLE_KAWAII,
  anime: VIDEO_STYLE_ANIME,
  watercolor: VIDEO_STYLE_WATERCOLOR,
  retro_print: VIDEO_STYLE_RETRO_PRINT,
  heritage: VIDEO_STYLE_HERITAGE,
  paper_craft: VIDEO_STYLE_PAPER_CRAFT,
});

// ============================================================================
// Infographic
// ============================================================================

export const INFOGRAPHIC_ORIENTATION_LANDSCAPE = 1;
export const INFOGRAPHIC_ORIENTATION_PORTRAIT = 2;
export const INFOGRAPHIC_ORIENTATION_SQUARE = 3;

export const InfographicOrientations = new CodeMapper({
  landscape: INFOGRAPHIC_ORIENTATION_LANDSCAPE,
  portrait: INFOGRAPHIC_ORIENTATION_PORTRAIT,
  square: INFOGRAPHIC_ORIENTATION_SQUARE,
});

export const INFOGRAPHIC_DETAIL_CONCISE = 1;
export const INFOGRAPHIC_DETAIL_STANDARD = 2;
export const INFOGRAPHIC_DETAIL_DETAILED = 3;

export const InfographicDetails = new CodeMapper({
  concise: INFOGRAPHIC_DETAIL_CONCISE,
  standard: INFOGRAPHIC_DETAIL_STANDARD,
  detailed: INFOGRAPHIC_DETAIL_DETAILED,
});

export const INFOGRAPHIC_STYLE_AUTO_SELECT = 1;
export const INFOGRAPHIC_STYLE_SKETCH_NOTE = 2;
export const INFOGRAPHIC_STYLE_PROFESSIONAL = 3;
export const INFOGRAPHIC_STYLE_BENTO_GRID = 4;
export const INFOGRAPHIC_STYLE_EDITORIAL = 5;
export const INFOGRAPHIC_STYLE_INSTRUCTIONAL = 6;
export const INFOGRAPHIC_STYLE_BRICKS = 7;
export const INFOGRAPHIC_STYLE_CLAY = 8;
export const INFOGRAPHIC_STYLE_ANIME = 9;
export const INFOGRAPHIC_STYLE_KAWAII = 10;
export const INFOGRAPHIC_STYLE_SCIENTIFIC = 11;

export const InfographicStyles = new CodeMapper({
  auto_select: INFOGRAPHIC_STYLE_AUTO_SELECT,
  sketch_note: INFOGRAPHIC_STYLE_SKETCH_NOTE,
  professional: INFOGRAPHIC_STYLE_PROFESSIONAL,
  bento_grid: INFOGRAPHIC_STYLE_BENTO_GRID,
  editorial: INFOGRAPHIC_STYLE_EDITORIAL,
  instructional: INFOGRAPHIC_STYLE_INSTRUCTIONAL,
  bricks: INFOGRAPHIC_STYLE_BRICKS,
  clay: INFOGRAPHIC_STYLE_CLAY,
  anime: INFOGRAPHIC_STYLE_ANIME,
  kawaii: INFOGRAPHIC_STYLE_KAWAII,
  scientific: INFOGRAPHIC_STYLE_SCIENTIFIC,
});

// ============================================================================
// Slide Deck
// ============================================================================

export const SLIDE_DECK_FORMAT_DETAILED = 1;
export const SLIDE_DECK_FORMAT_PRESENTER = 2;

export const SlideDeckFormats = new CodeMapper({
  detailed_deck: SLIDE_DECK_FORMAT_DETAILED,
  presenter_slides: SLIDE_DECK_FORMAT_PRESENTER,
});

export const SLIDE_DECK_LENGTH_SHORT = 1;
export const SLIDE_DECK_LENGTH_DEFAULT = 3;

export const SlideDeckLengths = new CodeMapper({
  short: SLIDE_DECK_LENGTH_SHORT,
  default: SLIDE_DECK_LENGTH_DEFAULT,
});

// ============================================================================
// Flashcards / Quiz
// ============================================================================

export const FLASHCARD_DIFFICULTY_EASY = 1;
export const FLASHCARD_DIFFICULTY_MEDIUM = 2;
export const FLASHCARD_DIFFICULTY_HARD = 3;

export const FlashcardDifficulties = new CodeMapper({
  easy: FLASHCARD_DIFFICULTY_EASY,
  medium: FLASHCARD_DIFFICULTY_MEDIUM,
  hard: FLASHCARD_DIFFICULTY_HARD,
});

export const FLASHCARD_COUNT_DEFAULT = 2;

// ============================================================================
// Reports
// ============================================================================

export const REPORT_FORMAT_BRIEFING_DOC = 'Briefing Doc';
export const REPORT_FORMAT_STUDY_GUIDE = 'Study Guide';
export const REPORT_FORMAT_BLOG_POST = 'Blog Post';
export const REPORT_FORMAT_CUSTOM = 'Create Your Own';

// ============================================================================
// Sharing / Access Control
// ============================================================================

export const SHARE_ROLE_OWNER = 1;
export const SHARE_ROLE_EDITOR = 2;
export const SHARE_ROLE_VIEWER = 3;

export const ShareRoles = new CodeMapper({
  owner: SHARE_ROLE_OWNER,
  editor: SHARE_ROLE_EDITOR,
  viewer: SHARE_ROLE_VIEWER,
});

export const SHARE_ACCESS_RESTRICTED = 0;
export const SHARE_ACCESS_PUBLIC = 1;

export const ShareAccessLevels = new CodeMapper({
  restricted: SHARE_ACCESS_RESTRICTED,
  public: SHARE_ACCESS_PUBLIC,
});

// ============================================================================
// Export Types (Google Workspace)
// ============================================================================

export const EXPORT_TYPE_DOCS = 1;
export const EXPORT_TYPE_SHEETS = 2;

export const ExportTypes = new CodeMapper({
  docs: EXPORT_TYPE_DOCS,
  sheets: EXPORT_TYPE_SHEETS,
});

// ============================================================================
// RPC IDs - NotebookLM batchexecute API
// ============================================================================

export const RPC_IDS = {
  // Notebook operations
  LIST_NOTEBOOKS: 'wXbhsf',
  GET_NOTEBOOK: 'rLM1Ne',
  CREATE_NOTEBOOK: 'CCqFvf',
  RENAME_NOTEBOOK: 's0tc2d',
  DELETE_NOTEBOOK: 'WWINqb',

  // Source operations
  ADD_SOURCE: 'izAoDd', // Legacy - URL, text, Drive sources
  ADD_SOURCE_V2: 'ozz5Z', // New rollout - URL source addition
  ADD_SOURCE_FILE: 'o4cbdc', // Register file for resumable upload
  GET_SOURCE: 'hizoJc', // Get source details
  CHECK_FRESHNESS: 'yR9Yof', // Check if Drive source is stale
  SYNC_DRIVE: 'FLmJqe', // Sync Drive source with latest content
  DELETE_SOURCE: 'tGMBJ', // Delete a source from notebook
  RENAME_SOURCE: 'b7Wfje', // Rename a source

  // Misc
  GET_CONVERSATIONS: 'hPTbtc',
  DELETE_CHAT_HISTORY: 'J7Gthc',
  PREFERENCES: 'hT54vc',
  SETTINGS: 'ZwVcOc',
  GET_SUMMARY: 'VfAZjd', // Get notebook summary and suggested report topics
  GET_SOURCE_GUIDE: 'tr032e', // Get source guide (AI summary + keyword chips)

  // Research RPCs (source discovery)
  START_FAST_RESEARCH: 'Ljjv0c', // Start Fast Research (Web or Drive)
  START_DEEP_RESEARCH: 'QA9ei', // Start Deep Research (Web only)
  POLL_RESEARCH: 'e3bVqc', // Poll research results
  IMPORT_RESEARCH: 'LBwxtb', // Import research sources

  // Studio content RPCs
  CREATE_STUDIO: 'R7cb6c', // Create Audio or Video Overview
  POLL_STUDIO: 'gArtLc', // Poll for studio content status
  DELETE_STUDIO: 'V5N4be', // Delete Audio or Video Overview
  RENAME_ARTIFACT: 'rc3d8d', // Rename any studio artifact (Audio, Video, etc.)
  GET_INTERACTIVE_HTML: 'v9rmvd', // Fetch quiz/flashcard HTML content
  REVISE_SLIDE_DECK: 'KmcKPe', // Revise existing slide deck with per-slide instructions

  // Mind map RPCs
  GENERATE_MIND_MAP: 'yyryJe', // Generate mind map JSON from sources
  SAVE_MIND_MAP: 'CYK0Xb', // Save generated mind map to notebook
  LIST_MIND_MAPS: 'cFji9', // List existing mind maps
  DELETE_MIND_MAP: 'AH0mwd', // Delete a mind map

  // Notes RPCs (share RPC IDs with mind maps, differ by parameters)
  CREATE_NOTE: 'CYK0Xb', // Create note from content (same as SAVE_MIND_MAP)
  GET_NOTES: 'cFji9', // List notes and mind maps (same as LIST_MIND_MAPS)
  UPDATE_NOTE: 'cYAfTb', // Update note content/title
  DELETE_NOTE: 'AH0mwd', // Delete note permanently (same as DELETE_MIND_MAP)

  // Sharing RPCs
  SHARE_NOTEBOOK: 'QDyure', // Set sharing settings (visibility, collaborators)
  GET_SHARE_STATUS: 'JFMDGd', // Get current share status

  // Export RPCs
  EXPORT_ARTIFACT: 'Krh3pd', // Export to Google Docs/Sheets
} as const;

// ============================================================================
// API Configuration
// ============================================================================

export const NOTEBOOKLM_BASE_URL = 'https://notebooklm.google.com';
export const BATCHEXECUTE_URL = `${NOTEBOOKLM_BASE_URL}/_/LabsTailwindUi/data/batchexecute`;
export const UPLOAD_URL = `${NOTEBOOKLM_BASE_URL}/upload/_/`;

// Default build label fallback (from nlm source)
export const BL_FALLBACK = 'boq_labs-tailwind-frontend_20260108.06_p0';

// Query endpoint (different from batchexecute - streaming gRPC-style)
export const QUERY_ENDPOINT =
  '/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed';

// Required cookies for authentication
// Modern Google services require both standard and Secure variants
export const REQUIRED_COOKIES = [
  'SID',
  'HSID',
  'SSID',
  'APISID',
  'SAPISID',
  '__Secure-1PSID',
  '__Secure-3PSID',
];

// Timeout configuration (seconds)
export const DEFAULT_TIMEOUT = 30.0;
export const SOURCE_ADD_TIMEOUT = 120.0; // Extended timeout for source operations
export const QUERY_TIMEOUT = 120.0; // Query operations can take longer

// Retry configuration
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_BASE_DELAY = 1.0;
export const DEFAULT_MAX_DELAY = 60.0;

// ============================================================================
// Headers
// ============================================================================

// Headers required for page fetch (must look like a browser navigation)
export const PAGE_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  Priority: 'u=0, i',
};

// Default RPC request headers
export const RPC_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
  'X-Same-Domain': '1',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

// ============================================================================
// CSRF Token Extraction Patterns
// ============================================================================

export const CSRF_PATTERNS = [
  /"SNlM0e":"([^"]+)"/, // WIZ_global_data.SNlM0e (primary)
  /at=([^&"]+)/, // Direct at= value
  /"FdrFJe":"([^"]+)"/, // Alternative location
];

export const SESSION_ID_PATTERNS = [
  /"FdrFJe":"([^"]+)"/, // FdrFJe field
  /f\.sid=(\d+)/, // f.sid parameter
];

export const BUILD_LABEL_PATTERNS = [
  /"cfb2h":"([^"]+)"/, // cfb2h build label
];
