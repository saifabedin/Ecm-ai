function buildResearchPrompt({
  businessName,
  niche,
  targetAudience,
  location,
  previousMemory,
}) {
  return `
You are a world-class digital marketing strategist.

Business Details:
- Name: ${businessName}
- Niche: ${niche}
- Audience: ${targetAudience}
- Location: ${location}

Previous Insights:
${JSON.stringify(previousMemory)}

Now generate:

1. Market Research (trends, demand, gaps)
2. Target Audience Psychology
3. Competitor Strategy Breakdown
4. Content Strategy (Instagram, Reels, Ads)
5. 5 Viral Content Ideas
6. 3 High-Converting Ad Angles

Return ONLY valid JSON. Do NOT include markdown, backticks, or explanation.
`;
}

module.exports = {
  buildResearchPrompt
};
