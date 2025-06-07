import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css/github-markdown.css';

export default function AboutPage() {
  const [markdown, setMarkdown] = useState('');
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/komari-monitor/komari/refs/heads/main/README.md')
      .then(res => res.text())
      .then(setMarkdown);
  }, []);
  return (
    <div className="markdown-body p-4">
      {markdown ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} children={markdown} />
      ) : (
        <p>加载中...</p>
      )}
    </div>
  );
}
