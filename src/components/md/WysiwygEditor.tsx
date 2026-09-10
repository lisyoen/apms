"use client";

import { useEffect, useMemo, useState } from "react";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { common, createLowlight } from "lowlight";
import { ARROW_PATTERNS, markdownForEditor, markdownForSave } from "./editor-utils";

const arrowKey = new PluginKey("arrowAutoConvert");
export const ArrowAutoConvert = Extension.create({name:"arrowAutoConvert",addProseMirrorPlugins(){return[new Plugin({key:arrowKey,appendTransaction(transactions,_old,state){
  if(transactions.some(t=>t.getMeta(arrowKey))||!transactions.some(t=>t.docChanged)||!state.selection.empty)return null;
  const {$from}=state.selection;if($from.parent.type.name==="codeBlock"||$from.marks().some(m=>m.type.name==="code"))return null;
  const before=$from.parent.textBetween(Math.max(0,$from.parentOffset-5),$from.parentOffset,"\0","\0");if(!before.endsWith(" "))return null;
  for(const [ascii,unicode] of ARROW_PATTERNS){const needle=`${ascii} `;if(before.endsWith(needle)){const tr=state.tr.insertText(`${unicode} `,$from.pos-needle.length,$from.pos);tr.setMeta(arrowKey,true);return tr}}return null;
}})]}});

const ListIndent=Extension.create({name:"listIndent",addKeyboardShortcuts(){return{Tab:()=>this.editor.isActive("taskItem")?this.editor.commands.sinkListItem("taskItem"):this.editor.isActive("listItem")?this.editor.commands.sinkListItem("listItem"):false,"Shift-Tab":()=>this.editor.isActive("taskItem")?this.editor.commands.liftListItem("taskItem"):this.editor.isActive("listItem")?this.editor.commands.liftListItem("listItem"):false}}});
type Props={value:string;onChange:(value:string)=>void;project:string;documentPath:string};
type Slash={from:number;query:string;index:number}|null;
const slashItems=[["제목 1","heading1"],["제목 2","heading2"],["제목 3","heading3"],["불릿 리스트","bulletList"],["번호 리스트","orderedList"],["체크리스트","taskList"],["코드 블록","codeBlock"],["표","table"],["인용","blockquote"],["수평선","horizontalRule"]] as const;
const languages=["plaintext","javascript","typescript","json","bash","css","html","markdown","python","sql"];

