export type ChatMessage = { role: "system"|"user"|"assistant"|"tool"; content: string };
export type ToolSpec = { name:string; description:string; parameters:Record<string,unknown> };
export type LlmResult = { content:string; toolCalls:{id:string;name:string;arguments:Record<string,unknown>}[]; inputTokens:number; outputTokens:number };
export type Connection = { provider:string;base_url:string;model:string;apiKey:string };
export type CompletionOptions = { maxTokens?:number;temperature?:number;signal?:AbortSignal };
const estimate=(value:string)=>Math.max(1,Math.ceil(value.length/4));
export function normalizeBaseUrl(baseUrl:string){return baseUrl.trim().replace(/\/+$/,"").replace(/\/v1$/i,"")}
export function finalLlmUrl(provider:string,baseUrl:string){const base=normalizeBaseUrl(baseUrl);return provider==="anthropic"?`${base}/v1/messages`:`${base}/v1/chat/completions`}

export async function complete(connection:Connection,messages:ChatMessage[],tools:ToolSpec[]=[],options:CompletionOptions={}):Promise<LlmResult>{
  const anthropic=connection.provider==="anthropic";
  const url=finalLlmUrl(connection.provider,connection.base_url);
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n\n");
  const body=anthropic?{model:connection.model,max_tokens:options.maxTokens??4096,temperature:options.temperature,system,messages:messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content})),tools:tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters}))}:{model:connection.model,stream:false,max_tokens:options.maxTokens,temperature:options.temperature,messages,tools:tools.map(t=>({type:"function",function:t})),tool_choice:"auto"};
  const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json",...(anthropic?{"x-api-key":connection.apiKey,"anthropic-version":"2023-06-01"}:{authorization:`Bearer ${connection.apiKey}`})},body:JSON.stringify(body),signal:options.signal});
  if(!response.ok) throw new Error(`LLM 연결 오류 (${response.status})`);
  const data=await response.json();
  if(anthropic){const blocks=data.content??[];return{content:blocks.filter((x:any)=>x.type==="text").map((x:any)=>x.text).join(""),toolCalls:blocks.filter((x:any)=>x.type==="tool_use").map((x:any)=>({id:x.id,name:x.name,arguments:x.input??{}})),inputTokens:data.usage?.input_tokens??estimate(JSON.stringify(messages)),outputTokens:data.usage?.output_tokens??estimate(JSON.stringify(blocks))};}
  const msg=data.choices?.[0]?.message??{};return{content:msg.content??"",toolCalls:(msg.tool_calls??[]).map((x:any)=>{let args={};try{args=JSON.parse(x.function.arguments)}catch{}return{id:x.id,name:x.function.name,arguments:args}}),inputTokens:data.usage?.prompt_tokens??estimate(JSON.stringify(messages)),outputTokens:data.usage?.completion_tokens??estimate(msg.content??"")};
}
