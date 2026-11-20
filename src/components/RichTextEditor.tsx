import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  RemoveFormatting,
  Undo2,
  Redo2,
  Code,
  Quote,
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onNotify?: (type: 'success' | 'error', text: string) => void;
  placeholder?: string;
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isRichHtmlContent(content: string): boolean {
  return /<(p|br|h[1-6]|ul|ol|li|blockquote|strong|b|em|i|u|s|a|img|figure|hr|div)\b/i.test(content);
}

export function plainTextToHtml(content: string): string {
  const trimmed = (content || '').trim();
  if (!trimmed) return '';
  if (isRichHtmlContent(trimmed)) return trimmed;
  return trimmed
    .split(/\n\s*\n/)
    .map((para) => `<p>${escapeHtmlText(para.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function RichTextEditor({
  value,
  onChange,
  onNotify,
  placeholder = 'Write and format the complete news dispatch...',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const lastAppliedValueRef = useRef<string>('');

  const [sourceMode, setSourceMode] = useState(false);
  const [blockTag, setBlockTag] = useState('P');
  const [showLinkBar, setShowLinkBar] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [showImageBar, setShowImageBar] = useState(false);
  const [inlineImageUrl, setInlineImageUrl] = useState('');
  const [uploadingInline, setUploadingInline] = useState(false);

  // Sync external value changes (e.g., opening modal / switching articles / importing from wire)
  useEffect(() => {
    const normalized = plainTextToHtml(value);
    if (editorRef.current && !sourceMode && normalized !== lastAppliedValueRef.current) {
      if (editorRef.current.innerHTML !== normalized) {
        editorRef.current.innerHTML = normalized;
      }
      lastAppliedValueRef.current = normalized;
    }
  }, [value, sourceMode]);

  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      // Ignore unsupported browser command
    }
  }, []);

  const syncFromEditor = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastAppliedValueRef.current = html;
    onChange(html);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
  };

  const runCmd = (cmd: string, cmdValue?: string) => {
    if (sourceMode || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd, false, cmdValue);
    syncFromEditor();
  };

  const handleBlockChange = (tag: string) => {
    setBlockTag(tag);
    runCmd('formatBlock', `<${tag}>`);
  };

  const handleToggleSourceMode = () => {
    if (!sourceMode) {
      syncFromEditor();
      setShowLinkBar(false);
      setShowImageBar(false);
      setSourceMode(true);
    } else {
      setSourceMode(false);
      setTimeout(() => {
        if (editorRef.current) {
          const normalized = plainTextToHtml(value);
          editorRef.current.innerHTML = normalized;
          lastAppliedValueRef.current = normalized;
        }
      }, 0);
    }
  };

  const handleApplyLink = () => {
    const href = linkUrl.trim();
    if (!href || !/^(https?:\/\/|mailto:|\/)/i.test(href)) {
      onNotify?.('error', 'Enter a valid URL starting with https://, http://, or /.');
      return;
    }
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) {
      document.execCommand(
        'insertHTML',
        false,
        `<a href="${escapeHtmlText(href)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(href)}</a>`
      );
    } else {
      document.execCommand('createLink', false, href);
    }
    setShowLinkBar(false);
    syncFromEditor();
  };

  const handleInsertInlineUrl = () => {
    const url = inlineImageUrl.trim();
    if (!url || !/^(https?:\/\/|\/)/i.test(url)) {
      onNotify?.('error', 'Enter a valid image URL starting with https://, http://, or /.');
      return;
    }
    restoreSelection();
    document.execCommand(
      'insertHTML',
      false,
      `<figure><img src="${escapeHtmlText(url)}" alt="LASU Broadcast Media" /></figure><p><br></p>`
    );
    setInlineImageUrl('');
    setShowImageBar(false);
    syncFromEditor();
  };

  const handleInlineImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInline(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiRequest<{ url: string }>('/api/admin/upload', {
        method: 'POST',
        body: fd,
      });
      restoreSelection();
      document.execCommand(
        'insertHTML',
        false,
        `<figure><img src="${escapeHtmlText(res.url)}" alt="LASU Broadcast Media" /></figure><p><br></p>`
      );
      setShowImageBar(false);
      syncFromEditor();
      onNotify?.('success', 'Inline image inserted into article.');
    } catch (err) {
      onNotify?.('error', err instanceof Error ? err.message : 'Failed to upload inline image.');
    } finally {
      setUploadingInline(false);
      e.target.value = '';
    }
  };

  const plainText = stripHtmlToText(value);
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="border border-stone-300 rounded-md bg-white overflow-hidden focus-within:border-[#0B2545] focus-within:ring-1 focus-within:ring-[#0B2545]">
      {/* Formatting Toolbar */}
      <div
        role="toolbar"
        aria-label="Rich Text Formatting"
        className="flex flex-wrap items-center gap-1 px-2.5 py-2 bg-[#FAF9F6] border-b border-stone-200"
      >
        <select
          aria-label="Text style"
          value={blockTag}
          disabled={sourceMode}
          onChange={(e) => handleBlockChange(e.target.value)}
          className="px-2 py-1 text-xs font-semibold border border-stone-300 rounded bg-white text-[#14181F] disabled:opacity-50"
        >
          <option value="P">Paragraph</option>
          <option value="H2">Heading 2</option>
          <option value="H3">Heading 3</option>
          <option value="BLOCKQUOTE">Quote</option>
        </select>

        <span className="w-px h-5 bg-stone-300 mx-1" />

        <button
          type="button"
          title="Bold"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('bold')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Italic"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('italic')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Underline"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('underline')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Strikethrough"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('strikeThrough')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-5 bg-stone-300 mx-1" />

        <button
          type="button"
          title="Bulleted List"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('insertUnorderedList')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Numbered List"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('insertOrderedList')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Blockquote"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('formatBlock', '<BLOCKQUOTE>')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-5 bg-stone-300 mx-1" />

        <button
          type="button"
          title="Align Left"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('justifyLeft')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Align Center"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('justifyCenter')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Align Right"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('justifyRight')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-5 bg-stone-300 mx-1" />

        <button
          type="button"
          title="Insert / Edit Link"
          disabled={sourceMode}
          onClick={() => {
            saveSelection();
            setShowImageBar(false);
            setLinkUrl('https://');
            setShowLinkBar((prev) => !prev);
          }}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
            showLinkBar ? 'bg-[#0B2545] text-white' : 'hover:bg-stone-200 text-[#14181F]'
          } disabled:opacity-40`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          Link
        </button>
        <button
          type="button"
          title="Insert Inline Image"
          disabled={sourceMode}
          onClick={() => {
            saveSelection();
            setShowLinkBar(false);
            setShowImageBar((prev) => !prev);
          }}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
            showImageBar ? 'bg-[#0B2545] text-white' : 'hover:bg-stone-200 text-[#14181F]'
          } disabled:opacity-40`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Image
        </button>
        <button
          type="button"
          title="Insert Divider"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('insertHorizontalRule')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Clear Formatting"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('removeFormat')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <RemoveFormatting className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-5 bg-stone-300 mx-1" />

        <button
          type="button"
          title="Undo"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('undo')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Redo"
          disabled={sourceMode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCmd('redo')}
          className="p-1.5 rounded hover:bg-stone-200 text-[#14181F] disabled:opacity-40 cursor-pointer"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleToggleSourceMode}
          className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold cursor-pointer ${
            sourceMode ? 'bg-[#0B2545] text-white' : 'hover:bg-stone-200 text-[#14181F]'
          }`}
          title="Toggle HTML Source View"
        >
          <Code className="w-3.5 h-3.5" />
          HTML
        </button>
      </div>

      {/* Inline Link Bar */}
      {showLinkBar && !sourceMode && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#F4F2EC] border-b border-stone-200 text-xs">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://lasu.edu.ng/..."
            className="flex-1 min-w-[200px] px-2.5 py-1.5 border border-stone-300 rounded bg-white text-xs"
          />
          <button
            type="button"
            onClick={handleApplyLink}
            className="px-3 py-1.5 rounded bg-[#0B2545] text-white font-semibold cursor-pointer"
          >
            Apply Link
          </button>
          <button
            type="button"
            onClick={() => {
              restoreSelection();
              runCmd('unlink');
              setShowLinkBar(false);
            }}
            className="px-2.5 py-1.5 rounded border border-stone-300 bg-white font-semibold cursor-pointer"
          >
            Unlink
          </button>
          <button
            type="button"
            onClick={() => setShowLinkBar(false)}
            className="px-2.5 py-1.5 rounded border border-stone-300 bg-white font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* Inline Image Upload / URL Bar */}
      {showImageBar && !sourceMode && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#F4F2EC] border-b border-stone-200 text-xs">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleInlineImageUpload}
            className="text-xs file:mr-2 file:px-2.5 file:py-1 file:rounded file:border-0 file:bg-[#0B2545] file:text-white file:text-xs file:font-semibold cursor-pointer"
          />
          <span className="text-[#525866]">or URL:</span>
          <input
            type="url"
            value={inlineImageUrl}
            onChange={(e) => setInlineImageUrl(e.target.value)}
            placeholder="https://.../photo.jpg"
            className="flex-1 min-w-[180px] px-2.5 py-1.5 border border-stone-300 rounded bg-white text-xs"
          />
          <button
            type="button"
            disabled={uploadingInline}
            onClick={handleInsertInlineUrl}
            className="px-3 py-1.5 rounded bg-[#0B2545] text-white font-semibold cursor-pointer disabled:opacity-50"
          >
            {uploadingInline ? 'Uploading...' : 'Insert'}
          </button>
          <button
            type="button"
            onClick={() => setShowImageBar(false)}
            className="px-2.5 py-1.5 rounded border border-stone-300 bg-white font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      {/* Editor Surface */}
      {sourceMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={11}
          placeholder="<p>HTML source...</p>"
          className="w-full min-h-[280px] max-h-[460px] p-4 font-mono text-xs leading-relaxed bg-[#14181F] text-slate-100 outline-none resize-y"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Full Broadcast Content"
          data-placeholder={placeholder}
          onInput={syncFromEditor}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          className="rte-prose-surface min-h-[280px] max-h-[460px] overflow-y-auto px-4 py-3.5 text-sm leading-relaxed text-[#14181F] bg-white outline-none"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#FAF9F6] border-t border-stone-200 text-[11px] text-[#525866]">
        <span>Rich Text Formatting Active · Headings, Lists, Quotes, Links &amp; Inline Media</span>
        <span className="font-mono tabular-nums">
          {wordCount} words · {readMinutes} min read
        </span>
      </div>
    </div>
  );
}
