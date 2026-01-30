const config = require('../config.json');

// Request queue to prevent overwhelming Ollama with concurrent embedding requests
class EmbeddingQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async add(text) {
    return new Promise((resolve, reject) => {
      this.queue.push({ text, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const { text, resolve, reject } = this.queue.shift();

    try {
      const result = await embedDirect(text);
      resolve(result);
    } catch (e) {
      reject(e);
    } finally {
      this.processing = false;
      // Process next item after a small delay to let Ollama breathe
      if (this.queue.length > 0) {
        setTimeout(() => this.process(), 100);
      }
    }
  }
}

const embeddingQueue = new EmbeddingQueue();

// Direct embedding call (internal use)
async function embedDirect(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.embeddingModel,
        prompt: text
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.embedding;
  } finally {
    clearTimeout(timeout);
  }
}

// Public embed function - queued to prevent overwhelming Ollama
async function embed(text) {
  return embeddingQueue.add(text);
}

module.exports = { embed };