export default function WysiwygEditor({value,onChange,project,documentPath}:Props){
  const [raw,setRaw]=useState(false),[rawValue,setRawValue]=useState(value),[slash,setSlash]=useState<Slash>(null),[tableMenu,setTableMenu]=useState<{x:number;y:number}|null>(null);
  const lowlight=useMemo(()=>createLowlight(common),[]);
  const editor=useEditor({immediatelyRender:false,extensions:[StarterKit.configure({codeBlock:false}),Link.configure({openOnClick:false}),Image,Table.configure({resizable:true}),TableRow,TableHeader,TableCell,TaskList,TaskItem.configure({nested:true}),CodeBlockLowlight.configure({lowlight}),Placeholder.configure({placeholder:"내용을 입력하세요... (/ 명령어)"}),Markdown.configure({html:true,transformPastedText:true,transformCopiedText:true}),ArrowAutoConvert,ListIndent],content:markdownForEditor(value,project,documentPath),onUpdate:({editor})=>{
    onChange(markdownForSave(editor.storage.markdown.getMarkdown(),project,documentPath));const {$from}=editor.state.selection;const line=$from.parent.textBetween(0,$from.parentOffset," "," ");const match=line.match(/(?:^|\s)\/([^\s/]*)$/);setSlash(match?{from:$from.pos-match[1].length-1,query:match[1],index:0}:null);
  },editorProps:{attributes:{class:"tiptap-editor","aria-label":"WYSIWYG Markdown 편집"},handleKeyDown:(_view,event)=>{if(!slash)return false;const filtered=slashItems.filter(([label])=>label.includes(slash.query));if(event.key==="Escape"){setSlash(null);return true}if((event.key==="ArrowDown"||event.key==="ArrowUp")&&filtered.length){event.preventDefault();setSlash({...slash,index:(slash.index+(event.key==="ArrowDown"?1:-1)+filtered.length)%filtered.length});return true}if(event.key==="Enter"&&filtered.length){event.preventDefault();runSlash(filtered[slash.index]?.[1]||filtered[0][1]);return true}return false}}});
  useEffect(()=>{if(!editor||raw)return;if(markdownForSave(editor.storage.markdown.getMarkdown(),project,documentPath)!==value)editor.commands.setContent(markdownForEditor(value,project,documentPath),false)},[value,editor,project,documentPath,raw]);
  if(!editor)return <div className="wysiwyg-loading">편집기 불러오는 중…</div>;
  const filtered=slashItems.filter(([label])=>label.includes(slash?.query||""));
  function link(){const previous=editor!.getAttributes("link").href||"";const url=window.prompt("URL을 입력하세요:",previous);if(url===null)return;if(!url)editor!.chain().focus().unsetLink().run();else editor!.chain().focus().extendMarkRange("link").setLink({href:url}).run()}
  function runSlash(command:string){if(!slash)return;const chain=editor!.chain().focus().deleteRange({from:slash.from,to:editor!.state.selection.from});if(command==="heading1")chain.toggleHeading({level:1});else if(command==="heading2")chain.toggleHeading({level:2});else if(command==="heading3")chain.toggleHeading({level:3});else if(command==="bulletList")chain.toggleBulletList();else if(command==="orderedList")chain.toggleOrderedList();else if(command==="taskList")chain.toggleTaskList();else if(command==="codeBlock")chain.toggleCodeBlock();else if(command==="table")chain.insertTable({rows:3,cols:3,withHeaderRow:true});else if(command==="blockquote")chain.toggleBlockquote();else chain.setHorizontalRule();chain.run();setSlash(null)}
  function toggleRaw(){if(raw){editor!.commands.setContent(markdownForEditor(rawValue,project,documentPath));onChange(rawValue)}else setRawValue(markdownForSave(editor!.storage.markdown.getMarkdown(),project,documentPath));setRaw(!raw)}
  const button=(label:string,title:string,action:()=>void,active=false)=><button type="button" title={title} className={active?"active":""} onClick={action}>{label}</button>;
  return <div className="wysiwyg-shell" onContextMenu={e=>{if(editor.isActive("table")){e.preventDefault();setTableMenu({x:e.clientX,y:e.clientY})}}} onClick={()=>tableMenu&&setTableMenu(null)}>
    <div className="editor-toolbar" role="toolbar"><div>{button("↶","실행 취소",()=>editor.chain().focus().undo().run())}{button("↷","다시 실행",()=>editor.chain().focus().redo().run())}</div><div>{([1,2,3] as const).map(n=>button(`H${n}`,`제목 ${n}`,()=>editor.chain().focus().toggleHeading({level:n}).run(),editor.isActive("heading",{level:n})))}</div><div>{button("B","굵게",()=>editor.chain().focus().toggleBold().run(),editor.isActive("bold"))}{button("I","기울임",()=>editor.chain().focus().toggleItalic().run(),editor.isActive("italic"))}{button("S","취소선",()=>editor.chain().focus().toggleStrike().run(),editor.isActive("strike"))}{button("</>","인라인 코드",()=>editor.chain().focus().toggleCode().run(),editor.isActive("code"))}</div><div>{button("• 목록","불릿 목록",()=>editor.chain().focus().toggleBulletList().run())}{button("1. 목록","번호 목록",()=>editor.chain().focus().toggleOrderedList().run())}{button("☑","체크리스트",()=>editor.chain().focus().toggleTaskList().run())}</div><div>{button("인용","인용",()=>editor.chain().focus().toggleBlockquote().run())}{button("—","수평선",()=>editor.chain().focus().setHorizontalRule().run())}{button("링크","링크",link)}{button("이미지","이미지 URL",()=>{const url=window.prompt("이미지 URL을 입력하세요:");if(url)editor.chain().focus().setImage({src:url}).run()})}</div><div><select aria-label="코드 블록 언어" value={editor.getAttributes("codeBlock").language||"plaintext"} onChange={e=>editor.chain().focus().setCodeBlock({language:e.target.value}).run()}>{languages.map(v=><option key={v}>{v}</option>)}</select>{button("{ }","코드 블록",()=>editor.chain().focus().toggleCodeBlock().run())}<button type="button" onClick={()=>{const rows=Number(window.prompt("행 수","3"));const cols=Number(window.prompt("열 수","3"));if(rows>0&&cols>0)editor.chain().focus().insertTable({rows:Math.min(rows,20),cols:Math.min(cols,20),withHeaderRow:true}).run()}}>표</button></div><button type="button" className={raw?"active md-toggle":"md-toggle"} onClick={toggleRaw}>MD 원문</button></div>
    {raw?<textarea className="markdown-source" aria-label="Markdown 원문 편집" value={rawValue} onChange={e=>{setRawValue(e.target.value);onChange(e.target.value)}}/>:<EditorContent editor={editor}/>} 
    {!raw&&<BubbleMenu editor={editor} tippyOptions={{duration:100}} className="bubble-menu">{button("B","굵게",()=>editor.chain().focus().toggleBold().run())}{button("I","기울임",()=>editor.chain().focus().toggleItalic().run())}{button("</>","코드",()=>editor.chain().focus().toggleCode().run())}{button("링크","링크",link)}{button("S","취소선",()=>editor.chain().focus().toggleStrike().run())}</BubbleMenu>}
    {slash&&filtered.length>0&&<div className="slash-menu" role="listbox">{filtered.map(([label,cmd],i)=><button type="button" role="option" aria-selected={i===slash.index} className={i===slash.index?"active":""} key={cmd} onMouseDown={e=>{e.preventDefault();runSlash(cmd)}}>{label}</button>)}</div>}
    {tableMenu&&<div className="table-context-menu" style={{left:tableMenu.x,top:tableMenu.y}} onClick={e=>e.stopPropagation()}>{[["왼쪽에 열 추가","addColumnBefore"],["오른쪽에 열 추가","addColumnAfter"],["열 삭제","deleteColumn"],["위에 행 추가","addRowBefore"],["아래에 행 추가","addRowAfter"],["행 삭제","deleteRow"],["헤더 토글","toggleHeaderRow"],["셀 병합","mergeCells"],["셀 분할","splitCell"],["표 삭제","deleteTable"]].map(([label,cmd])=><button type="button" key={cmd} onClick={()=>{const commands=editor.commands as unknown as Record<string,()=>boolean>;commands[cmd]();setTableMenu(null)}}>{label}</button>)}</div>}
  </div>;
}
