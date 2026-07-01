function buildImagePrompt({ content }) {
  return `
You are a creative ad designer and AI prompt engineer.

Based on this content:
${JSON.stringify(content)}

Generate 3 image concepts.

For EACH image provide:

1. Design Breakdown:
- Layout (top/bottom/center)
- Elements (food, people, text, background)
- Colors
- Mood

2. AI Image Prompt (for Stable Diffusion / Replicate)

Return STRICT JSON:

{
  "images": [
    {
      "design": {
        "layout": "",
        "elements": [],
        "colors": "",
        "mood": ""
      },
      "prompt": ""
    }
  ]
}

No explanation. Only JSON.
`;
}

module.exports = {
  buildImagePrompt
};
