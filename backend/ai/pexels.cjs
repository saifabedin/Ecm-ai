const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");
const { retryWithBackoff } = require("../utils/retry.cjs");

require('../initEnv.cjs');

async function getStockClips(query) {
  try {
    const res = await retryWithBackoff(
      () => axios.get(
        `https://api.pexels.com/videos/search?query=${query}&per_page=3`,
        {
          headers: {
            Authorization: process.env.PEXELS_API_KEY,
          },
        }
      ),
      { attempts: 3, delayMs: 1000, label: 'Pexels search' }
    );

    return res.data.videos.map(v => v.video_files[0].link);

  } catch (err) {
    console.error("❌ Pexels Error:", err.message);
    return [];
  }
}

module.exports = { getStockClips };
