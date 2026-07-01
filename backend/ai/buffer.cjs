
const BASE_URL = 'https://api.bufferapp.com/1';
const ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN;

const assertToken = () => {
  if (!ACCESS_TOKEN) {
    throw new Error('BUFFER_ACCESS_TOKEN is not set');
  }
};

const getProfiles = async () => {
  assertToken();
  const url = `${BASE_URL}/profiles.json?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${text}`);
  }
  const data = JSON.parse(text);
  const profiles = Array.isArray(data)
    ? data.map(({ id, service, service_username }) => ({ id, service, service_username }))
    : [];
  console.log(`Fetched ${profiles.length} profiles`);
  return profiles;
};

const createPost = async ({ profileIds, text, mediaUrl, scheduledAt }) => {
  assertToken();
  const url = `${BASE_URL}/updates/create.json`;
  const body = new URLSearchParams();
  body.append('access_token', ACCESS_TOKEN);
  body.append('text', text);
  if (Array.isArray(profileIds)) {
    profileIds.forEach((profileId) => body.append('profile_ids[]', profileId));
  }
  if (mediaUrl) {
    body.append('media[picture]', mediaUrl);
    body.append('media[link]', mediaUrl);
  }
  if (scheduledAt) {
    body.append('scheduled_at', new Date(scheduledAt).toISOString());
  } else {
    body.append('now', 'true');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error ?? response.statusText ?? `HTTP ${response.status}`);
  }
  return data;
};

module.exports = { getProfiles, createPost };
