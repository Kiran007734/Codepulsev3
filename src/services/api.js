/**
 * CodePulse API Service — centralized fetch wrapper for all backend calls.
 */

const isProd = import.meta.env.PROD;
const defaultProdUrl = 'https://vasanth-sjr-codepulse-api.hf.space';
// Use Vercel env var if available, else fallback to HF, else use local proxy
const API_BASE = isProd 
  ? `${import.meta.env.VITE_API_BASE_URL || defaultProdUrl}/api` 
  : '/api';

class ApiError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, options);

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err.detail || err.error || res.statusText;
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(res.status, `API Error (${res.status})`, detail);
  }

  return res.json();
}

/**
 * Repository and GitHub endpoints.
 */
export async function fetchRepository(repoUrl, token = '') {
  return request('POST', '/github/fetch', {
    repo_url: repoUrl,
    token: token || undefined,
  });
}

/**
 * Requirement and Analysis endpoints.
 */
export async function uploadRequirements(requirements, repoId) {
  return request('POST', '/analysis/upload-requirements', {
    requirements,
    repo_id: repoId,
  });
}

export async function startPipeline(repoId) {
  return request('POST', `/analysis/start-analysis?repo_id=${repoId}`);
}

export async function analyzeRequirements(requirements, repoId) {
  return request('POST', '/analysis/requirements', {
    requirements,
    repo_id: repoId,
  });
}

/**
 * Granular Dashboard endpoints.
 */
export async function getDashboardOverview(repoId) {
  return request('GET', `/dashboard/overview?repo_id=${repoId}`);
}

export async function getImpactScores(repoId) {
  return request('GET', `/dashboard/developer-impact?repo_id=${repoId}`);
}

export async function getRequirementMapping(repoId) {
  return request('GET', `/dashboard/requirement-mapping?repo_id=${repoId}`);
}

export async function getKnowledgeRisks(repoId) {
  return request('GET', `/dashboard/knowledge-risk?repo_id=${repoId}`);
}

/**
 * Combined Dashboard Summary.
 */
export async function getDashboardSummary(repoId) {
  return request('GET', `/dashboard/summary?repo_id=${repoId}`);
}

/**
 * AI Intelligence endpoints.
 */
export async function getCommitExplanation(repoId, sha) {
  return request('GET', `/ai/commit/${sha}/explanation?repo_id=${repoId}`);
}

export async function getDeveloperSkills(repoId) {
  return request('GET', `/ai/developers/skills?repo_id=${repoId}`);
}

export async function getSprintSummary(repoId) {
  return request('GET', `/ai/summary/sprint?repo_id=${repoId}`);
}

export async function getRecommendations(repoId) {
  return request('GET', `/ai/recommendations?repo_id=${repoId}`);
}

/**
 * Jira Integration endpoints.
 */
export async function connectJira(baseUrl, email, apiToken, projectKey, repoId) {
  return request('POST', '/integrations/jira/connect', {
    baseUrl,
    email,
    apiToken,
    projectKey: projectKey || undefined,
    repo_id: repoId,
  });
}

export async function getPlanVsReality(repoId) {
  return request('GET', `/integrations/jira/plan-vs-reality?repo_id=${repoId}`);
}

/**
 * Email Notification endpoints.
 */
export async function sendEmailReport(repoId, email) {
  return request('POST', '/notifications/send-email-report', {
    repo_id: repoId,
    email,
  });
}

export async function testEmailWebhook() {
  return request('POST', '/notifications/test-webhook');
}

/**
 * Health check.
 */
export async function healthCheck() {
  return request('GET', '/health');
}

/**
 * Predictive Risk & Intervention endpoints.
 */
export async function getRiskTrajectory() {
  return request('GET', '/risk/trajectory');
}

export async function getRiskFlags() {
  return request('GET', '/risk/flags');
}

export async function getTechDebt() {
  return request('GET', '/techdebt');
}

export async function getInterventions() {
  return request('GET', '/interventions');
}

export async function getManagerDashboard() {
  return request('GET', '/dashboard/manager');
}

export async function runSimulation(body) {
  return request('POST', '/simulation/run', body);
}

export async function getSimulationHistory() {
  return request('GET', '/simulation/history');
}

export async function parseStandup(transcript, developer) {
  return request('POST', '/standup/voice', { transcript, developer });
}

export async function createMemorySnapshot(data) {
  return request('POST', '/memory/snapshot', data);
}

export async function searchMemory(query) {
  return request('GET', `/memory/search?q=${encodeURIComponent(query)}`);
}

export async function getModuleMemory(module) {
  return request('GET', `/memory/${encodeURIComponent(module)}`);
}

export async function generateRetro() {
  return request('GET', '/retro/generate');
}

export async function analyzeCommit(commitSha) {
  return request('POST', '/commits/analyze', { commit_sha: commitSha });
}

export async function getDeveloperGrowth(username) {
  return request('GET', `/developers/${encodeURIComponent(username)}/growth`);
}

export async function testConfig() {
  return request('GET', '/config/test');
}

export async function triggerReport() {
  return request('GET', '/reports/trigger');
}
