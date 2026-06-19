import { icon } from '/livekit-icons.js';
import { breakoutRoomCountLabel, getInitials, normalizeBreakoutRoomCount, normalizeName, normalizeRoomId } from '/livekit-utils.js';

const pageMeta = {
  home: {
    label: 'Home',
    icon: 'home',
    title: 'Home',
    description: 'Start, schedule, or join your next meeting.'
  },
  upcoming: {
    label: 'Upcoming',
    icon: 'calendar',
    title: 'Upcoming meetings',
    description: 'Your scheduled meetings that have not started yet.'
  },
  previous: {
    label: 'Previous',
    icon: 'history',
    title: 'Previous meetings',
    description: 'Sessions that already ended.'
  },
  recordings: {
    label: 'Recordings',
    icon: 'recording',
    title: 'Recordings',
    description: 'Meeting recordings and session captures.'
  },
  personal: {
    label: 'Personal Room',
    icon: 'personal',
    title: 'Personal room',
    description: 'Your always-available room for drop-in meetings.'
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const esc = escapeHtml;

function formatDateTime(value, options = {}) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) {
    return 'Not scheduled';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: options.dateStyle || 'medium',
    timeStyle: options.timeStyle || 'short'
  }).format(date);
}

function formatDateOnly(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) {
    return 'No date';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium'
  }).format(date);
}

function countLabel(count, singular, plural = `${singular}s`) {
  const safeCount = Number(count || 0);
  return `${safeCount} ${safeCount === 1 ? singular : plural}`;
}

function statusLabel(meeting) {
  if (!meeting) {
    return 'Ready';
  }
  if (meeting.type === 'personal' && meeting.status === 'available') {
    return 'Available';
  }
  if (meeting.status === 'active') {
    return 'Live';
  }
  if (meeting.status === 'scheduled') {
    return 'Scheduled';
  }
  if (meeting.status === 'ended') {
    return 'Ended';
  }
  return meeting.status || 'Ready';
}

function joinBlockDetail(joinBlocked) {
  if (!joinBlocked) {
    return '';
  }
  if (joinBlocked.startsAt) {
    return `Scheduled for ${formatDateTime(joinBlocked.startsAt)}`;
  }
  if (joinBlocked.code === 'waiting-for-approval') {
    return 'Stay on this page while the host reviews your request.';
  }
  if (joinBlocked.code === 'approval-denied') {
    return 'You can try requesting access again if the host asks you to rejoin.';
  }
  if (joinBlocked.code === 'approval-expired') {
    return 'No host answered in time. You can send a new join request now.';
  }
  if (joinBlocked.code === 'meeting-not-started') {
    return 'The host needs to start the meeting first.';
  }
  if (joinBlocked.code === 'meeting-ended') {
    return 'This meeting is no longer available.';
  }
  return '';
}

function connectionErrorDetail(message) {
  const text = String(message || '').trim();
  if (!text) {
    return '';
  }
  if (/livekit signal server/i.test(text)) {
    return 'Start LiveKit or check your signal URL settings, then try again.';
  }
  if (/livekit is not configured/i.test(text)) {
    return 'Check your LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET settings.';
  }
  return '';
}

function navMarkup(page) {
  return Object.entries(pageMeta).map(([key, meta]) => `
    <button class="dashboard-nav__item${page === key ? ' is-active' : ''}" type="button" data-nav="${key}">
      ${icon(meta.icon)}
      <span>${meta.label}</span>
    </button>
  `).join('');
}

function meetingActionsMarkup(meeting) {
  const primaryLabel = meeting?.type === 'personal'
    ? 'Open room'
    : meeting?.type === 'scheduled' && meeting?.isHost
      ? 'Start'
      : 'Open';
  return `
    <div class="dashboard-card__actions">
      <button class="primary-action dashboard-card__action" type="button" data-open-meeting="${escapeHtml(meeting?.id || '')}">${primaryLabel}</button>
      <button class="secondary-action dashboard-card__action" type="button" data-copy-link="${escapeHtml(meeting?.id || '')}">Copy link</button>
    </div>
  `;
}

