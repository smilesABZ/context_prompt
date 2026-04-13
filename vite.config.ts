import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.OLLAMA_SERVER_URL': JSON.stringify(env.OLLAMA_SERVER_URL || 'http://localhost:11434'),
        'process.env.OLLAMA_MODEL': JSON.stringify(env.OLLAMA_MODEL || 'mistral'),
        'process.env.SD_SERVER_URL': JSON.stringify(env.SD_SERVER_URL || 'http://localhost:7860')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
