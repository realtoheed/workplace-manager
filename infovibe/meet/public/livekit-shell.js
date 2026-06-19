import { icon } from '/livekit-icons.js';

export function renderShellView({ root, onCopyInvite, onToggleMic, onToggleCamera, onToggleScreen, onToggleHand, onToggleLayout, onToggleStats, onToggleSidebar, onOpenSettings, onCloseSettings, onChangeScreenShareQuality, onToggleRecording, onOpenBreakoutModal, onExpandAllBreakouts, onCollapseAllBreakouts, onLeave, onEndMeeting, onCloseBreakoutModal, onSendChat, onChatFilesChange }) {
  document.body.classList.add('body--meeting');
  root.innerHTML = `
    <div class="meeting-shell meeting-shell--livekit">
      <div class="meeting-backdrop meeting-backdrop--one"></div>
      <div class="meeting-backdrop meeting-backdrop--two"></div>
      <div class="zoom-shell">
        <header class="zoom-header">
          <div class="zoom-header__brand"><span class="brand-pill">InfoVibeX Meet</span><div class="zoom-header__copy"><strong id="headerName"></strong><span id="headerRoom"></span></div></div>
          <div class="zoom-header__tabs" id="screenTabs"></div>
          <div class="zoom-header__actions"><span class="zoom-pill" id="connectionPill"></span><span class="zoom-pill" id="participantCountPill"></span><span class="zoom-pill zoom-pill--recording is-hidden" id="recordingPill"></span><button class="zoom-header__icon-button" id="copyInviteButton" type="button">${icon('copy')}</button><button class="zoom-header__icon-button" id="headerLayoutButton" type="button">${icon('layout')}</button><button class="zoom-header__icon-button" id="headerStatsButton" type="button">${icon('stats')}</button><button class="zoom-header__icon-button" id="headerSettingsButton" type="button">${icon('settings')}</button></div>
        </header>
        <div class="zoom-main">
          <section class="zoom-stage"><div class="zoom-stage__surface" id="stageSurface"></div><div class="zoom-stage__overlay"><div class="zoom-stage__meta" id="stageMeta"><h2 id="stageTitle"></h2><p id="stageSubtitle"></p></div><span class="zoom-pill zoom-pill--accent" id="stageBadge"></span></div></section>
          <aside class="livekit-sidebar is-hidden" id="sidebar"><div class="livekit-sidebar__header"><div><h3 id="sidebarTitle"></h3><p id="sidebarSubtitle"></p></div><div class="livekit-sidebar__tabs"><button class="sidebar-switch" data-sidebar="participants" type="button">${icon('users')}</button><button class="sidebar-switch" data-sidebar="chat" type="button">${icon('chat')}</button><button class="sidebar-switch" data-sidebar="stats" type="button">${icon('stats')}</button><button class="sidebar-switch" id="closeSidebarButton" type="button">${icon('close')}</button></div></div><div class="livekit-sidebar__body" id="sidebarBody"></div><form class="livekit-chat-form is-hidden" id="chatForm"><div class="livekit-pending-files" id="pendingFiles"></div><div class="livekit-chat-form__row"><label class="livekit-attach-button" for="chatFileInput">${icon('attach')}</label><input id="chatInput" maxlength="600" placeholder="Send a message" /><button class="zoom-send-button" type="submit">Send</button></div><input id="chatFileInput" type="file" hidden multiple /></form></aside>
          <footer class="zoom-toolbar"><button class="zoom-toolbar__button" id="micButton" type="button"></button><button class="zoom-toolbar__button" id="cameraButton" type="button"></button><button class="zoom-toolbar__button" id="screenButton" type="button"></button><button class="zoom-toolbar__button" id="handButton" type="button"></button><button class="zoom-toolbar__button" id="layoutButton" type="button"></button><button class="zoom-toolbar__button" id="participantsButton" type="button"></button><button class="zoom-toolbar__button" id="chatButton" type="button"></button><button class="zoom-toolbar__button" id="statsButton" type="button"></button><button class="zoom-toolbar__button" id="settingsButton" type="button"></button><button class="zoom-toolbar__button is-hidden" id="recordButton" type="button"></button><button class="zoom-toolbar__button" id="roomsButton" type="button"></button><button class="zoom-toolbar__button zoom-toolbar__button--danger is-hidden" id="endMeetingButton" type="button"></button><button class="zoom-toolbar__button zoom-toolbar__button--danger" id="leaveButton" type="button"></button></footer>
        </div>
        <div class="zoom-modal" id="breakoutModal"><div class="zoom-modal__card zoom-modal__card--breakouts"><div class="zoom-modal__header"><div><h3>Breakout rooms</h3><p>Join another room without leaving the meeting.</p></div><button class="zoom-header__icon-button" id="closeBreakoutButton" type="button">${icon('close')}</button></div><div class="zoom-breakout-summary"><div class="zoom-breakout-summary__meta"><span class="zoom-pill" id="breakoutRoomCount"></span><span class="zoom-breakout-summary__hint">Choose where you want to go next.</span></div><span class="zoom-breakout-summary__current" id="breakoutCurrentRoom"></span></div><div class="zoom-breakout-list" id="breakoutList"></div><div class="zoom-breakout-footer"><button class="secondary-action zoom-breakout-footer__action" id="collapseBreakoutRoomsButton" type="button">Collapse all</button><button class="secondary-action zoom-breakout-footer__action" id="expandBreakoutRoomsButton" type="button">Expand all</button></div></div></div>
        <div class="zoom-modal" id="settingsModal"><div class="zoom-modal__card zoom-modal__card--settings"><div class="zoom-modal__header"><div><h3>Meeting settings</h3><p>Pick the default quality for your next screen share.</p></div><button class="zoom-header__icon-button" id="closeSettingsButton" type="button">${icon('close')}</button></div><div class="zoom-settings-list"><label class="zoom-settings-field"><span>Screen share quality</span><select id="screenQualitySelect"><option value="4k">4K 2160p · 30 fps</option><option value="1440p">2K 1440p · 30 fps</option><option value="hd">HD 1080p · 30 fps</option><option value="720p">720p · 30 fps</option></select><small>Changes apply the next time you start sharing.</small></label><div class="zoom-settings-note">Host recordings capture the active stage plus mixed meeting audio in your browser, then upload the final WebM file to InfoVibe Meet storage.</div></div></div></div>
        <div class="zoom-audio-sinks" id="audioSinks"></div>
      </div>
    </div>`;
  const ui = {
    headerName: document.getElementById('headerName'),
    headerRoom: document.getElementById('headerRoom'),
    connectionPill: document.getElementById('connectionPill'),
    participantCountPill: document.getElementById('participantCountPill'),
    recordingPill: document.getElementById('recordingPill'),
    screenTabs: document.getElementById('screenTabs'),
    copyInviteButton: document.getElementById('copyInviteButton'),
    headerLayoutButton: document.getElementById('headerLayoutButton'),
    headerStatsButton: document.getElementById('headerStatsButton'),
    headerSettingsButton: document.getElementById('headerSettingsButton'),
    stage: document.querySelector('.zoom-stage'),
    stageSurface: document.getElementById('stageSurface'),
    stageMeta: document.getElementById('stageMeta'),
    stageTitle: document.getElementById('stageTitle'),
    stageSubtitle: document.getElementById('stageSubtitle'),
    stageBadge: document.getElementById('stageBadge'),
    sidebar: document.getElementById('sidebar'),
    sidebarTitle: document.getElementById('sidebarTitle'),
    sidebarSubtitle: document.getElementById('sidebarSubtitle'),
    sidebarBody: document.getElementById('sidebarBody'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    chatFileInput: document.getElementById('chatFileInput'),
    pendingFiles: document.getElementById('pendingFiles'),
    micButton: document.getElementById('micButton'),
    cameraButton: document.getElementById('cameraButton'),
    screenButton: document.getElementById('screenButton'),
    handButton: document.getElementById('handButton'),
    layoutButton: document.getElementById('layoutButton'),
    participantsButton: document.getElementById('participantsButton'),
    chatButton: document.getElementById('chatButton'),
    statsButton: document.getElementById('statsButton'),
    settingsButton: document.getElementById('settingsButton'),
    recordButton: document.getElementById('recordButton'),
    roomsButton: document.getElementById('roomsButton'),
    endMeetingButton: document.getElementById('endMeetingButton'),
    leaveButton: document.getElementById('leaveButton'),
    closeSidebarButton: document.getElementById('closeSidebarButton'),
    breakoutModal: document.getElementById('breakoutModal'),
    closeBreakoutButton: document.getElementById('closeBreakoutButton'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsButton: document.getElementById('closeSettingsButton'),
    screenQualitySelect: document.getElementById('screenQualitySelect'),
    breakoutRoomCount: document.getElementById('breakoutRoomCount'),
    breakoutCurrentRoom: document.getElementById('breakoutCurrentRoom'),
    breakoutList: document.getElementById('breakoutList'),
    collapseBreakoutRoomsButton: document.getElementById('collapseBreakoutRoomsButton'),
    expandBreakoutRoomsButton: document.getElementById('expandBreakoutRoomsButton'),
    audioSinks: document.getElementById('audioSinks'),
    sidebarSwitches: Array.from(document.querySelectorAll('[data-sidebar]'))
  };
  bindShellUi(ui, { onCopyInvite, onToggleMic, onToggleCamera, onToggleScreen, onToggleHand, onToggleLayout, onToggleStats, onToggleSidebar, onOpenSettings, onCloseSettings, onChangeScreenShareQuality, onToggleRecording, onOpenBreakoutModal, onExpandAllBreakouts, onCollapseAllBreakouts, onLeave, onEndMeeting, onCloseBreakoutModal, onSendChat, onChatFilesChange });
  return ui;
}

function bindShellUi(ui, handlers) {
  ui.copyInviteButton.addEventListener('click', handlers.onCopyInvite);
  ui.headerLayoutButton.addEventListener('click', handlers.onToggleLayout);
  ui.headerStatsButton.addEventListener('click', handlers.onToggleStats);
  ui.headerSettingsButton.addEventListener('click', handlers.onOpenSettings);
  ui.micButton.addEventListener('click', handlers.onToggleMic);
  ui.cameraButton.addEventListener('click', handlers.onToggleCamera);
  ui.screenButton.addEventListener('click', function() {
    console.log('screenButton clicked, calling onToggleScreen');
    handlers.onToggleScreen();
  });
  ui.handButton.addEventListener('click', handlers.onToggleHand);
  ui.layoutButton.addEventListener('click', handlers.onToggleLayout);
  ui.participantsButton.addEventListener('click', () => handlers.onToggleSidebar('participants'));
  ui.chatButton.addEventListener('click', () => handlers.onToggleSidebar('chat'));
  ui.statsButton.addEventListener('click', handlers.onToggleStats);
  ui.settingsButton.addEventListener('click', handlers.onOpenSettings);
  ui.recordButton.addEventListener('click', handlers.onToggleRecording);
  ui.roomsButton.addEventListener('click', handlers.onOpenBreakoutModal);
  ui.endMeetingButton.addEventListener('click', handlers.onEndMeeting);
  ui.leaveButton.addEventListener('click', handlers.onLeave);
  ui.closeSidebarButton.addEventListener('click', () => handlers.onToggleSidebar(null));
  ui.closeBreakoutButton.addEventListener('click', handlers.onCloseBreakoutModal);
  ui.closeSettingsButton.addEventListener('click', handlers.onCloseSettings);
  ui.breakoutModal.addEventListener('click', (event) => {
    if (event.target === ui.breakoutModal) handlers.onCloseBreakoutModal();
  });
  ui.settingsModal.addEventListener('click', (event) => {
    if (event.target === ui.settingsModal) handlers.onCloseSettings();
  });
  ui.collapseBreakoutRoomsButton?.addEventListener('click', handlers.onCollapseAllBreakouts);
  ui.expandBreakoutRoomsButton?.addEventListener('click', handlers.onExpandAllBreakouts);
  for (const item of ui.sidebarSwitches) {
    item.addEventListener('click', () => handlers.onToggleSidebar(item.getAttribute('data-sidebar')));
  }
  ui.screenQualitySelect.addEventListener('change', (event) => {
    handlers.onChangeScreenShareQuality(event.target.value);
  });
  ui.chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onSendChat();
  });
  ui.chatFileInput.addEventListener('change', async (event) => {
    await handlers.onChatFilesChange(event.target.files);
    ui.chatFileInput.value = '';
  });
}
