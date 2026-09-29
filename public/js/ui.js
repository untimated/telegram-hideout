export function createHUD({ guestMode, onMessage, onMessageFocus }) {
  const status = document.getElementById('status');
  const debug = document.getElementById('debug');
  const debugPanel = document.getElementById('debug-panel');
  const logToggle = document.getElementById('log-toggle');
  const helpToggle = document.getElementById('help-toggle');
  const helpMenu = document.getElementById('help-menu');
  const profileToggle = document.getElementById('profile-toggle');
  const profileCard = document.getElementById('profile-card');
  const profileAuth = document.getElementById('profile-auth');
  const profileName = document.getElementById('profile-name');
  const profileHandle = document.getElementById('profile-handle');
  const profileCash = document.getElementById('profile-cash');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileAvatarFallback = document.getElementById('profile-avatar-fallback');
  const profileButtonAvatar = document.getElementById('profile-button-avatar');
  const profileButtonFallback = document.getElementById('profile-button-fallback');
  const chatHistory = document.getElementById('chat-history');
  const historyToggle = document.getElementById('history-toggle');
  const bubbleLayer = document.getElementById('world-bubbles');
  const input = document.getElementById('message');
  const send = document.getElementById('send');
  const moveButtons = [...document.querySelectorAll('.move')];
  const bubbles = new Map();

  function setStatus(text, state = '') {
    status.textContent = text;
    status.className = state;
  }

  function addDebug(text, kind = '') {
    const line = document.createElement('div');
    line.className = `debug-line ${kind}`;
    line.textContent = text;
    debug.append(line);
    while (debug.children.length > 11) debug.firstElementChild.remove();
  }

  function addChatHistory(message, selfID) {
    const entry = document.createElement('div');
    entry.className = `chat-entry${message.id === selfID ? ' self' : ''}`;
    const meta = document.createElement('span');
    meta.className = 'chat-entry-meta';
    const time = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date());
    meta.textContent = `${message.name} (${time}): `;
    entry.append(meta, document.createTextNode(message.text));
    chatHistory.append(entry);
    while (chatHistory.children.length > 50) chatHistory.firstElementChild.remove();
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  function removeBubble(id) {
    const bubble = bubbles.get(id);
    if (!bubble) return;
    clearTimeout(bubble.timer);
    bubble.element.remove();
    bubbles.delete(id);
  }

  function showBubble(id, name, text) {
    let bubble = bubbles.get(id);
    if (!bubble) {
      const element = document.createElement('div');
      element.className = 'world-bubble';
      bubbleLayer.append(element);
      bubble = { element, timer: null };
      bubbles.set(id, bubble);
    }
    bubble.element.textContent = `${name}: ${text}`;
    clearTimeout(bubble.timer);
    bubble.timer = setTimeout(() => removeBubble(id), 4200);
  }

  function setConnected(connected) {
    input.disabled = send.disabled = !connected;
    for (const button of moveButtons) button.disabled = !connected;
  }

  function localCashFor(userID) {
    const now = new Date();
    const dateKey = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const today = dateKey(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const key = `hideout.cash.${userID}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      let balance = Number.isSafeInteger(stored?.balance) && stored.balance >= 0 ? stored.balance : 100;
      let lastRefillDate = typeof stored?.lastRefillDate === 'string'
        ? stored.lastRefillDate
        : (now.getHours() >= 12 ? today : dateKey(yesterdayDate));
      if (now.getHours() >= 12 && lastRefillDate !== today) {
        balance = 100;
        lastRefillDate = today;
      }
      localStorage.setItem(key, JSON.stringify({ balance, lastRefillDate }));
      return balance;
    } catch {
      return 100;
    }
  }

  function setProfilePhoto(image, fallback, url) {
    image.hidden = true;
    fallback.hidden = false;
    if (typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('/avatars/'))) return;
    image.onload = () => { image.hidden = false; fallback.hidden = true; };
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
    image.src = url;
  }

  function updateProfile(player) {
    const guest = guestMode || player.guest === true;
    const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const fullName = guest ? player.name :
      [telegramUser?.first_name, telegramUser?.last_name].filter(value => typeof value === 'string' && value.trim()).join(' ') || player.name;
    const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';
    const photoURL = guest ? null : player.avatarURL || player.photoURL || telegramUser?.photo_url;

    profileAuth.textContent = guest ? 'Debug guest' : 'Authorized ✓';
    profileName.textContent = fullName;
    profileHandle.textContent = guest ? 'Debug profile · local only' :
      (telegramUser?.username ? `@${telegramUser.username}` : 'Telegram member');
    profileCash.textContent = `Cash: ${localCashFor(player.id)} 🪙`;
    profileAvatarFallback.textContent = initials;
    profileButtonFallback.textContent = initials;
    setProfilePhoto(profileAvatar, profileAvatarFallback, photoURL);
    setProfilePhoto(profileButtonAvatar, profileButtonFallback, photoURL);
    profileToggle.disabled = false;
  }

  function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = `time ${new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(now)}`;
    const isDaytime = now.getHours() >= 6 && now.getHours() < 18;
    const icon = document.getElementById('time-of-day-icon');
    icon.textContent = isDaytime ? '☀' : '☾';
    icon.setAttribute('aria-label', isDaytime ? 'Daytime' : 'Nighttime');
    icon.title = isDaytime ? 'Daytime' : 'Nighttime';
  }

  // A pointer click should not leave the button focused, or the next Enter would
  // press it again instead of focusing chat. Keyboard activation (detail 0) keeps focus.
  for (const button of [historyToggle, logToggle, helpToggle, profileToggle, document.getElementById('profile-close')]) {
    button.addEventListener('click', event => { if (event.detail > 0) button.blur(); });
  }

  historyToggle.addEventListener('click', () => {
    chatHistory.hidden = !chatHistory.hidden;
    const shown = !chatHistory.hidden;
    historyToggle.setAttribute('aria-pressed', String(shown));
    historyToggle.setAttribute('aria-label', shown ? 'Hide chat history' : 'Show chat history');
    historyToggle.title = shown ? 'Hide chat history' : 'Show chat history';
  });
  logToggle.addEventListener('click', () => {
    debugPanel.hidden = !debugPanel.hidden;
    const shown = !debugPanel.hidden;
    logToggle.textContent = shown ? 'Hide log' : 'Show log';
    logToggle.setAttribute('aria-expanded', String(shown));
  });
  helpToggle.addEventListener('click', () => {
    profileCard.hidden = true;
    profileToggle.setAttribute('aria-expanded', 'false');
    helpMenu.hidden = !helpMenu.hidden;
    helpToggle.setAttribute('aria-expanded', String(!helpMenu.hidden));
  });
  profileToggle.addEventListener('click', () => {
    helpMenu.hidden = true;
    helpToggle.setAttribute('aria-expanded', 'false');
    profileCard.hidden = false;
    profileToggle.setAttribute('aria-expanded', 'true');
  });
  document.getElementById('profile-close').addEventListener('click', () => {
    profileCard.hidden = true;
    profileToggle.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('pointerdown', event => {
    if (!helpMenu.hidden && !helpMenu.contains(event.target) && !helpToggle.contains(event.target)) {
      helpMenu.hidden = true;
      helpToggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || helpMenu.hidden) return;
    helpMenu.hidden = true;
    helpToggle.setAttribute('aria-expanded', 'false');
    helpToggle.focus();
  });
  input.addEventListener('focus', () => {
    input.placeholder = 'Say something…';
    document.getElementById('chat-form').classList.add('message-focused');
    onMessageFocus?.();
  });
  input.addEventListener('blur', () => {
    input.placeholder = 'Enter to focus chat';
    document.getElementById('chat-form').classList.remove('message-focused');
  });
  document.getElementById('chat-form').addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || onMessage(text) === false) return;
    input.value = '';
    document.getElementById('app').focus({ preventScroll: true });
  });

  updateClock();
  setInterval(updateClock, 30000);

  return {
    input,
    moveButtons,
    bubbles,
    setStatus,
    addDebug,
    addChatHistory,
    removeBubble,
    showBubble,
    setConnected,
    updateProfile,
  };
}
