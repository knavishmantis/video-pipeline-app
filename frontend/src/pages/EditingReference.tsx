import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { IconEdit } from '@tabler/icons-react';

export default function EditingReference() {
  const { user } = useAuth();
  const isEditor = user?.roles?.includes('editor') || user?.role === 'editor';
  const isAdmin = user?.roles?.includes('admin') || user?.role === 'admin';
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGuide = async () => {
      try {
        const response = await fetch('/editing-formula.md');
        if (response.ok) {
          const text = await response.text();
          setContent(text);
        } else {
          setContent('# Editing Reference Guide\n\nGuide content will be available here.');
        }
      } catch (error) {
        console.error('Failed to load editing guide:', error);
        setContent('# Editing Reference Guide\n\nGuide content will be available here.');
      } finally {
        setLoading(false);
      }
    };

    loadGuide();
  }, []);

  if (!isEditor && !isAdmin) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Access Restricted</h1>
          <p className="text-neutral-600">This reference guide is only available to editors.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
              <IconEdit className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">Editing Reference</h1>
              <p className="text-neutral-600">
                Complete guide on how videos should be edited and formatted
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg">
            <p className="text-sm text-purple-900 font-semibold">
              ⚠️ This is your primary reference document for video editing and formatting. 
              Refer to this guide regularly when editing videos to ensure consistency and quality.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-lg text-neutral-600">Loading guide...</div>
          </div>
        ) : content ? (
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 md:p-8">
            <div className="prose prose-sm md:prose-base max-w-none 
              prose-headings:text-neutral-900 prose-headings:font-bold
              prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-6
              prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-5
              prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-4
              prose-p:text-neutral-700 prose-p:mb-4 prose-p:leading-relaxed
              prose-strong:text-neutral-900 prose-strong:font-semibold
              prose-ul:text-neutral-700 prose-ul:mb-4 prose-ul:pl-6
              prose-ol:text-neutral-700 prose-ol:mb-4 prose-ol:pl-6
              prose-li:text-neutral-700 prose-li:mb-2
              prose-code:text-neutral-900 prose-code:bg-neutral-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
              prose-pre:bg-neutral-900 prose-pre:text-neutral-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
              prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-700
              prose-img:rounded-lg prose-img:shadow-md prose-img:my-4 prose-img:max-w-full prose-img:h-auto
              prose-blockquote:border-l-4 prose-blockquote:border-neutral-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-600">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  img: ({ node, ...props }: any) => (
                    <img 
                      {...props} 
                      className="rounded-lg shadow-md my-4 max-w-full h-auto"
                      loading="lazy"
                      alt={props.alt || 'Image'}
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  ),
                  a: ({ node, ...props }: any) => (
                    <a 
                      {...props} 
                      className="text-blue-600 underline hover:text-blue-700"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-400">
            Failed to load guide content
          </div>
        )}
      </div>
    </div>
  );
}

