import path from "node:path";

export default {
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { environment: "node", clearMocks: true }
};
