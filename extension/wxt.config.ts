import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'PageChat - Web Page RAG Assistant',
    description: 'Chat with any web page using AI and RAG',
    version: '0.1.0',
    permissions: ['activeTab', 'scripting', 'sidePanel', 'storage', 'tabs'],
    host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],
    action: {
      default_title: 'Chat with this page',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
});
