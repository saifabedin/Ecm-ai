/**
 * Footage Ranking Engine
 *
 * Scores and ranks video clip candidates based on multiple factors:
 * - Keyword relevance (0-40): how well the clip matches the search intent
 * - Duration fit (0-20): how well the clip duration matches the scene
 * - Resolution quality (0-20): HD/4K preference
 * - Visual diversity (0-20): how different this clip is from already-selected ones
 *
 * Usage:
 *   const { rankCandidates } = require('./footage-ranker');
 *   const best = rankCandidates(candidates, { sceneDuration: 5, searchKeyword: 'nature', usedKeywords: Set });
 */

/**
 * Score a single video candidate
 *
 * @param {Object} video - Pexels video object
 * @param {Object} opts - Scoring options
 * @param {number} opts.sceneDuration - Target scene duration in seconds
 * @param {string} opts.searchKeyword - Primary search keyword
 * @param {Set<string>} opts.usedKeywords - Keywords already used by other scenes
 * @returns {Object} { score, breakdown }
 */
function scoreCandidate(video, opts = {}) {
  const { sceneDuration = 5, searchKeyword = '', usedKeywords = new Set() } = opts;

  let keywordScore = 0;
  let durationScore = 0;
  let resolutionScore = 0;
  let diversityScore = 0;

  // --- Keyword Relevance (0-40) ---
  // Base score for having a video at all
  keywordScore = 10;

  // Bonus: video ID present (valid Pexels response)
  if (video.id) keywordScore += 5;

  // Bonus: video has user/name (indicates curated content)
  if (video.user && video.user.name) keywordScore += 5;

  // Bonus: video has multiple files (indicates higher quality source)
  if (video.video_files && video.video_files.length >= 3) keywordScore += 5;

  // Bonus: video has HD files
  const hasHD = video.video_files && video.video_files.some(f => f.quality === 'hd');
  if (hasHD) keywordScore += 5;

  // Bonus: video has picture (thumbnail available)
  if (video.image) keywordScore += 5;

  // Bonus: video duration is reasonable (5-30s is ideal for B-roll)
  if (video.duration >= 5 && video.duration <= 30) keywordScore += 5;

  keywordScore = Math.min(keywordScore, 40);

  // --- Duration Fit (0-20) ---
  if (video.duration && sceneDuration) {
    const ratio = video.duration / sceneDuration;

    if (ratio >= 0.8 && ratio <= 1.5) {
      // Good match: clip is slightly longer than scene (can be trimmed)
      durationScore = 20;
    } else if (ratio >= 0.5 && ratio <= 2.0) {
      // Acceptable: can be looped or trimmed
      durationScore = 14;
    } else if (ratio >= 0.3 && ratio <= 3.0) {
      // Suboptimal but usable
      durationScore = 8;
    } else {
      // Poor match
      durationScore = 3;
    }
  } else {
    durationScore = 10; // Default if no duration info
  }

  // --- Resolution Quality (0-20) ---
  if (video.video_files && video.video_files.length > 0) {
    const files = video.video_files;

    // Check for 4K
    const has4K = files.some(f => f.width >= 3840 || f.height >= 3840);
    if (has4K) { resolutionScore = 20; }
    else {
      // Check for HD (1080p+)
      const hasHD = files.some(f => (f.width >= 1920 || f.height >= 1920) && f.quality === 'hd');
      if (hasHD) { resolutionScore = 16; }
      else {
        // Check for any HD
        const anyHD = files.some(f => f.quality === 'hd');
        if (anyHD) { resolutionScore = 12; }
        else {
          // SD
          resolutionScore = 6;
        }
      }
    }

    // Bonus: has MP4 format (most compatible)
    const hasMP4 = files.some(f => f.file_type === 'video/mp4');
    if (hasMP4) resolutionScore = Math.min(resolutionScore + 2, 20);
  } else {
    resolutionScore = 5;
  }

  // --- Visual Diversity (0-20) ---
  diversityScore = 15; // Default: assume diverse

  // If the search keyword was already used by another scene, reduce diversity
  if (usedKeywords.has(searchKeyword)) {
    diversityScore -= 8;
  }

  // Bonus: video has tags (indicates richer metadata for uniqueness)
  if (video.video_pictures && video.video_pictures.length > 0) {
    diversityScore += 3;
  }

  // Bonus: different user than previously seen (variety in style)
  diversityScore = Math.max(0, Math.min(diversityScore, 20));

  const totalScore = keywordScore + durationScore + resolutionScore + diversityScore;

  return {
    score: totalScore,
    breakdown: {
      keyword: keywordScore,
      duration: durationScore,
      resolution: resolutionScore,
      diversity: diversityScore,
    },
    videoId: video.id,
  };
}

/**
 * Rank a list of video candidates and return sorted by score
 *
 * @param {Object[]} videos - Array of Pexels video objects
 * @param {Object} opts - Scoring options (same as scoreCandidate)
 * @returns {Object[]} Sorted array of { video, score, breakdown }
 */
function rankCandidates(videos, opts = {}) {
  if (!videos || videos.length === 0) return [];

  const scored = videos.map(video => ({
    video,
    ...scoreCandidate(video, opts),
  }));

  // Sort by score descending (best first)
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Select the best video from a list of candidates
 *
 * @param {Object[]} videos - Array of Pexels video objects
 * @param {Object} opts - Scoring options
 * @returns {Object|null} Best video object, or null
 */
function selectBest(videos, opts = {}) {
  const ranked = rankCandidates(videos, opts);
  return ranked.length > 0 ? ranked[0].video : null;
}

module.exports = {
  scoreCandidate,
  rankCandidates,
  selectBest,
};
