const fs = require("fs");
const path = require("path");

// Generate SRT formatted subtitles from text
function generateSubtitles(text, scenes) {
  let srtContent = "";
  let counter = 1;

  // Simple word-based timing for subtitle generation
  const words = text.split(/\s+/);
  const wordsPerMinute = 150; // Average speaking rate
  const totalWords = words.length;
  const durationPerWord = 60 / wordsPerMinute; // seconds per word at given rate

  for (let i = 0; i < words.length; i += 5) {  // roughly 5 words per subtitle line
    const lineWords = words.slice(i, Math.min(i + 5, words.length));
    const lineText = lineWords.join(" ");

    const startTime = Math.floor(i * durationPerWord);
    const endTime = Math.floor((i + 5) * durationPerWord);

    const startHours = Math.floor(startTime / 3600);
    const startMinutes = Math.floor((startTime % 3600) / 60);
    const startSeconds = startTime % 60;

    const endHours = Math.floor(endTime / 3600);
    const endMinutes = Math.floor((endTime % 3601) / 60);
    const endSeconds = endTime % 60;

    srtContent += `${counter}\n`;
    srtContent += `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}:${startSeconds.toString().padStart(2, '0')},000 --> ${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:${endSeconds.toString().padStart(2, '0')},000\n`;
    srtContent += `${lineText}\n\n`;
    counter++;
  }

  return srtContent;
}

// Function to create subtitle files
function createSubtitleFile(text, outputPath) {
  const srtContent = generateSubtitles(text);
  fs.writeFileSync(outputPath, srtContent);
  return outputPath;
}

module.exports = { generateSubtitles, createSubtitleFile };