function meetingCardMarkup(meeting) {
  const startsAtLabel = meeting?.startsAt ? formatDateTime(meeting.startsAt) : 'Starts when the host joins';
  return `
    <article class="dashboard-card meeting-card">
      <div class="dashboard-card__header">
        <div class="dashboard-card__identity">
          <span class="dashboard-card__avatar">${escapeHtml(getInitials(meeting?.title || meeting?.hostName || 'Meeting'))}</span>
          <div>
            <h3>${escapeHtml(meeting?.title || 'Untitled meeting')}</h3>
            <p>${escapeHtml(meeting?.description || `${meeting?.type || 'meeting'} · ${startsAtLabel}`)}</p>
          </div>
        </div>
        <span class="dashboard-status dashboard-status--${escapeHtml(String(meeting?.status || 'ready').toLowerCase())}">${escapeHtml(statusLabel(meeting))}</span>
      </div>
      <div class="dashboard-card__meta">
        <span>${icon('clock')}<strong>${escapeHtml(startsAtLabel)}</strong></span>
        <span>${icon('rooms')}<strong>${escapeHtml(breakoutRoomCountLabel(meeting?.breakoutRoomCount || 8))}</strong></span>
        <span>${icon('personal')}<strong>${escapeHtml(meeting?.hostName || 'Host')}</strong></span>
      </div>
      ${meetingActionsMarkup(meeting)}
    </article>
  `;
}

function sessionCardMarkup(session) {
  return `
    <article class="dashboard-card meeting-card meeting-card--compact">
      <div class="dashboard-card__header">
        <div class="dashboard-card__identity">
          <span class="dashboard-card__avatar">${escapeHtml(getInitials(session?.title || session?.hostName || 'Meeting'))}</span>
          <div>
            <h3>${escapeHtml(session?.title || 'Completed meeting')}</h3>
            <p>${escapeHtml(session?.hostName || 'Unknown host')}</p>
          </div>
        </div>
        <span class="dashboard-status dashboard-status--ended">Ended</span>
      </div>
      <div class="dashboard-card__meta">
        <span>${icon('clock')}<strong>${escapeHtml(formatDateTime(session?.startedAt))}</strong></span>
        <span>${icon('history')}<strong>${escapeHtml(formatDateTime(session?.endedAt))}</strong></span>
      </div>
      <div class="dashboard-card__actions">
        <button class="secondary-action dashboard-card__action" type="button" data-open-meeting="${escapeHtml(session?.meetingId || '')}">Open meeting</button>
      </div>
    </article>
  `;
}

function recordingCardMarkup(recording) {
  return `
    <article class="dashboard-card meeting-card meeting-card--compact">
      <div class="dashboard-card__header">
        <div class="dashboard-card__identity">
          <span class="dashboard-card__avatar">${escapeHtml(getInitials(recording?.title || recording?.hostName || 'Recording'))}</span>
          <div>
            <h3>${escapeHtml(recording?.title || 'Recording')}</h3>
            <p>${escapeHtml(recording?.hostName || 'Unknown host')}</p>
          </div>
        </div>
        <span class="dashboard-status dashboard-status--active">Saved</span>
      </div>
      <div class="dashboard-card__meta">
        <span>${icon('recording')}<strong>${escapeHtml(formatDateOnly(recording?.createdAt))}</strong></span>
        <span>${icon('clock')}<strong>${escapeHtml(recording?.durationLabel || 'Duration unavailable')}</strong></span>
      </div>
      <div class="dashboard-card__actions">
        ${recording?.url ? `<a class="primary-action dashboard-card__action dashboard-card__link" href="${escapeHtml(recording.url)}" target="_blank" rel="noreferrer">Open recording</a>` : '<span class="dashboard-card__placeholder">No recording URL yet</span>'}
      </div>
    </article>
  `;
}

function emptyStateMarkup(title, description, actionLabel = '', actionKey = '') {
  return `
    <div class="dashboard-empty">
      <div class="dashboard-empty__icon">${icon('spark')}</div>
      <div class="dashboard-empty__copy">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
      </div>
      ${actionLabel && actionKey ? `<button class="primary-action" type="button" data-quick-action="${escapeHtml(actionKey)}">${escapeHtml(actionLabel)}</button>` : ''}
    </div>
  `;
}

