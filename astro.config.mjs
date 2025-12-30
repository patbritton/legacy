import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "hybrid",
  adapter: node({
    mode: "standalone"
  }),
  server: {
    host: "127.0.0.1",
    port: 3001
  }
});
