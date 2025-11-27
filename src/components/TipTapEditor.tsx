import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import { Button } from '@/components/ui/button';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading2,
  AtSign
} from 'lucide-react';
import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TipTapEditorProps {
  content?: any;
  onChange?: (json: any) => void;
  editable?: boolean;
  placeholder?: string;
}

// Mention List Component
interface MentionListProps {
  items: Profile[];
  command: (item: { id: string; label: string }) => void;
}

interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      command({ id: item.id, label: item.full_name });
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-popover border rounded-md shadow-lg p-2 text-sm text-muted-foreground">
        Nenhum usuário encontrado
      </div>
    );
  }

  return (
    <div className="bg-popover border rounded-md shadow-lg overflow-hidden max-h-48 overflow-y-auto">
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => selectItem(index)}
          className={`w-full flex items-center gap-2 p-2 text-left text-sm hover:bg-accent transition-colors ${
            index === selectedIndex ? 'bg-accent' : ''
          }`}
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={item.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{item.full_name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span>{item.full_name}</span>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList';

// Suggestion configuration
const suggestion = {
  items: async ({ query }: { query: string }): Promise<Profile[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${query}%`)
        .limit(5);

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in mention suggestion:', error);
      return [];
    }
  },

  render: () => {
    let component: ReactRenderer | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props: any) {
        component?.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }

        return (component?.ref as MentionListRef)?.onKeyDown(props) || false;
      },

      onExit() {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};

export const TipTapEditor = ({
  content,
  onChange,
  editable = true,
  placeholder = 'Escreva aqui...'
}: TipTapEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-primary/20 text-primary px-1 py-0.5 rounded font-medium',
        },
        suggestion,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[120px] p-4 ${
          editable ? '' : 'prose-p:my-1'
        }`,
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

  const addImage = useCallback(() => {
    const url = window.prompt('URL da imagem:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

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

  const insertMention = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertContent('@').run();
    }
  }, [editor]);

  if (!editor) {
    return (
      <div className="border rounded-md p-4 min-h-[120px] animate-pulse bg-muted" />
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addImage}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1 self-center" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertMention}
            title="Mencionar usuário (@)"
          >
            <AtSign className="h-4 w-4" />
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};