function statsMarkup(state) {
  const upcomingCount = state.dashboardData?.upcoming?.length || 0;
  const previousCount = state.dashboardData?.previous?.length || 0;
  const recordingCount = state.dashboardData?.recordings?.length || 0;
  const personalMeeting = state.personalRoom || state.dashboardData?.personal?.[0] || null;
  return `
    <section class="dashboard-stat-grid">
      <article class="dashboard-stat-card">
        <span>${icon('calendar')}</span>
        <strong>${countLabel(upcomingCount, 'upcoming meeting')}</strong>
        <p>Your next scheduled sessions.</p>
      </article>
      <article class="dashboard-stat-card">
        <span>${icon('history')}</span>
        <strong>${countLabel(previousCount, 'previous meeting')}</strong>
        <p>Ended sessions in your recent history.</p>
      </article>
      <article class="dashboard-stat-card">
        <span>${icon('recording')}</span>
        <strong>${countLabel(recordingCount, 'recording')}</strong>
        <p>Meeting captures saved for replay.</p>
      </article>
      <article class="dashboard-stat-card">
        <span>${icon('personal')}</span>
        <strong>${escapeHtml(personalMeeting ? statusLabel(personalMeeting) : 'Not created')}</strong>
        <p>${escapeHtml(personalMeeting ? personalMeeting.title : 'Create your personal room for instant access.')}</p>
      </article>
    </section>
  `;
}

function homeMarkup(state) {
  const recentMeetings = state.dashboardData?.owned?.slice(0, 3) || [];
  const nextMeeting = state.dashboardData?.upcoming?.[0] || null;
  return `
    <section class="dashboard-hero">
      <div class="dashboard-hero__copy">
        <span class="dashboard-kicker">Zoom-style command center</span>
        <h1>Meet faster, schedule ahead, and keep every room one click away.</h1>
        <p>Run instant meetings, manage your upcoming calendar, keep your personal room ready, and jump back into earlier sessions.</p>
      </div>
      <div class="dashboard-action-grid">
        <button class="dashboard-action-card dashboard-action-card--primary" type="button" data-quick-action="instant">
          <span class="dashboard-action-card__icon">${icon('plus')}</span>
          <strong>New meeting</strong>
          <p>Start an instant room with your current defaults.</p>
        </button>
        <button class="dashboard-action-card" type="button" data-quick-action="schedule">
          <span class="dashboard-action-card__icon">${icon('schedule')}</span>
          <strong>Schedule</strong>
          <p>Create a meeting for later and share the link.</p>
        </button>
        <button class="dashboard-action-card" type="button" data-quick-action="join-focus">
          <span class="dashboard-action-card__icon">${icon('link')}</span>
          <strong>Join with code</strong>
          <p>Open a meeting or personal room from a link or code.</p>
        </button>
        <button class="dashboard-action-card" type="button" data-quick-action="personal">
          <span class="dashboard-action-card__icon">${icon('personal')}</span>
          <strong>Personal room</strong>
          <p>Create or refresh your always-on room.</p>
        </button>
      </div>
    </section>
    ${statsMarkup(state)}
    <section class="dashboard-home-grid">
      <div class="dashboard-panel dashboard-panel--wide">
        <div class="dashboard-panel__header">
          <div>
            <h2>Quick join</h2>
            <p>Paste a meeting code, room ID, or link.</p>
          </div>
        </div>
        <form id="dashboardJoinForm" class="dashboard-stack-form" novalidate>
          <label class="input-group">
            <span>Meeting code or URL</span>
            <input id="dashboardJoinInput" value="${escapeHtml(state.joinCode || '')}" placeholder="meet-12345 or /meeting/meet-12345" />
          </label>
          <div class="dashboard-inline-actions">
            <button class="primary-action" type="submit">Open pre-join</button>
          </div>
        </form>
      </div>
      <div class="dashboard-panel">
        <div class="dashboard-panel__header">
          <div>
            <h2>Schedule a meeting</h2>
            <p>Pick a title and time for your next session.</p>
          </div>
        </div>
        <form id="scheduleMeetingForm" class="dashboard-stack-form" novalidate>
          <label class="input-group">
            <span>Meeting title</span>
            <input id="scheduleTitleInput" maxlength="90" value="${escapeHtml(state.scheduleDraft?.title || '')}" placeholder="Weekly design review" />
          </label>
          <label class="input-group">
            <span>Description</span>
            <textarea id="scheduleDescriptionInput" rows="3" placeholder="Agenda and context">${escapeHtml(state.scheduleDraft?.description || '')}</textarea>
          </label>
          <label class="input-group">
            <span>Starts at</span>
            <input id="scheduleDateInput" type="datetime-local" value="${escapeHtml(state.scheduleDraft?.startsAt || '')}" />
          </label>
          <label class="input-group">
            <span>Breakout rooms</span>
            <input id="scheduleBreakoutInput" type="number" min="1" max="20" step="1" value="${escapeHtml(String(normalizeBreakoutRoomCount(state.scheduleDraft?.breakoutRoomCount || state.breakoutRoomCount, state.breakoutRoomCount)))}" />
          </label>
          <div class="dashboard-inline-actions">
            <button class="primary-action" type="submit">Save meeting</button>
          </div>
        </form>
      </div>
    </section>
    <section class="dashboard-home-grid">
      <div class="dashboard-panel dashboard-panel--wide">
        <div class="dashboard-panel__header">
          <div>
            <h2>Recent rooms</h2>
            <p>Open the meetings you use most often.</p>
          </div>
          <button class="secondary-action" type="button" data-nav="upcoming">View upcoming</button>
        </div>
        <div class="dashboard-list">
          ${recentMeetings.length ? recentMeetings.map(meetingCardMarkup).join('') : emptyStateMarkup('No meetings yet', 'Create an instant or scheduled meeting to get started.', 'New meeting', 'instant')}
        </div>
      </div>
      <div class="dashboard-panel">
        <div class="dashboard-panel__header">
          <div>
            <h2>Next meeting</h2>
            <p>Your closest scheduled session.</p>
          </div>
        </div>
        ${nextMeeting ? meetingCardMarkup(nextMeeting) : emptyStateMarkup('Nothing scheduled', 'Create a scheduled meeting so it shows up here.', 'Schedule meeting', 'schedule')}
      </div>
    </section>
  `;
}

