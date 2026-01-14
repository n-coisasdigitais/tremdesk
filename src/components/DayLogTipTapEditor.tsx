import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Heading2,
} from 'lucide-react';
import { useCallback, useEffect } from 'react';

interface DayLogTipTapEditorProps {
  content?: any;
  onChange?: (json: any, text: string) => void;
  editable?: boolean;
  placeholder?: string;
  minHeight?: string;
}

export const DayLogTipTapEditor = ({
  content,
  onChange,
  editable = true,
  placeholder = 'Escreva aqui...',
  minHeight = '120px'
}: DayLogTipTapEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON(), editor.getText());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none p-4 ${
          editable ? '' : 'prose-p:my-1'
        }`,
        style: `min-height: ${minHeight}`,
        placeholder: editable ? placeholder : '',
      },
    },
  });

  // Update content when prop changes
  useEffect(() => {
    if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const addLink = useCallback(() => {
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('URL do link:', previousUrl);
    
    if (url === null) {
      return;
    }

    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div className="border rounded-md p-4 animate-pulse bg-muted" style={{ minHeight }} />
    );
  }

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      {editable && (
        <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'bg-accent' : ''}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'bg-accent' : ''}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'bg-accent' : ''}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'bg-accent' : ''}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1 self-center" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLink}
            className={editor.isActive('link') ? 'bg-accent' : ''}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};

// Helper to render TipTap JSON as HTML string for emails
export function tiptapJsonToHtml(json: any): string {
  if (!json || !json.content) return '';
  
  const renderNode = (node: any): string => {
    if (!node) return '';
    
    switch (node.type) {
      case 'doc':
        return (node.content || []).map(renderNode).join('');
      
      case 'paragraph':
        const pContent = (node.content || []).map(renderNode).join('');
        return pContent ? `<p style="margin: 8px 0;">${pContent}</p>` : '<p style="margin: 8px 0;"><br></p>';
      
      case 'heading':
        const level = node.attrs?.level || 2;
        const hContent = (node.content || []).map(renderNode).join('');
        const sizes: Record<number, string> = {
          1: '24px',
          2: '20px',
          3: '18px',
          4: '16px',
        };
        return `<h${level} style="margin: 12px 0 8px; font-size: ${sizes[level] || '16px'}; font-weight: 600;">${hContent}</h${level}>`;
      
      case 'bulletList':
        return `<ul style="margin: 8px 0; padding-left: 24px; list-style-type: disc;">${(node.content || []).map(renderNode).join('')}</ul>`;
      
      case 'orderedList':
        return `<ol style="margin: 8px 0; padding-left: 24px; list-style-type: decimal;">${(node.content || []).map(renderNode).join('')}</ol>`;
      
      case 'listItem':
        return `<li style="margin: 4px 0;">${(node.content || []).map(renderNode).join('')}</li>`;
      
      case 'text':
        let text = node.text || '';
        
        // Apply marks
        if (node.marks) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case 'bold':
                text = `<strong>${text}</strong>`;
                break;
              case 'italic':
                text = `<em>${text}</em>`;
                break;
              case 'link':
                text = `<a href="${mark.attrs?.href}" style="color: #3b82f6; text-decoration: underline;">${text}</a>`;
                break;
            }
          }
        }
        
        return text;
      
      case 'hardBreak':
        return '<br>';
      
      default:
        if (node.content) {
          return (node.content || []).map(renderNode).join('');
        }
        return '';
    }
  };
  
  return renderNode(json);
}
