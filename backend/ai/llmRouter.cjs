const { generateAIResponse } = require("../ai/openrouter.cjs");
const { generateOpenAIResponse } = require("../ai/openai.cjs");
const { generateClaudeResponse } = require("../ai/anthropic.cjs");

const LLM_CONFIG = {
  deepseek: {
    provider: "openrouter",
    model: "deepseek/deepseek-coder",
    tasks: ["coding", "debugging", "code-review"],
  },
  mistral: {
    provider: "openrouter",
    model: "mistralai/mistral-large",
    tasks: ["content", "writing", "translation"],
  },
  glm: {
    provider: "openrouter",
    model: "glm/glm-4",
    tasks: ["agent", "planning", "analysis"],
  },
  claude: {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    tasks: ["writing", "content", "summarization", "analysis"],
  },
  openai: {
    provider: "openai",
    model: "gpt-4",
    tasks: ["general", "default"],
  },
};

function getLLMForTask(taskType) {
  for (const [llmName, config] of Object.entries(LLM_CONFIG)) {
    if (config.tasks.includes(taskType) || config.tasks.includes("default")) {
      return { llmName, ...config };
    }
  }
  return LLM_CONFIG.openai;
}

async function routeToLLM(taskType, prompt, options = {}) {
  const llmConfig = getLLMForTask(taskType);

  console.log(`[LLM Router] Routing task "${taskType}" to ${llmConfig.llmName} (${llmConfig.model})`);

  try {
    let result;

    if (llmConfig.provider === "openai") {
      result = await generateOpenAIResponse({
        prompt,
        model: llmConfig.model,
        ...options,
      });
        } else if (llmConfig.provider === "anthropic") {
          result = await generateClaudeResponse({
            prompt,
            model: llmConfig.model,
            ...options,
          });
    } else {
      result = await generateAIResponse({
        prompt,
        model: llmConfig.model,
        ...options,
      });
    }

    return {
      success: true,
      provider: llmConfig.provider,
      model: llmConfig.model,
      taskType,
      result,
    };
  } catch (error) {
    console.error(`[LLM Router] Error with ${llmConfig.llmName}:`, error);

    const fallbackLLM = LLM_CONFIG.openai;
    console.log(`[LLM Router] Falling back to openai`);

    try {
      const result = await generateOpenAIResponse({
        prompt,
        model: fallbackLLM.model,
        ...options,
      });

      return {
        success: true,
        provider: fallbackLLM.provider,
        model: fallbackLLM.model,
        taskType,
        result,
        fallback: true,
      };
    } catch (fallbackError) {
      console.error(`[LLM Router] Fallback also failed:`, fallbackError);
      return {
        success: false,
        error: "All LLM providers failed",
        details: error.message,
      };
    }
  }
}

async function routeCodingTask(prompt, options = {}) {
  return routeToLLM("coding", prompt, options);
}

async function routeContentTask(prompt, options = {}) {
  return routeToLLM("content", prompt, options);
}

async function routeAgentTask(prompt, options = {}) {
  return routeToLLM("agent", prompt, options);
}

async function routeGeneralTask(prompt, options = {}) {
  return routeToLLM("general", prompt, options);
}

module.exports = {
  routeToLLM,
  routeCodingTask,
  routeContentTask,
  routeAgentTask,
  routeGeneralTask,
  getLLMForTask,
  LLM_CONFIG,
};