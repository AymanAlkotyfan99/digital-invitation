/** Cloudflare Worker entry point for the static invitation build. */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
