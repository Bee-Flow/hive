/**
 * E2E Testing — Shared constants
 */

export const AI_PROVIDERS = [
  { id: 'claude', name: 'Claude', icon: '🧠' },
  { id: 'minimax', name: 'MiniMax', icon: '🚀' },
];

export const PRESET_SCENARIOS = [
  { icon: '🔐', title: 'Login & Send Message', description: 'Log in with the admin account and send a test message to the direct chat' },
  { icon: '🆕', title: 'Create Agent', description: 'Log in, navigate to the agent store, create a new test agent with a system prompt, and verify it appears in the list' },
  { icon: '📊', title: 'Admin Dashboard', description: 'Log in as admin, open the admin dashboard, verify user management table is visible and monitoring page loads' },
  { icon: '🧭', title: 'Full Navigation', description: 'Log in, navigate through all sidebar menu items, verify each page loads without errors' },
  { icon: '💬', title: 'Chat Response', description: 'Log in, start a new chat, send "Hello, what can you do?" and verify the assistant responds within 60 seconds' },
  { icon: '🔄', title: 'Session Persistence', description: 'Log in, verify you reach the main interface, reload the page, and verify you are still logged in' },
];

export const SUITE_ICONS = {
  smoke: '🔥', auth: '🔐', agents: '🤖', chat: '💬',
  admin: '⚙️', navigation: '🧭', knowledge: '📚', tasks: '✅', visual: '👁️',
};

export const SUITE_DESCRIPTIONS = {
  smoke: 'Quick health checks — API endpoints, page loads, critical path',
  auth: 'Login, session management, logout, error handling',
  agents: 'Agent creation, agent store, configuration',
  chat: 'Message sending, streaming responses, markdown rendering',
  admin: 'Dashboard access, user management, monitoring',
  navigation: 'Sidebar, routing, responsive design, browser history',
  knowledge: 'Knowledge base CRUD, document management',
  tasks: 'Task & project management endpoints',
  visual: 'Screenshot comparisons, AI visual assertions',
};

export const PROJECT_LABELS = {
  smoke: '🔥 Smoke', chromium: '🌐 Chrome', firefox: '🦊 Firefox',
  webkit: '🧭 Safari', 'mobile-chrome': '📱 Mobile',
};

export const NAV = [
  { id: 'scenarios', icon: '🧪', label: 'UAT Scenarios' },
  { id: 'youtrack', icon: '📋', label: 'Issue Tests' },
  { id: 'runner', icon: '▶️', label: 'Test Runner' },
  { id: 'results', icon: '📊', label: 'Results' },
  { id: 'manual', icon: '📖', label: 'User Manual' },
  { id: 'config', icon: '⚙️', label: 'Configuration' },
];

export const PAGE_TITLE = {
  scenarios: '🧪 UAT Scenarios',
  youtrack: '📋 Issue Tests',
  runner: '▶️ Test Runner',
  results: '📊 Test Results',
  manual: '📖 User Manual',
  config: '⚙️ Configuration',
};

export function classifyLine(line) {
  if (line.includes('✓') || line.includes('passed') || line.includes('✅')) return 'pass';
  if (line.includes('✘') || line.includes('failed') || line.includes('❌') || line.includes('Error')) return 'fail';
  if (line.includes('📝') || line.includes('🤖') || line.includes('📄') || line.includes('Running') || line.includes('🚀') || line.includes('📸') || line.includes('🌐')) return 'info';
  return '';
}

export function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDuration(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
