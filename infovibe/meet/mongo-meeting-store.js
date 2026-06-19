const { randomUUID } = require('crypto');
const { MongoClient } = require('mongodb');

function createId(prefix) {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function stripMongoId(document) {
  if (!document) {
    return null;
  }
  const nextDocument = { ...document };
  delete nextDocument._id;
  return nextDocument;
}

function createMeetingStore({ mongoUrl, dbName }) {
  const connectionString = String(mongoUrl || '').trim();
  const databaseName = String(dbName || '').trim() || 'infovibex_meet';

  if (!connectionString) {
    throw new Error('MongoDB connection string is required');
  }

  const client = new MongoClient(connectionString, {
    ignoreUndefined: true
  });

  let connectPromise = null;
  let connected = false;
  let meetings = null;
  let sessions = null;
  let recordings = null;

  async function connect() {
    if (connectPromise) {
      return connectPromise;
    }

    connectPromise = (async () => {
      await client.connect();
      const database = client.db(databaseName);
      meetings = database.collection('meetings');
      sessions = database.collection('sessions');
      recordings = database.collection('recordings');

      await Promise.all([
        meetings.createIndex({ id: 1 }, { unique: true }),
        meetings.createIndex({ hostProfileId: 1, type: 1 }),
        meetings.createIndex({ updatedAt: -1 }),
        meetings.createIndex({ startsAt: 1 }),
        sessions.createIndex({ id: 1 }, { unique: true }),
        sessions.createIndex({ hostProfileId: 1, endedAt: -1 }),
        sessions.createIndex({ meetingId: 1, endedAt: 1 }),
        recordings.createIndex({ id: 1 }, { unique: true }),
        recordings.createIndex({ hostProfileId: 1, createdAt: -1 })
      ]);

      connected = true;
    })().catch((error) => {
      connectPromise = null;
      connected = false;
      meetings = null;
      sessions = null;
      recordings = null;
      throw error;
    });

    return connectPromise;
  }

  async function ensureReady() {
    if (!connectPromise) {
      await connect();
      return;
    }
    await connectPromise;
  }

  async function getMeeting(meetingId) {
    await ensureReady();
    return stripMongoId(await meetings.findOne({ id: String(meetingId || '') }));
  }

  async function upsertMeeting(meeting) {
    await ensureReady();
    const id = String(meeting?.id || '').trim();

    if (!id) {
      throw new Error('Meeting id is required');
    }

    const currentMeeting = await getMeeting(id) || {};
    const nextMeeting = {
      ...currentMeeting,
      ...meeting,
      id,
      updatedAt: meeting.updatedAt || new Date().toISOString()
    };

    await meetings.replaceOne({ id }, nextMeeting, { upsert: true });
    return nextMeeting;
  }

  async function ensureMeeting(meeting) {
    const existingMeeting = await getMeeting(meeting?.id);
    return existingMeeting || upsertMeeting(meeting);
  }

  async function removeMeeting(meetingId) {
    await ensureReady();
    await meetings.deleteOne({ id: String(meetingId || '') });
  }

  async function getPersonalRoom(hostProfileId) {
    await ensureReady();
    return stripMongoId(await meetings.findOne({
      type: 'personal',
      hostProfileId: String(hostProfileId || '')
    }));
  }

  async function ensurePersonalRoom({ hostProfileId, roomId, title, description, breakoutRoomCount, hostParticipantId, hostName }) {
    const existingMeeting = await getPersonalRoom(hostProfileId);

    if (existingMeeting) {
      return upsertMeeting({
        ...existingMeeting,
        roomId,
        title,
        description,
        breakoutRoomCount,
        hostParticipantId,
        hostName
      });
    }

    return upsertMeeting({
      id: roomId,
      roomId,
      type: 'personal',
      title,
      description,
      breakoutRoomCount,
      createdAt: new Date().toISOString(),
      startsAt: '',
      endedAt: '',
      activeSessionId: '',
      hostProfileId,
      hostParticipantId,
      hostName,
      status: 'available'
    });
  }

  async function getSession(sessionId) {
    await ensureReady();
    return stripMongoId(await sessions.findOne({ id: String(sessionId || '') }));
  }

  async function ensureActiveSession({ meetingId, roomId, title, type, hostProfileId, hostParticipantId, hostName }) {
    const meeting = await getMeeting(meetingId);

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const activeSession = meeting.activeSessionId ? await getSession(meeting.activeSessionId) : null;
    if (activeSession && !activeSession.endedAt) {
      return activeSession;
    }

    const session = {
      id: createId('session'),
      meetingId,
      roomId,
      title,
      type,
      hostProfileId,
      hostParticipantId,
      hostName,
      startedAt: new Date().toISOString(),
      endedAt: ''
    };

    await sessions.replaceOne({ id: session.id }, session, { upsert: true });
    await upsertMeeting({
      ...meeting,
      activeSessionId: session.id,
      status: 'active',
      lastStartedAt: session.startedAt,
      endedAt: type === 'personal' ? meeting.endedAt || '' : ''
    });

    return session;
  }

  async function endActiveSession(meetingId, fields = {}) {
    const meeting = await getMeeting(meetingId);

    if (!meeting?.activeSessionId) {
      return null;
    }

    const endedAt = fields.endedAt || new Date().toISOString();
    const session = await getSession(meeting.activeSessionId);

    if (!session) {
      await upsertMeeting({
        ...meeting,
        activeSessionId: '',
        status: meeting.type === 'personal' ? 'available' : 'ended',
        endedAt,
        endedByParticipantId: fields.endedByParticipantId || meeting.endedByParticipantId || '',
        endedByProfileId: fields.endedByProfileId || meeting.endedByProfileId || ''
      });
      return null;
    }

    const nextSession = {
      ...session,
      ...fields,
      endedAt
    };

    await sessions.replaceOne({ id: nextSession.id }, nextSession, { upsert: true });
    await upsertMeeting({
      ...meeting,
      activeSessionId: '',
      status: meeting.type === 'personal' ? 'available' : 'ended',
      endedAt,
      endedByParticipantId: fields.endedByParticipantId || meeting.endedByParticipantId || '',
      endedByProfileId: fields.endedByProfileId || meeting.endedByProfileId || ''
    });

    return nextSession;
  }

  async function listUpcomingMeetings(hostProfileId) {
    await ensureReady();
    const nowIso = new Date().toISOString();
    return (await meetings.find({
      hostProfileId: String(hostProfileId || ''),
      type: { $ne: 'personal' },
      startsAt: { $gt: nowIso },
      status: { $ne: 'ended' }
    }).sort({ startsAt: 1 }).toArray()).map(stripMongoId);
  }

  async function listPreviousSessions(hostProfileId) {
    await ensureReady();
    return (await sessions.find({
      hostProfileId: String(hostProfileId || ''),
      endedAt: { $ne: '' }
    }).sort({ endedAt: -1 }).toArray()).map(stripMongoId);
  }

  async function listRecordings(hostProfileId) {
    await ensureReady();
    return (await recordings.find({
      hostProfileId: String(hostProfileId || '')
    }).sort({ createdAt: -1 }).toArray()).map(stripMongoId);
  }

  async function getRecording(recordingId) {
    await ensureReady();
    const recording = await recordings.findOne({
      id: String(recordingId || '')
    });
    return stripMongoId(recording);
  }

  async function addRecording(recording) {
    await ensureReady();
    const nextRecording = {
      id: recording.id || createId('recording'),
      createdAt: recording.createdAt || new Date().toISOString(),
      ...recording
    };

    await recordings.replaceOne({ id: nextRecording.id }, nextRecording, { upsert: true });
    return nextRecording;
  }

  async function listOwnedMeetings(hostProfileId) {
    await ensureReady();
    return (await meetings.find({
      hostProfileId: String(hostProfileId || '')
    }).sort({ updatedAt: -1 }).toArray()).map(stripMongoId);
  }

  async function flushNow() {
    await ensureReady();
  }

  async function close() {
    if (!connectPromise) {
      return;
    }

    try {
      await connectPromise;
    } catch {}

    connectPromise = null;
    connected = false;
    meetings = null;
    sessions = null;
    recordings = null;
    await client.close();
  }

  function isConnected() {
    return connected;
  }

  return {
    addRecording,
    close,
    connect,
    endActiveSession,
    ensureActiveSession,
    ensureMeeting,
    ensurePersonalRoom,
    flushNow,
    getMeeting,
    getRecording,
    getPersonalRoom,
    isConnected,
    listOwnedMeetings,
    listPreviousSessions,
    listRecordings,
    listUpcomingMeetings,
    removeMeeting,
    upsertMeeting
  };
}

module.exports = {
  createMeetingStore
};
