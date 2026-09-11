import { baseConfig, reactConfig } from "@contentforge/config/eslint";

export default [...baseConfig, ...reactConfig, { ignores: ["dist/**"] }];
