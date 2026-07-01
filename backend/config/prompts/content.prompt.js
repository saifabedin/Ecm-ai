function buildContentPrompt({ strategy }) {
  return `
You are a high-level social media strategist.

Use this business strategy STRICTLY:
${JSON.stringify(strategy)}

IMPORTANT:
- Content MUST be specific to the business niche
- Content MUST reflect the target audience
- Content MUST align with market research

Generate:

1. 5 Instagram Captions (restaurant-focused, food-related, engaging)
2. 3 Reels Scripts (food, dining experience, customer reactions)
3. 3 Ad Copies (restaurant offers, food quality, local targeting)
4. 5 Hooks (food niche, hunger trigger, curiosity)
5. 5 CTA lines (visit, order, book table)

Return ONLY valid JSON.
No generic motivational content.
No unrelated topics.
`;
}

module.exports = {
  buildContentPrompt
};
