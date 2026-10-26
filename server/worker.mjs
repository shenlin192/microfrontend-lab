import { api } from './api.mjs';
export default {
  async fetch(request, env) {
    return api(request, env.DB, { storage: 'Cloudflare D1', version: env.RELEASE_VERSION });
  },
};
