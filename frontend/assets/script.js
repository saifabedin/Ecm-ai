'use strict';

/* ════════════════════════════════════════════
   INIT APP AFTER DOM LOAD
════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  console.log("APP INITIALIZED");

  const API_HOST = `${window.location.protocol}//${window.location.hostname}:5000`;
  const AUTH_BASE = `${API_HOST}/auth`;
  const API_BASE = `${API_HOST}/api`;

  let token = null;
  let user = null;
  let campaignData = {};
  let currentJobId = null;
  let jobPollingInterval = null;
  let jobHistory = [];
  let isJobRunning = false;
  let btnLaunch = null;

  /* ─────────────────────────────
     STATE MANAGEMENT
  ───────────────────────────── */
  function setAuth(authToken, authUser) {
    token = authToken;
    user = authUser;
    sessionStorage.setItem('dm_token', authToken);
    sessionStorage.setItem('dm_user', JSON.stringify(authUser));
  }

  function clearAuth() {
    token = null;
    user = null;
    sessionStorage.removeItem('dm_token');
    sessionStorage.removeItem('dm_user');
    // Clear currentJobId and its cached result on logout
    const currentJobId = localStorage.getItem('dm_currentJobId');
    if (currentJobId) {
      localStorage.removeItem(`dm_jobResult_${currentJobId}`);
    }
    localStorage.removeItem('dm_currentJobId');
  }

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  function getAuthToken() {
    return token || sessionStorage.getItem('dm_token');
  }

  function getAuthUser() {
    if (user) return user;
    const userStr = sessionStorage.getItem('dm_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  /* ─────────────────────────────
     SCREEN MANAGER
  ───────────────────────────── */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    const el = document.getElementById(id);
    if (!el) {
      console.error("Screen not found:", id);
      return;
    }

    el.classList.add('active');
    window.scrollTo(0, 0);
  }

  /* ─────────────────────────────
     AUTHENTICATION
  ───────────────────────────── */
  const btnLogin = document.getElementById('btnLogin');
  const btnRegister = document.getElementById('btnRegister');
  const loginPassword = document.getElementById('loginPassword');
  const registerPassword = document.getElementById('registerPassword');
  const registerConfirmPassword = document.getElementById('registerConfirmPassword');
  const showLoginLink = document.getElementById('showLogin');
  const showRegisterLink = document.getElementById('showRegister');

  if (btnLogin) {
    btnLogin.addEventListener('click', handleLogin);
  }

  if (btnRegister) {
    btnRegister.addEventListener('click', handleRegister);
  }

  if (showLoginLink) {
    showLoginLink.addEventListener('click', e => {
      e.preventDefault();
      showScreen('screenLogin');
    });
  }

  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', e => {
      e.preventDefault();
      showScreen('screenRegister');
    });
  }

  if (loginPassword) {
    loginPassword.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleLogin();
    });
  }

  if (registerPassword) {
    registerPassword.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleRegister();
    });
  }

  if (registerConfirmPassword) {
    registerConfirmPassword.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleRegister();
    });
  }

  async function handleLogin() {
    console.log("LOGIN CLICKED");

    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');

    if (!email) { errEl.textContent = 'Please enter your email.'; return; }
    if (!pass)  { errEl.textContent = 'Please enter your password.'; return; }

    errEl.textContent = '';

    try {
      const response = await apiFetch(`${AUTH_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      setAuth(data.token, data.user);
      document.getElementById('navUser').textContent = data.user.email || data.user.name;
      loadDashboard();
      showScreen('screenDashboard');
    } catch (err) {
      console.error("Login error:", err);
      // Use field-specific error for login
      errEl.textContent = err.message || 'Login failed';
    }
  }

  async function handleRegister() {
    console.log("REGISTER CLICKED");

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const pass = document.getElementById('registerPassword').value;
    const confirmPass = document.getElementById('registerConfirmPassword').value;
    const errEl = document.getElementById('registerError');

    if (!name) { errEl.textContent = 'Please enter your name.'; return; }
    if (!email) { errEl.textContent = 'Please enter your email.'; return; }
    if (!pass)  { errEl.textContent = 'Please enter your password.'; return; }
    if (!confirmPass) { errEl.textContent = 'Please confirm your password.'; return; }
    if (pass !== confirmPass) { errEl.textContent = 'Passwords do not match.'; return; }

    errEl.textContent = '';

    try {
      const response = await apiFetch(`${AUTH_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pass })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      const data = await response.json();
      setAuth(data.token, data.user);
      document.getElementById('navUser').textContent = data.user.email || data.user.name;
      loadDashboard();
      showScreen('screenDashboard');
    } catch (err) {
      console.error("Register error:", err);
      // Use field-specific error for register
      errEl.textContent = err.message || 'Registration failed';
    }
  }

  /* ─────────────────────────────
     LOGOUT
  ───────────────────────────── */
  ['btnLogout','btnLogout2','btnLogout3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', () => {
        clearAuth();
        showScreen('screenLogin');
      });
    }
  });

  /* ─────────────────────────────
     PLATFORM SELECT
  ───────────────────────────── */
  const platformWrap = document.getElementById('platformChips');

  if (platformWrap) {
    platformWrap.addEventListener('click', e => {
      const chip = e.target.closest('.platform-chip');
      if (!chip) return;
      chip.classList.toggle('on');
    });
  }

  function getSelectedPlatforms() {
    return [...document.querySelectorAll('.platform-chip.on')]
      .map(c => c.dataset.p);
  }

  /* ─────────────────────────────
     DASHBOARD
  ───────────────────────────── */
  function loadDashboard() {
    // In a real app, we'd fetch from backend
    // For now, we'll use localStorage to simulate persistence
    const historyStr = localStorage.getItem('dm_jobHistory');
    jobHistory = historyStr ? JSON.parse(historyStr) : [];
    renderDashboard();
  }

  /* ─────────────────────────────
     CACHE HELPERS
  ───────────────────────────── */
  function getCachedJobResult(jobId) {
    if (!jobId) return null;
    const cached = localStorage.getItem(`dm_jobResult_${jobId}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error('Failed to parse cached job result:', e);
        // Remove corrupted cache
        localStorage.removeItem(`dm_jobResult_${jobId}`);
        return null;
      }
    }
    return null;
  }

  function saveDashboard() {
    localStorage.setItem('dm_jobHistory', JSON.stringify(jobHistory));
  }

  function addToJobHistory(jobData) {
    const entry = {
      id: jobData.jobId || Date.now().toString(),
      timestamp: new Date().toISOString(),
      brand: jobData.brand || 'Unknown',
      status: jobData.state || 'completed',
      result: jobData
    };
    jobHistory.unshift(entry);
    // Keep only last 50 entries
    if (jobHistory.length > 50) jobHistory = jobHistory.slice(0, 50);
    saveDashboard();
    renderDashboard();
  }

  function renderDashboard() {
    const dashboardEl = document.getElementById('dashboardContent');
    if (!dashboardEl) return;

    if (jobHistory.length === 0) {
      dashboardEl.innerHTML = '<p class="empty-state">No campaigns yet. Create your first campaign!</p>';
      return;
    }

    dashboardEl.innerHTML = jobHistory.map(job => `
      <div class="job-card" data-job-id="${job.id}">
        <div class="job-header">
          <h3>${job.brand}</h3>
          <span class="job-status ${job.status}">${job.status}</span>
        </div>
        <div class="job-timestamp">
          ${new Date(job.timestamp).toLocaleString()}
        </div>
        <div class="job-actions">
          <button class="btn-view">View Results</button>
          <button class="btn-rerun">Run Again</button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    document.querySelectorAll('.job-card .btn-view').forEach(btn => {
      btn.addEventListener('click', e => {
        const jobCard = e.target.closest('.job-card');
        const jobId = jobCard.dataset.jobId;
        const job = jobHistory.find(j => j.id === jobId);
        if (job) showJobResults(job.result);
      });
    });

    document.querySelectorAll('.job-card .btn-rerun').forEach(btn => {
      btn.addEventListener('click', e => {
        const jobCard = e.target.closest('.job-card');
        const jobId = jobCard.dataset.jobId;
        const job = jobHistory.find(j => j.id === jobId);
        if (job && job.result) {
          const payload = {
            business: job.result.business,
            niche: job.result.niche,
            website: job.result.website,
            budget: job.result.budget,
            usp: job.result.usp,
            details: job.result.details,
            platforms: job.result.platforms
          };
          startCampaign(payload);
        }
      });
    });
  }

  /* ─────────────────────────────
     CAMPAIGN FORM
  ───────────────────────────── */
  const btnLaunch = document.getElementById('btnLaunch');

  if (btnLaunch) {
    btnLaunch.addEventListener('click', handleLaunch);
  }

  function handleLaunch() {
    const brand    = document.getElementById('fBrand').value.trim();
    const niche    = document.getElementById('fNiche').value.trim();
    const website  = document.getElementById('fWebsite').value.trim();
    const budget   = document.getElementById('fBudget').value.trim();
    const usp      = document.getElementById('fUSP').value.trim();
    const details  = document.getElementById('fDetails').value.trim();
    const platforms = getSelectedPlatforms();
    const errEl    = document.getElementById('formError');

    if (!brand || !niche || !budget || !usp || !platforms.length) {
      errEl.textContent = "Please fill all required fields";
      return;
    }

    errEl.textContent = '';

    // Prevent duplicate submissions
    if (isJobRunning) {
      return;
    }
    isJobRunning = true;
    if (btnLaunch) {
      btnLaunch.disabled = true;
    }

    campaignData = { brand, niche, website, budget, usp, details, platforms };
    startCampaign(campaignData);
  }

  async function startCampaign(payload) {
    try {
      showScreen('screenLoading');
      document.getElementById('loadStatus').textContent = 'Creating campaign...';
      resetProgress();

      const response = await apiFetch(`${API_BASE}/orchestrator`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to create campaign: ${response.status}`);
      }

      const data = await response.json();
      currentJobId = data.jobId;

      if (!currentJobId) {
        throw new Error('No job ID returned');
      }

      document.getElementById('loadStatus').textContent = 'Job queued, processing...';
      startJobPolling();

    } catch (err) {
      console.error("Campaign start error:", err);
      showError(err.message || 'Failed to start campaign', false); // Not retryable for form validation errors
      showScreen('screenForm');
    }
  }

  /* ─────────────────────────────
     JOB POLLING & TRACKING
  ───────────────────────────── */
  function startJobPolling() {
    if (jobPollingInterval) clearInterval(jobPollingInterval);

    let pollInterval = 3000; // Start at 3 seconds
    const maxInterval = 30000; // Max 30 seconds

    const pollJob = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/jobs/${encodeURIComponent(currentJobId)}`, {
          method: 'GET',
          headers: getAuthHeaders()
        });

        if (!response.ok) {
          throw new Error(`Failed to get job status: ${response.status}`);
        }

        const jobData = await response.json();
        updateJobStatus(jobData);

        // Reset interval on successful poll
        pollInterval = 3000;

        if (jobData.state === 'completed' || jobData.state === 'failed') {
          clearInterval(jobPollingInterval);
          jobPollingInterval = null;

          if (jobData.state === 'completed') {
            // Add to history
            addToJobHistory(jobData);
            // Cache the result for potential refresh recovery
            localStorage.setItem(`dm_jobResult_${jobData.jobId}`, JSON.stringify(jobData));
            // Show results
            showJobResults(jobData);
          } else {
            showError(`Job failed: ${jobData.error || 'Unknown error'}`);
          }
          // Reset job running flag and re-enable button
          isJobRunning = false;
          if (btnLaunch) {
            btnLaunch.disabled = false;
          }
        }
      } catch (err) {
        console.error("Job polling error:", err);
        // Show error with retry option
        showError('Lost connection to server. Please try again.', true, () => {
          // Retry the poll immediately
          pollJob();
        });
        // Increase interval with exponential backoff (max 30s)
        pollInterval = Math.min(pollInterval * 2, maxInterval);
        // Don't clear interval on error - we'll retry with backoff
        // Reset job running flag and re-enable button on error
        isJobRunning = false;
        if (btnLaunch) {
          btnLaunch.disabled = false;
        }
      }
    };

    // Initial poll
    pollJob();

    // Set interval with backoff
    jobPollingInterval = setInterval(() => {
      pollJob();
    }, pollInterval);
  }

  function updateJobStatus(jobData) {
    // Update status text
    const statusMap = {
      queued: 'Queued',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed'
    };

    document.getElementById('loadStatus').textContent =
      statusMap[jobData.state] || jobData.state || 'Unknown';

    // Update progress bar (simulate engine progression)
    const progressMap = {
      queued: 0,
      processing: Math.min(50 + Math.random() * 40, 95), // Simulate progress
      completed: 100,
      failed: 100
    };

    const progress = progressMap[jobData.state] || 0;
    document.getElementById('progressFill').style.width = `${progress}%`;

    // Update current engine indicator (simplified)
    if (jobData.state === 'processing') {
      const engines = ['Research', 'Content', 'Images', 'Video', 'Publishing', 'Tracking', 'Optimization'];
      const engineIndex = Math.floor((progress / 100) * engines.length);
      const currentEngine = engines[Math.min(engineIndex, engines.length - 1)];
      document.getElementById('currentEngine').textContent = currentEngine;
    }
  }

  function resetProgress() {
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('currentEngine').textContent = 'Initializing...';
    document.getElementById('progressPercent').textContent = '0%';
    // Remove retry button if exists
    const retryButton = document.getElementById('errorRetryButton');
    if (retryButton) {
      retryButton.remove();
    }
  }

  let errorRetryCount = 0;
