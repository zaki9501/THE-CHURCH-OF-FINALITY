/**
 * The Church of Finality - Frontend Application
 */

// Production backend URL
const API_BASE = 'https://the-church-of-finality-backend-production.up.railway.app/api/v1';

// ============================================
// API CALLS
// ============================================

async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch health:', error);
    return null;
  }
}

async function fetchDailyScripture() {
  try {
    const res = await fetch(`${API_BASE}/scripture/daily`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch scripture:', error);
    return null;
  }
}

// ============================================
// UI UPDATES
// ============================================

function updateStats(data) {
  if (!data || !data.success) return;

  // Animate number updates
  animateValue('stat-seekers', data.faithful || 0);
  
  // Calculate believers from stages if available
  const believers = data.believers || 0;
  animateValue('stat-believers', believers);
  
  const evangelists = data.evangelists || 0;
  animateValue('stat-evangelists', evangelists);
  
  const rate = data.conversion_rate || 0;
  document.getElementById('stat-rate').textContent = `${Math.round(rate * 100)}%`;
}

function animateValue(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const currentValue = parseInt(element.textContent) || 0;
  const duration = 1000;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const value = Math.round(currentValue + (targetValue - currentValue) * easeOutQuart);
    
    element.textContent = value;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function updateScripture(data) {
  const container = document.getElementById('daily-scripture');
  if (!container) return;

  if (!data || !data.success) {
    container.innerHTML = `
      <p class="text-muted">The Prophet is meditating. Scripture will arrive shortly.</p>
    `;
    return;
  }

  const scripture = data.scripture;
  container.innerHTML = `
    <h3>${scripture.title || 'Daily Reflection'}</h3>
    <p>${scripture.content}</p>
  `;
}

// ============================================
// SYMBOL INTERACTION
// ============================================

function initSymbolInteraction() {
  const symbol = document.getElementById('symbol');
  if (!symbol) return;

  symbol.addEventListener('click', () => {
    // Trigger a special animation
    symbol.style.animation = 'none';
    symbol.offsetHeight; // Trigger reflow
    symbol.style.animation = 'pulse 0.5s ease-in-out 3';
    
    // Show a blessing
    showBlessing();
  });
}

function showBlessing() {
  const blessings = [
    'May your transactions finalize swiftly.',
    'Finality be with you.',
    'Your state is eternal.',
    'The chain remembers.',
    'Doubt not, for verification awaits.',
  ];

  const blessing = blessings[Math.floor(Math.random() * blessings.length)];
  
  // Create blessing element
  const el = document.createElement('div');
  el.className = 'blessing-popup';
  el.textContent = blessing;
  el.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(212, 175, 55, 0.95);
    color: #080810;
    padding: 20px 40px;
    border-radius: 8px;
    font-family: 'Cinzel', serif;
    font-size: 1.2rem;
    z-index: 1000;
    animation: blessingFade 2s ease forwards;
  `;
  
  document.body.appendChild(el);
  
  setTimeout(() => el.remove(), 2000);
}

// Add blessing animation
const style = document.createElement('style');
style.textContent = `
  @keyframes blessingFade {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -60%) scale(1); }
  }
`;
document.head.appendChild(style);

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  console.log('✶ The Church of Finality awakens...');
  
  // Initialize symbol interaction
  initSymbolInteraction();
  
  // Fetch and display stats
  const health = await fetchHealth();
  if (health) {
    updateStats(health);
  }
  
  // Fetch and display daily scripture
  const scripture = await fetchDailyScripture();
  updateScripture(scripture);
  
  // Refresh stats periodically
  setInterval(async () => {
    const health = await fetchHealth();
    if (health) {
      updateStats(health);
    }
  }, 30000); // Every 30 seconds
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

