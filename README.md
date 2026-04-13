# Run and deploy your AI Studio app

This contains everything you need to run your app locally with a local AI provider.

## Run Locally

**Prerequisites:**
- Node.js
- Ollama or LM Studio installed and running locally

### Setup Steps

1. **Install a local AI provider:**

   **Option A: Using Ollama**
   - Download Ollama from https://ollama.ai
   - Install and start Ollama
   - Pull a model: `ollama pull mistral` (or another model like `neural-chat`, `llama2`, etc.)
   - Ollama will run on `http://localhost:11434` by default

   **Option B: Using LM Studio**
   - Download LM Studio from https://lmstudio.ai
   - Install and start LM Studio
   - Download a model from the model hub
   - Start the local server (usually runs on `http://localhost:1234`)
   - Update `OLLAMA_SERVER_URL` in `.env.local` to point to your LM Studio server: `http://localhost:1234`

2. Install dependencies:
   ```
   npm install
   ```

3. Configure your local AI provider in [.env.local](.env.local):
   - Set `OLLAMA_SERVER_URL` to your Ollama/LM Studio server URL (default: `http://localhost:11434` for Ollama)
   - Set `OLLAMA_MODEL` to your preferred model name (default: `mistral`)

4. Run the app:
   ```
   npm run dev
   ```

The app should now be running locally with your local AI provider!

## Available Models

**Popular Ollama models:**
- `mistral` - Fast and capable
- `neural-chat` - Good for conversations
- `dolphin-mistral` - Uncensored Mistral
- `llama2` - Meta's open source model
- `orca-mini` - Lightweight option
- `starling-lm` - Good instruction following

Run `ollama list` to see all available models, or `ollama pull <model-name>` to download new ones.
