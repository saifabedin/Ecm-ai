const axios = require("axios");
const dotenv = require("dotenv");
const logger = require("../utils/logger.cjs");
const { retryWithBackoff } = require("../utils/retry.cjs");

dotenv.config();

async function createAvatarVideo(imageUrl, audioUrl) {
  logger.info(`[D-ID] ENTER createAvatarVideo`, {
    metadata: { function: 'createAvatarVideo', type: 'enter' },
  });
  try {
    const response = await retryWithBackoff(
      () => axios.post(
        "https://api.d-id.com/talks",
        {
          source_url: imageUrl,
          script: {
            type: "audio",
            audio_url: audioUrl,
          },
        },
        {
          headers: {
            Authorization: `Basic ${process.env.DID_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      ),
      { attempts: 3, delayMs: 1000, label: 'D-ID create talk' }
    );

    logger.info(`[D-ID] Avatar video created: ${response.data.id}`, {
      metadata: { function: 'createAvatarVideo', type: 'success', talkId: response.data.id },
    });
    return response.data.id;
  } catch (err) {
    logger.error(`[D-ID] Avatar video creation failed: ${err.message}`, {
      stack: err.stack,
      metadata: { function: 'createAvatarVideo', type: 'error' },
    });
    throw new Error("D-ID video creation failed");
  }
}

async function getVideoStatus(id) {
  logger.info(`[D-ID] ENTER getVideoStatus id=${id}`, {
    metadata: { function: 'getVideoStatus', type: 'enter', talkId: id },
  });
  try {
    const res = await retryWithBackoff(
      () => axios.get(`https://api.d-id.com/talks/${id}`, {
        headers: {
          Authorization: `Basic ${process.env.DID_API_KEY}`,
        },
      }),
      { attempts: 3, delayMs: 1000, label: 'D-ID status poll' }
    );

    logger.info(`[D-ID] getVideoStatus success: ${id}`, {
      metadata: { function: 'getVideoStatus', type: 'success', talkId: id, status: res.data?.status },
    });
    return res.data;
  } catch (err) {
    logger.error(`[D-ID] getVideoStatus failed: ${err.message}`, {
      stack: err.stack,
      metadata: { function: 'getVideoStatus', type: 'error', talkId: id },
    });
    throw err;
  }
}
