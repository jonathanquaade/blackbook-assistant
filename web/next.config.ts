import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "@huggingface/transformers"],
  // The build-time index (and model, if it was cached at build) must ship inside the functions.
  outputFileTracingIncludes: {
    "/api/search": [
      "./.blackbook-index/**/*",
      // transformers.node loads onnxruntime-node through createRequire at runtime, which the tracer cannot
      // follow; onnxruntime-web is bundled inside transformers.node and needs no files. sharp is a static import.
      "./node_modules/@huggingface/transformers/dist/transformers.node.*",
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**/*",
      "./node_modules/onnxruntime-common/package.json",
      "./node_modules/onnxruntime-common/dist/**/*",
    ],
    "/api/media": ["./.blackbook-index/index.json"],
    "/explore": ["./.blackbook-index/index.json"],
  },
  // Keep the function under Vercel's size limit: other platforms' ONNX binaries, the browser runtime.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
      "node_modules/onnxruntime-node/bin/napi-v6/win32/**",
      "node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**",
      "node_modules/onnxruntime-web/**",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};
export default config;
