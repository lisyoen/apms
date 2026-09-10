"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";

const WysiwygEditor=dynamic(()=>import("./WysiwygEditor"),{ssr:false,loading:()=> <div className="wysiwyg-loading">편집기 불러오는 중…</div>});
export type SaveResult={ok:true;content:string;etag:string;updatedAt:string}|{ok:false;conflict?:boolean;message:string};
type Props={title:string;initialContent:string;project:string;documentPath:string;onSave:(content:string)=>Promise<SaveResult>;onCancel:()=>void;onReload:()=>Promise<void>};

export default function MdEditor({title,initialContent,project,documentPath,onSave,onCancel,onReload}:Props){
  const[content,setContent]=useState(initialContent),[saving,setSaving]=useState(false),[error,setError]=useState(""),[conflict,setConflict]=useState(false);
  const changed=content!==initialContent;
  const save=useCallback(async()=>{if(!changed||saving)return;setSaving(true);setError("");const result=await onSave(content);setSaving(false);if(!result.ok){setError(result.message);setConflict(!!result.conflict)}},[changed,saving,onSave,content]);
  useEffect(()=>{const beforeUnload=(event:BeforeUnloadEvent)=>{if(!changed)return;event.preventDefault();event.returnValue=""};window.addEventListener("beforeunload",beforeUnload);return()=>window.removeEventListener("beforeunload",beforeUnload)},[changed]);
  useEffect(()=>{const key=(event:globalThis.KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();void save()}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key)},[save]);
  useEffect(()=>{const leave=(event:MouseEvent)=>{if(!changed)return;const target=event.target as HTMLElement;if(!target.closest(".project-sidebar a,.project-sidebar button"))return;if(!window.confirm("저장하지 않은 변경 사항을 버리고 이동할까요?")){event.preventDefault();event.stopPropagation()}};document.addEventListener("click",leave,true);return()=>document.removeEventListener("click",leave,true)},[changed]);
  function cancel(){if(!changed||window.confirm("저장하지 않은 변경 사항을 버릴까요?"))onCancel()}
  return <section className="md-editor" data-testid="md-editor"><header><strong>{title}</strong><div><button type="button" onClick={cancel}>취소</button><button type="button" className="primary" disabled={!changed||saving} onClick={()=>void save()}>{saving?"저장 중…":"저장"}</button></div></header>{error&&<div className="editor-error" role="alert">{error}{conflict&&<div><button type="button" onClick={()=>void onReload()}>다시 불러오기</button><button type="button" onClick={()=>setConflict(false)}>내 내용 유지</button></div>}</div>}<WysiwygEditor value={content} onChange={setContent} project={project} documentPath={documentPath}/></section>;
}
