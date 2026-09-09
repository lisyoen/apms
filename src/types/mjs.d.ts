declare module "@/lib/llm/crypto.mjs" { export function encryptApiKey(value:string,secret?:string):string; export function decryptApiKey(value:string,secret?:string):string; }