function meetingsListMarkup(items, emptyTitle, emptyDescription, emptyActionLabel, emptyActionKey) {
  if (!items.length) {
    return emptyStateMarkup(emptyTitle, emptyDescription, emptyActionLabel, emptyActionKey);
  }
  return `<div class="dashboard-list">${items.map(meetingCardMarkup).join('')}</div>`;
}

function previousListMarkup(items) {
  if (!items.length) {
    return emptyStateMarkup('No previous meetings', 'Ended sessions will appear here after you leave or end them.');
  }
  return `<div class="dashboard-list">${items.map(sessionCardMarkup).join('')}</div>`;
}

function recordingsListMarkup(items) {
  if (!items.length) {
    return emptyStateMarkup('No recordings yet', 'Recordings will appear here when you save session captures.');
  }
  return `<div class="dashboard-list">${items.map(recordingCardMarkup).join('')}</div>`;
}

function personalMarkup(state) {
  const personalMeeting = state.personalRoom || state.dashboardData?.personal?.[0] || null;
  return `
    <section class="dashboard-home-grid dashboard-home-grid--personal">
      <div class="dashboard-panel dashboard-panel--wide">
        <div class="dashboard-panel__header">
          <div>
            <h2>Your personal room</h2>
            <p>Keep one permanent room ready for instant drop-ins.</p>
          </div>
        </div>
        ${personalMeeting ? meetingCardMarkup(personalMeeting) : emptyStateMarkup('Create your personal room', 'Once created, you can reuse the same room link anytime.', 'Create personal room', 'personal')}
      </div>
      <div class="dashboard-panel">
        <div class="dashboard-panel__header">
          <div>
            <h2>Room settings</h2>
            <p>Update the basics of your room.</p>
          </div>
        </div>
        <form id="personalRoomForm" class="dashboard-stack-form" novalidate>
          <label class="input-group">
            <span>Room title</span>
            <input id="personalRoomTitleInput" maxlength="90" value="${escapeHtml(personalMeeting?.title || `${normalizeName(state.displayName || 'Guest')}'s personal room`)}" />
          </label>
          <label class="input-group">
            <span>Description</span>
            <textarea id="personalRoomDescriptionInput" rows="3" placeholder="What this room is for">${escapeHtml(personalMeeting?.description || '')}</textarea>
          </label>
          <label class="input-group">
            <span>Breakout rooms</span>
            <input id="personalRoomBreakoutInput" type="number" min="1" max="20" step="1" value="${escapeHtml(String(normalizeBreakoutRoomCount(personalMeeting?.breakoutRoomCount || state.breakoutRoomCount, state.breakoutRoomCount)))}" />
          </label>
          <div class="dashboard-inline-actions">
            <button class="primary-action" type="submit">${personalMeeting ? 'Save room' : 'Create room'}</button>
            ${personalMeeting ? `<button class="secondary-action" type="button" data-open-meeting="${escapeHtml(personalMeeting.id)}">Open room</button>` : ''}
          </div>
        </form>
      </div>
    </section>
  `;
}

function pageBodyMarkup(state, page) {
  if (page === 'home') {
    return homeMarkup(state);
  }
  if (page === 'upcoming') {
    return meetingsListMarkup(state.dashboardData?.upcoming || [], 'No upcoming meetings', 'Schedule a meeting and it will appear here.', 'Schedule meeting', 'schedule');
  }
  if (page === 'previous') {
    return previousListMarkup(state.dashboardData?.previous || []);
  }
  if (page === 'recordings') {
    return recordingsListMarkup(state.dashboardData?.recordings || []);
  }
  return personalMarkup(state);
}

function prejoinRoomOptions(state, meeting) {
  if (Array.isArray(state.customRooms) && state.customRooms.length) {
    return state.customRooms
      .map((room, index) => {
        const id = normalizeRoomId(room?.id || room?.roomId || '');

        if (!id) {
          return null;
        }

        return {
          description: String(room?.description || (index === 0 ? 'Join the full-group conversation first.' : `Join ${room?.label || `Room ${index + 1}`} directly.`)).trim(),
          id,
          label: String(room?.label || (index === 0 ? 'Main room' : `Room ${index + 1}`)).trim() || (index === 0 ? 'Main room' : `Room ${index + 1}`)
        };
      })
      .filter(Boolean);
  }

  const baseMeetingId = normalizeRoomId(meeting?.id || state.meetingId || state.prejoinRoomId || state.roomId || 'main-room');
  const breakoutCount = normalizeBreakoutRoomCount(meeting?.breakoutRoomCount ?? state.breakoutRoomCount, state.breakoutRoomCount);

  return [
    {
      description: 'Join the full-group conversation first.',
      id: baseMeetingId,
      label: 'Main room'
    },
    ...Array.from({ length: breakoutCount }, (_, index) => ({
      description: `Join Room ${index + 1} directly.`,
      id: `${baseMeetingId}-room-${index + 1}`,
      label: `Room ${index + 1}`
    }))
  ];
}

export function renderDashboardView({ root, state, onNavigate, onDisplayNameChange, onCreateInstantMeeting, onScheduleMeeting, onJoinCode, onEnsurePersonalRoom, onOpenMeeting, onCopyMeetingLink }) {
  document.body.classList.remove('body--meeting');
  document.body.classList.add('body--dashboard');

  const page = pageMeta[state.dashboardPage] ? state.dashboardPage : 'home';
  const meta = pageMeta[page];
  root.innerHTML = `
    <div class="dashboard-shell">
      <aside class="dashboard-sidebar">
        <div class="dashboard-sidebar__brand">
          <span class="dashboard-brand-mark">${icon('spark')}</span>
          <div>
            <strong>InfoVibeX Meet</strong>
            <span>Zoom-style workspace</span>
          </div>
        </div>
        <div class="dashboard-profile-card">
          <span class="dashboard-profile-card__avatar">${escapeHtml(getInitials(state.displayName || 'Guest'))}</span>
          <form id="displayNameForm" class="dashboard-profile-card__form" novalidate>
            <label class="input-group">
              <span>Your name</span>
              <input id="displayNameDashboardInput" maxlength="40" value="${escapeHtml(normalizeName(state.displayName || 'Guest'))}" />
            </label>
            <button class="secondary-action" type="submit">Save profile</button>
          </form>
        </div>
        <nav class="dashboard-nav">
          ${navMarkup(page)}
        </nav>
      </aside>
      <main class="dashboard-main">
        <header class="dashboard-topbar">
          <div>
            <span class="dashboard-kicker">${escapeHtml(meta.label)}</span>
            <h1>${escapeHtml(meta.title)}</h1>
            <p>${escapeHtml(meta.description)}</p>
          </div>
          <div class="dashboard-topbar__status${state.dashboardLoading ? ' is-loading' : ''}">
            <span>${icon('spark')}</span>
            <strong>${escapeHtml(state.dashboardLoading ? 'Refreshing meetings' : state.dashboardError ? state.dashboardError : 'Everything is synced')}</strong>
          </div>
        </header>
        <section class="dashboard-page-body">
          ${pageBodyMarkup(state, page)}
        </section>
      </main>
    </div>
  `;

  root.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => onNavigate(button.getAttribute('data-nav') || 'home'));
  });

  root.querySelectorAll('[data-quick-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-quick-action') || '';
      if (action === 'instant') {
        onCreateInstantMeeting();
      } else if (action === 'schedule') {
        document.getElementById('scheduleTitleInput')?.focus();
      } else if (action === 'join-focus') {
        document.getElementById('dashboardJoinInput')?.focus();
      } else if (action === 'personal') {
        onNavigate('personal');
      }
    });
  });

  root.querySelectorAll('[data-open-meeting]').forEach((button) => {
    button.addEventListener('click', () => onOpenMeeting(button.getAttribute('data-open-meeting') || ''));
  });

  root.querySelectorAll('[data-copy-link]').forEach((button) => {
    button.addEventListener('click', () => onCopyMeetingLink(button.getAttribute('data-copy-link') || ''));
  });

  const displayNameForm = document.getElementById('displayNameForm');
  displayNameForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    onDisplayNameChange(document.getElementById('displayNameDashboardInput')?.value || '');
  });

  const joinForm = document.getElementById('dashboardJoinForm');
  joinForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    onJoinCode(document.getElementById('dashboardJoinInput')?.value || '');
  });

  const scheduleForm = document.getElementById('scheduleMeetingForm');
  scheduleForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    onScheduleMeeting({
      title: document.getElementById('scheduleTitleInput')?.value || '',
      description: document.getElementById('scheduleDescriptionInput')?.value || '',
      startsAt: document.getElementById('scheduleDateInput')?.value || '',
      breakoutRoomCount: document.getElementById('scheduleBreakoutInput')?.value || ''
    });
  });

  const personalForm = document.getElementById('personalRoomForm');
  personalForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    onEnsurePersonalRoom({
      title: document.getElementById('personalRoomTitleInput')?.value || '',
      description: document.getElementById('personalRoomDescriptionInput')?.value || '',
      breakoutRoomCount: document.getElementById('personalRoomBreakoutInput')?.value || ''
    });
  });
}

export function renderPrejoinView({ root, state, onToggleMic, onToggleCamera, onBack, onJoin, onCopyMeetingLink, onRoomChange }) {
  document.body.classList.remove('body--meeting', 'body--dashboard');

  const isBlocked = Boolean(state.prejoinJoinBlock);
  const blockMessage = state.prejoinJoinBlock?.message || '';
  const blockCode = state.prejoinJoinBlock?.code || '';

  root.innerHTML = `
    <div class="prejoin-shell">
      <div class="pj-card">
        <div class="pj-hero">
          <h1 class="pj-title">Join Meeting</h1>
          <p class="pj-subtitle">${state.connectionStatus && state.connectionStatus !== 'Preparing meeting' && state.connectionStatus !== 'Ready to join' ? esc(state.connectionStatus) : 'Ready to connect'}</p>
        </div>

        <div class="pj-preview-wrapper">
          <div class="pj-preview" id="prejoinPreviewSurface"></div>
        </div>

        <div class="pj-controls">
          <button class="pj-btn${state.isAudioEnabled ? ' pj-btn--on' : ''}" id="prejoinMicButton" type="button">
            ${icon(state.isAudioEnabled ? 'mic' : 'micOff')}
            <span>${state.isAudioEnabled ? 'Mic on' : 'Mic off'}</span>
          </button>
          <button class="pj-btn${state.isVideoEnabled ? ' pj-btn--on' : ''}" id="prejoinCameraButton" type="button">
            ${icon(state.isVideoEnabled ? 'camera' : 'cameraOff')}
            <span>${state.isVideoEnabled ? 'Camera on' : 'Camera off'}</span>
          </button>
        </div>

        ${isBlocked ? `
        <div class="pj-alert pj-alert--${blockCode === 'waiting-for-approval' ? 'warning' : 'danger'}">
          <strong>${esc(blockMessage || 'Cannot join')}</strong>
          ${blockCode === 'waiting-for-approval' ? '<p>Waiting for host approval.</p>' : ''}
        </div>
        ` : ''}

        ${state.prejoinError ? `
        <div class="pj-alert pj-alert--danger">
          <strong>Connection error</strong>
          <p>${esc(state.prejoinError)}</p>
        </div>
        ` : ''}

        <button class="pj-join" id="prejoinJoinButton" type="button" ${isBlocked || state.prejoinBusy ? 'disabled' : ''}>
          ${state.prejoinBusy ? 'Connecting…' : 'Join'}
        </button>
      </div>
    </div>
  `;

  document.getElementById('prejoinMicButton')?.addEventListener('click', onToggleMic);
  document.getElementById('prejoinCameraButton')?.addEventListener('click', onToggleCamera);

  const joinButton = document.getElementById('prejoinJoinButton');
  if (joinButton && onJoin) {
    joinButton.addEventListener('click', () => {
      if (!isBlocked && !state.prejoinBusy) {
        onJoin();
      }
    });
  }

  return {
    previewSurface: document.getElementById('prejoinPreviewSurface')
  };
}
