import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Components } from 'react-markdown';

interface DescriptionDisplayProps {
  description: string;
  title?: string;
}

const DescriptionDisplay: React.FC<DescriptionDisplayProps> = ({ description, title = 'Description' }) => {
  // Convert plain URLs to markdown links if they're not already in markdown format
  const processUrls = (text: string): string => {
    // First, protect existing markdown links by replacing them with placeholders
    const linkPlaceholders: string[] = [];
    
    // Replace existing markdown links [text](url) with placeholders
    const textWithPlaceholders = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match) => {
      const placeholder = `__MARKDOWN_LINK_${linkPlaceholders.length}__`;
      linkPlaceholders.push(match);
      return placeholder;
    });
    
    // Now convert plain URLs to markdown links
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const processedText = textWithPlaceholders.replace(urlRegex, (match) => {
      let url = match;
      // Add https:// if it starts with www.
      if (url.startsWith('www.')) {
        url = 'https://' + url;
      }
      // Convert to markdown link format
      return `[${match}](${url})`;
    });
    
    // Restore original markdown links
    return processedText.replace(/__MARKDOWN_LINK_(\d+)__/g, (_, index) => {
      return linkPlaceholders[parseInt(index)] || '';
    });
  };

  // Custom components for react-markdown
  const markdownComponents: Components = {
    // Ensure all links open in new tab
    a: ({ node, ...props }) => (
      <a
        {...props}
        title={props.title || 'Open in new tab'}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
      />
    ),
    // Preserve line breaks
    p: ({ node, ...props }) => (
      <p {...props} className="text-gray-700 whitespace-pre-wrap mb-2" />
    ),
    // Headings
    h1: ({ node, ...props }) => (
      <h1 {...props} className="text-2xl font-bold text-gray-900 mt-4 mb-2" />
    ),
    h2: ({ node, ...props }) => (
      <h2 {...props} className="text-xl font-bold text-gray-900 mt-4 mb-2" />
    ),
    h3: ({ node, ...props }) => (
      <h3 {...props} className="text-lg font-semibold text-gray-900 mt-3 mb-2" />
    ),
    // Lists
    ul: ({ node, ...props }) => (
      <ul {...props} className="list-disc list-inside text-gray-700 mb-2 ml-4" />
    ),
    ol: ({ node, ...props }) => (
      <ol {...props} className="list-decimal list-inside text-gray-700 mb-2 ml-4" />
    ),
    li: ({ node, ...props }) => (
      <li {...props} className="mb-1" />
    ),
    // Code blocks
    code: ({ node, inline, ...props }: any) => (
      inline ? (
        <code {...props} className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono" />
      ) : (
        <code {...props} className="block bg-gray-100 text-gray-800 p-2 rounded text-sm font-mono overflow-x-auto mb-2" />
      )
    ),
    // Blockquotes
    blockquote: ({ node, ...props }) => (
      <blockquote {...props} className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2" />
    ),
    // Horizontal rule
    hr: ({ node, ...props }) => (
      <hr {...props} className="my-4 border-gray-300" />
    ),
    // Strong and emphasis
    strong: ({ node, ...props }) => (
      <strong {...props} className="font-bold text-gray-900" />
    ),
    em: ({ node, ...props }) => (
      <em {...props} className="italic" />
    ),
  };

  const processedDescription = processUrls(description);

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">
        <ReactMarkdown components={markdownComponents}>
          {processedDescription}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default DescriptionDisplay;
