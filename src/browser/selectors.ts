/**
 * DOM selector constants for NotebookLM interface
 * Centralized selectors for query input, responses, and UI elements
 */

/**
 * CSS selectors for query input field
 * Multiple selectors for fallback support across different languages/versions
 */
export const QUERY_INPUT_SELECTORS = [
  'textarea.query-box-input', // Primary selector
  'textarea[aria-label="Feld für Anfragen"]', // German fallback
  'textarea[aria-label="Input for queries"]', // English fallback
  'textarea[placeholder*="Ask"]', // Generic fallback
] as const;

/**
 * CSS selectors for response messages
 * Multiple selectors to handle different response container structures
 */
export const RESPONSE_SELECTORS = [
  '.to-user-container .message-text-content', // Primary selector
  '[data-message-author="bot"]', // Bot message attribute
  '[data-message-author="assistant"]', // Assistant message attribute
  '.message-text-content', // Generic message content
] as const;

/**
 * CSS selector for thinking/processing indicator
 * Shows when NotebookLM is generating a response
 */
export const THINKING_SELECTOR = 'div.thinking-message' as const;

/**
 * CSS selector for the main chat container
 * Used for scrolling and visibility checks
 */
export const CHAT_CONTAINER_SELECTOR = '.chat-container' as const;

/**
 * CSS selector for send button
 * Used to submit queries
 */
export const SEND_BUTTON_SELECTORS = [
  'button[aria-label*="Send"]', // Primary
  'button[aria-label*="send"]', // Case-insensitive fallback
  'button.send-button', // Class-based fallback
] as const;

/**
 * CSS selector for authentication/login elements
 * Used to detect if user is logged in
 */
export const LOGIN_BUTTON_SELECTORS = [
  'button[aria-label*="Sign in"]',
  'button[aria-label*="Log in"]',
  'a[href*="accounts.google.com"]',
] as const;

/**
 * CSS selector for notebook title/header
 * Used to verify correct notebook is loaded
 */
export const NOTEBOOK_TITLE_SELECTOR = '.notebook-title' as const;

/**
 * CSS selector for error messages
 * Used to detect and handle errors
 */
export const ERROR_MESSAGE_SELECTORS = [
  '.error-message',
  '[role="alert"]',
  '.notification.error',
] as const;

/**
 * CSS selector for loading indicators
 * Used to detect when page is loading
 */
export const LOADING_INDICATOR_SELECTORS = [
  '.loading-spinner',
  '[aria-busy="true"]',
  '.progress-bar',
] as const;
