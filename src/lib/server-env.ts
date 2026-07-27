import { parseEnvironment } from "./env";

export const serverEnv = parseEnvironment(process.env);
