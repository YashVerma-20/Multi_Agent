import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, Plus, MessageSquare, Bot, User, Code, BookOpen, BarChart, Maximize, Minimize, Sun, Moon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const extractHtml = (text) => {
    const match = text.match(/```html\s+([\s\S]*?)\s*```/i);
    return match ? match[1].trim() : null;
};

const MessageBubble = ({ msg }) => {
    const [viewMode, setViewMode] = useState('preview');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const rawHtml = msg.role === 'model' ? extractHtml(msg.content ?? '') : null;

    return (
        <div className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded shrink-0 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 flex items-center justify-center mt-1">
                    <Bot size={18} className="text-accent"/>
                </div>
            )}
            <div className={`flex flex-col gap-1 w-full max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.agent && msg.role !== 'user' && (
                    <div className="text-xs font-medium text-textMuted dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 mb-2 shadow-sm w-fit">
                        <Bot size={14} className="text-accent" />
                        Orchestrator: {msg.agent} has been instantiated for this task.
                    </div>
                )}
                
                {rawHtml ? (
                    <div className={isFullscreen ? "fixed inset-0 z-50 flex flex-col bg-slate-900/90 p-4 md:p-8 backdrop-blur-sm" : "w-full flex flex-col border border-border dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm mt-2"}>
                        <div className={`flex bg-gray-50 dark:bg-slate-800 border-b border-border dark:border-slate-700 text-xs px-4 py-2 justify-between items-center ${isFullscreen ? "rounded-t-xl shrink-0" : ""}`}>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setViewMode('code')}
                                    className={`${viewMode === 'code' ? 'font-semibold text-accent' : 'text-textMuted dark:text-slate-400 hover:text-textMain dark:hover:text-white'} transition-colors font-mono uppercase tracking-wider`}
                                >
                                    Code
                                </button>
                                <button
                                    onClick={() => setViewMode('preview')}
                                    className={`${viewMode === 'preview' ? 'font-semibold text-accent' : 'text-textMuted dark:text-slate-400 hover:text-textMain dark:hover:text-white'} transition-colors font-mono uppercase tracking-wider`}
                                >
                                    Preview
                                </button>
                            </div>
                            <button
                                onClick={() => setIsFullscreen(!isFullscreen)}
                                className="flex items-center gap-1.5 text-textMuted dark:text-slate-400 hover:text-textMain dark:hover:text-white transition-colors font-medium text-xs uppercase tracking-wider"
                            >
                                {isFullscreen ? (
                                    <><Minimize size={14} /> Close</>
                                ) : (
                                    <><Maximize size={14} /> Full Screen</>
                                )}
                            </button>
                        </div>
                        <div className={`w-full bg-white dark:bg-white ${isFullscreen ? "flex-1 rounded-b-xl overflow-hidden shadow-2xl relative" : "p-0"}`}>
                            {viewMode === 'preview' ? (
                                <iframe 
                                    title="AI Preview Sandbox"
                                    className={isFullscreen ? "absolute inset-0 w-full h-full border-none bg-white" : "w-full h-[500px] border border-gray-300 rounded bg-white shadow-inner"}
                                    srcDoc={`
    <html>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>svg { max-width: 40px !important; max-height: 40px !important; height: auto; width: auto; }</style>
      </head>
      <body class="p-4">
        ${rawHtml}
      </body>
    </html>
  `}
                                    sandbox="allow-scripts"
                                />
                            ) : (
                                <pre className={`text-xs overflow-x-auto p-4 bg-gray-50 dark:bg-slate-900 whitespace-pre-wrap ${isFullscreen ? "absolute inset-0 w-full h-full" : "h-[500px]"}`}>
                                    <code className="dark:text-slate-300">{msg.content}</code>
                                </pre>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className={`rounded-2xl px-5 py-3 w-fit text-sm ${
                        msg.role === 'user' 
                        ? 'bg-gray-100 dark:bg-slate-800 text-textMain dark:text-white' 
                        : 'markdown-content text-textMain dark:text-slate-200 leading-relaxed border border-border dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm'
                    }`}>
                        <ReactMarkdown
                          components={{
                            p: ({node, ...props}) => <p className="mb-2" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                            li: ({node, ...props}) => <li className="ml-4 list-outside" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold text-black dark:text-white" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-bold mb-2 mt-4" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function App() {
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => Date.now().toString());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/history');
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const loadSession = async (sessionId) => {
    setActiveSessionId(sessionId);
    try {
      const res = await fetch(`http://127.0.0.1:8000/history/${sessionId}`);
      const data = await res.json();
      setMessages(data.map(m => ({ role: m.role, content: m.content, agent: m.selected_agent })));
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      const response = await fetch(`http://127.0.0.1:8000/history/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      
      // Update local state immediately
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      
      // If we are currently in that session, clear it
      if (activeSessionId === sessionId) {
        setActiveSessionId(Date.now().toString());
        setMessages([]);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const getAgentIcon = (agentName) => {
      if (!agentName) return <MessageSquare size={14} className="text-textMuted"/>;
      const lower = agentName.toLowerCase();
      if (lower.includes('coding')) return <Code size={14} className="text-blue-500" />;
      if (lower.includes('research')) return <BookOpen size={14} className="text-green-500" />;
      if (lower.includes('data')) return <BarChart size={14} className="text-purple-500" />;
      return <MessageSquare size={14} className="text-textMuted" />;
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dummy_token' // Placeholder
        },
        body: JSON.stringify({
          messages: newMessages,
          provider: 'gemini', // default for now
          model: 'gemini-1.5-flash',
          session_id: activeSessionId
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      setMessages([...newMessages, { role: 'model', content: data.response, agent: data.selected_agent }]);
      fetchSessions(); // Refresh history list
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: 'model', content: 'Connection failed or model error.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background dark:bg-dark-bg transition-colors duration-300">
      {/* Sidebar */}
      <div className="w-64 border-r border-border dark:border-dark-border bg-background dark:bg-dark-bg flex flex-col hidden md:flex">
        <div className="p-4">
          <button 
            onClick={() => {
                setActiveSessionId(Date.now().toString());
                setMessages([]);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 border border-border dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border text-sm font-medium transition-colors dark:text-slate-200"
          >
            <Plus size={16} /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto w-full px-2">
            <div className="text-xs font-semibold text-textMuted dark:text-slate-500 mb-2 mt-4 px-2 uppercase tracking-wider">Recent</div>
            {sessions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-textMuted dark:text-slate-500 text-center">
                    No recent agents deployed
                </div>
            ) : (
                sessions.map(s => (
                    <button 
                        key={s.session_id} 
                        onClick={() => loadSession(s.session_id)}
                        className={`group flex w-full items-center justify-between px-3 py-2 text-sm text-textMain dark:text-slate-300 rounded hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors ${activeSessionId === s.session_id ? 'bg-gray-100 dark:bg-slate-800 font-medium' : ''}`}
                    >
                        <div className="flex items-center gap-2 truncate flex-1">
                            {getAgentIcon(s.agent)}
                            <span className="truncate text-left">
                                {s.title.length > 25 ? s.title.substring(0, 25) + '...' : s.title}
                            </span>
                        </div>
                        <div 
                          onClick={(e) => handleDeleteSession(e, s.session_id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-opacity"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-textMuted dark:text-slate-500 hover:text-red-500 transition-colors"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </div>
                    </button>
                ))
            )}
        </div>
        <div className="p-4 border-t border-border dark:border-slate-800 flex items-center gap-2 text-sm dark:text-slate-300">
           <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs">U</div>
           User
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center">
        {/* Top Navbar */}
        <header className="w-full flex justify-between items-center p-4 min-h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border dark:border-slate-800 sticky top-0 z-10">
            <button className="md:hidden p-2 text-textMuted dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                <Menu size={20} />
            </button>
            <div className="font-semibold text-textMain dark:text-white flex items-center gap-2">
                Meta-Agent OS
            </div>
            <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-textMain dark:text-white hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm font-medium"
            >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                {isDarkMode ? 'Light' : 'Dark'}
            </button>
        </header>

        {/* Chat Area */}
        <div className="flex-1 w-full max-w-3xl overflow-y-auto px-4 py-8">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-border dark:border-slate-700 flex items-center justify-center mb-6">
                        <Bot size={32} className="text-accent" />
                    </div>
                    <h2 className="text-2xl font-semibold text-textMain dark:text-white mb-2">How can I help you today?</h2>
                    <p className="text-textMuted dark:text-slate-400">Meta-Agent OS is ready to assist you.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {messages.map((msg, idx) => (
                        <MessageBubble key={idx} msg={msg} />
                    ))}
                    {loading && (
                         <div className="flex gap-4">
                             <div className="w-8 h-8 rounded shrink-0 bg-white dark:bg-slate-800 border border-border dark:border-slate-700 flex items-center justify-center mt-1">
                                 <Bot size={18} className="text-accent"/>
                             </div>
                             <div className="flex items-center gap-1.5 px-5 py-4">
                               <div className="w-1.5 h-1.5 bg-textMuted rounded-full animate-bounce"></div>
                               <div className="w-1.5 h-1.5 bg-textMuted rounded-full animate-bounce [animation-delay:0.2s]"></div>
                               <div className="w-1.5 h-1.5 bg-textMuted rounded-full animate-bounce [animation-delay:0.4s]"></div>
                             </div>
                         </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            )}
        </div>

        {/* Input Area */}
        <div className="w-full max-w-3xl p-4">
            <form onSubmit={handleSend} className="relative">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend(e);
                        }
                    }}
                    placeholder="Message Meta-Agent OS..."
                    className="w-full bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded-xl px-4 py-3.5 pr-12 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none overflow-hidden max-h-32 text-sm shadow-sm transition-shadow hover:shadow text-textMain dark:text-white placeholder:text-textMuted dark:placeholder:text-slate-500"
                    rows={1}
                />
                <button 
                    type="submit" 
                    disabled={!input.trim() || loading}
                    className="absolute right-3 bottom-3 p-1.5 rounded-lg bg-textMain dark:bg-slate-100 text-white dark:text-slate-900 disabled:bg-gray-300 dark:disabled:bg-slate-800 disabled:text-white transition-colors"
                >
                    <Send size={16} />
                </button>
            </form>
            <div className="text-center text-xs text-textMuted dark:text-slate-500 mt-3">
                Meta-Agent OS is a prototype. Verify its outputs.
            </div>
        </div>
      </div>
    </div>
  );
}
