import { baseConfig } from "@contentforge/config/eslint";

export default [...baseConfig, { ignores: ["dist/**"] }];