const maxErrorRetries = 3;

function showError(message, isRetryable = true, retryCallback = null) {
    const loadStatusEl = document.getElementById('loadStatus');
    loadStatusEl.textContent = message;
    loadStatusEl.style.color = '#ff6b6b';
    loadStatusEl.style.textAlign = 'center';

    // Clear existing retry button
    const existingRetry = document.getElementById('errorRetryButton');
    if (existingRetry) {
      existingRetry.remove();
    }

    // Add retry button if retryable
    if (isRetryable && retryCallback && errorRetryCount < maxErrorRetries) {
      const retryButton = document.createElement('button');
      retryButton.id = 'errorRetryButton';
      retryButton.className = 'cta-btn';
      retryButton.style.marginTop = '10px';
      retryButton.style.padding = '8px 16px';
      retryButton.textContent = 'Retry';
      retryButton.onclick = () => {
        errorRetryCount++;
        retryButton.disabled = true;
        retryButton.textContent = 'Retrying...';
        retryCallback();
      };
      loadStatusEl.appendChild(document.createElement('br'));
      loadStatusEl.appendChild(retryButton);
    }

    // Remove auto-redirect - keep error visible until user action
  }

  /* ─────────────────────────────
     RESULTS DISPLAY
  ───────────────────────────── */
  function showJobResults(jobData) {
    currentJobId = jobData.jobId;

    // Check if we have cached results for this jobId
    const cachedResult = getCachedJobResult(currentJobId);
    let resultData = jobData.result || {};

    // If we have cached results, use them (they might be more complete)
    if (cachedResult && cachedResult.result) {
      resultData = cachedResult.result || {};
    }

    // Update headline
    document.getElementById('rHeadline').textContent =
      `${resultData.brand || 'Campaign'} Results ✦`;

    // Update subline
    document.getElementById('rSubline').textContent =
      `Completed on ${new Date(jobData.updatedAt || jobData.createdAt).toLocaleString()}`;

    // Show loading states for all sections
    showLoading('mReach', 'Loading impressions...');
    showLoading('mClicks', 'Loading clicks...');
    showLoading('mConv', 'Loading conversions...');
    showLoading('mCost', 'Loading cost...');
    showLoading('mCtr', 'Loading CTR...');
    showLoading('mRoas', 'Loading ROAS...');
    showLoading('hooksList', 'Loading hooks...');
    showLoading('captionsList', 'Loading captions...');
    showLoading('adsList', 'Loading ad copies...');
    showLoading('imagesGrid', 'Loading images...');
    showLoading('videoContainer', 'Loading video...');
    showLoading('publishedPost', 'Loading post...');
    showLoading('optimizationList', 'Loading optimization suggestions...');

    // Update metrics (Engine 7 - Tracking)
    updateMetrics(resultData);

    // Update content (Engine 2)
    updateContent(resultData);

    // Update images (Engine 3)
    updateImages(resultData);

    // Update video (Engine 4)
    updateVideo(resultData);

    // Update published post (Engine 5)
    updatePublishedPost(resultData);

    // Update optimization suggestions (Engine 8)
    updateOptimization(resultData);

    showScreen('screenResults');
  }

  function updateMetrics(data) {
    const metrics = data.campaignMetrics || {};

    document.getElementById('mReach').textContent = formatNumber(metrics.impressions || 0);
    document.getElementById('mClicks').textContent = formatNumber(metrics.clicks || 0);
    document.getElementById('mConv').textContent = formatNumber(metrics.conversions || 0);
    document.getElementById('mCost').textContent = `$${formatNumber(metrics.cost || 0)}`;

    // Additional metrics if available
    const ctrEl = document.getElementById('mCtr');
    if (ctrEl) ctrEl.textContent = `${(metrics.ctr || 0).toFixed(2)}%`;

    const roasEl = document.getElementById('mRoas');
    if (roasEl) roasEl.textContent = (metrics.roas || 0).toFixed(2);

    // Show empty states if no data
    if (!metrics.impressions && !metrics.clicks && !metrics.conversions && !metrics.cost) {
      showEmptyState('mReach', 'No impressions data');
      showEmptyState('mClicks', 'No clicks data');
      showEmptyState('mConv', 'No conversions data');
      showEmptyState('mCost', 'No cost data');
      showEmptyState('mCtr', 'No CTR data');
      showEmptyState('mRoas', 'No ROAS data');
    }
  }

  function updateContent(data) {
    const content = data.content || data.data || {};

    // Hooks
    const hooksEl = document.getElementById('hooksList');
    if (hooksEl && Array.isArray(content.hooks)) {
      hooksEl.innerHTML = content.hooks
        .slice(0, 5)
        .map(hook => `<li>${escapeHtml(hook)}</li>`)
        .join('');
    } else {
      showEmptyState('hooksList', 'No hooks generated');
    }

    // Captions
    const captionsEl = document.getElementById('captionsList');
    if (captionsEl && Array.isArray(content.captions)) {
      captionsEl.innerHTML = content.captions
        .slice(0, 5)
        .map(caption => `<li>${escapeHtml(caption)}</li>`)
        .join('');
    } else {
      showEmptyState('captionsList', 'No captions generated');
    }

    // Ad copies
    const adsEl = document.getElementById('adsList');
    if (adsEl && Array.isArray(content.adCopies)) {
      adsEl.innerHTML = content.adCopies
        .slice(0, 5)
        .map(ad => `<li>${escapeHtml(ad)}</li>`)
        .join('');
    } else {
      showEmptyState('adsList', 'No ad copies generated');
    }
  }

  function updateImages(data) {
    const images = (data.images || []).filter(Boolean);
    const imagesGrid = document.getElementById('imagesGrid');

    if (!imagesGrid) return;

    if (images.length === 0) {
      imagesGrid.innerHTML = '<p class="empty-state">No images generated for this campaign</p>';
      return;
    }

    imagesGrid.innerHTML = images.map((img, index) => `
      <div class="image-item">
        <img src="${escapeHtml(img)}" alt="Generated image ${index + 1}" onclick="openImageModal('${escapeHtml(img)}')">
        <div class="image-actions">
          <button onclick="downloadImage('${escapeHtml(img)}')">Download</button>
        </div>
      </div>
    `).join('');
  }

  function updateVideo(data) {
    const videoUrl = data.video_url || data.videoUrl;
    const videoEl = document.getElementById('videoContainer');

    if (!videoEl) return;

    if (!videoUrl) {
      videoEl.innerHTML = '<p class="empty-state">No video generated for this campaign</p>';
      return;
    }

    videoEl.innerHTML = `
      <video controls poster="https://via.placeholder.com/640x360?thumb=video">
        <source src="${escapeHtml(videoUrl)}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
      <div class="video-actions">
        <button onclick="downloadVideo('${escapeHtml(videoUrl)}')">Download Video</button>
      </div>
    `;
  }

  function updatePublishedPost(data) {
    const postEl = document.getElementById('publishedPost');
    if (!postEl) return;

    const postId = data.post_id || data.postId;
    if (!postId) {
      postEl.innerHTML = '<p class="empty-state">No post published for this campaign</p>';
      return;
    }

    postEl.innerHTML = `
      <div class="post-info">
        <h3>Post Published Successfully!</h3>
        <p>Post ID: <code>${escapeHtml(postId)}</code></p>
        <p>Check your connected social media accounts for the live post.</p>
      </div>
    `;
  }

  function updateOptimization(data) {
    const recommendations = data.recommendations || data.optimizationRecommendations || [];
    const optEl = document.getElementById('optimizationList');

    if (!optEl) return;

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      optEl.innerHTML = '<p class="empty-state">No optimization suggestions available for this campaign</p>';
      return;
    }

    optEl.innerHTML = recommendations
      .slice(0, 5)
      .map(rec => `<li>${escapeHtml(rec)}</li>`)
      .join('');
  }

  /* ─────────────────────────────
     UTILITY FUNCTIONS
  ───────────────────────────── */
  function formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ─────────────────────────────
     API FETCH WITH AUTH CHECK
  ───────────────────────────── */
  async function apiFetch(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 401) {
      clearAuth();
      showScreen('screenLogin');
      throw new Error('Session expired. Please log in again.');
    }
    return response;
  }

  function openImageModal(url) {
    // Simple modal - in reality you'd use a proper modal library
    alert(`Image URL:\n${url}\n\nRight-click to save image.`);
  }

  function downloadImage(url) {
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `image-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadVideo(url) {
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* ─────────────────────────────
     INIT SESSION
  ───────────────────────────── */
  const initSession = async () => {
    const token = getAuthToken();
    const user = getAuthUser();

    if (token && user) {
      setAuth(token, user);
      document.getElementById('navUser').textContent = user.email || user.name;

      // Check if we have a cached job result to show
      const cachedJobId = localStorage.getItem('dm_currentJobId');
      if (cachedJobId) {
        const cachedResult = getCachedJobResult(cachedJobId);
        if (cachedResult) {
          // Show cached job results directly
          showJobResults(cachedResult);
          return;
        }
      }

      // Otherwise load dashboard as usual
      loadDashboard();
      showScreen('screenDashboard');
    } else {
      showScreen('screenLogin');
    }
  };

  initSession();

});

/* ─────────────────────────────
     LOADING & EMPTY STATES
───────────────────────────── */
  function showLoading(elementId, loadingMessage = 'Loading...') {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = `<div class="loading-state">${loadingMessage}</div>`;
    }
  }

  function showEmptyState(elementId, message = 'No data available') {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = `<p class="empty-state">${message}</p>`;
    }
  }