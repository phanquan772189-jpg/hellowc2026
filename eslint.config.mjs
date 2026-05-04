import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [".claude/**", ".next/**", "node_modules/**", "next-env.d.ts"],
  },
];

export default config;
