import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, Copy, Loader2, ArrowLeft, Share2, Sparkles, User, Zap } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

function getMessageText(message) {
  if (!message || typeof message !== 'object') {
    return '';
  }

  if (Array.isArray(message.parts)) {
    const text = message.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n\n')
      .trim();

    if (text) return text;
  }

  return typeof message.content === 'string' ? message.content.trim() : '';
}

export default function SharedConversation() {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      if (!shareToken) {
        setError('CRITICAL: MISSING_SHARE_TOKEN');
        setLoading(false);
        return;
      }

      try {
        const data = await api.getSharedAgentConversation(shareToken);
        if (!cancelled) {
          setConversation(data.conversation || null);
          setMessages(data.messages || []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message || 'NEURAL_LINK_FAILURE: FAILED_TO_LOAD_TRANSCRIPT');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadConversation();

    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8">
        <div className="w-12 h-12 border-4 border-white/5 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700 animate-pulse">Synchronizing Neural Transcript</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="relative group bg-[#09090b] border border-rose-500/30 rounded-[3rem] p-16 max-w-2xl w-full shadow-2xl text-center overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50"></div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-4">Transcript Unreachable</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-10 leading-relaxed">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-3 px-12 py-5 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.1)]"
          >
            Return to Command Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Background elements */}
       <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-16 md:px-8">
        <div className="rounded-[3rem] border border-white/5 bg-[#09090b] p-8 shadow-2xl md:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700 transition-all hover:border-white/10">
          
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 pb-12 border-b border-white/5">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                <Sparkles size={14} />
                Neural Session Archive
              </div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tight md:text-5xl">
                {conversation?.title || 'UNIDENTIFIED_TRANSCRIPT'}
              </h1>
              <p className="mt-4 text-[10px] items-center gap-2 font-black uppercase tracking-widest text-gray-500 flex">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                READ-ONLY_NEURAL_LOGS // SYNCED_EXTERNAL
              </p>
            </div>

            <button
              onClick={copyLink}
              className="group flex items-center justify-center gap-3 px-8 py-4 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.05)]"
            >
              {copied ? <CheckCircle2 size={16} /> : <Share2 size={16} className="group-hover:rotate-12 transition-transform" />}
              {copied ? 'TRANSCRIPT_LINK_COPIED' : 'CLONE_ACCESS_LINK'}
            </button>
          </div>

          <div className="space-y-10">
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              return (
                <div 
                  key={message.id} 
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`mb-3 flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.3em] ${isUser ? 'text-blue-500' : 'text-gray-600'}`}>
                    {isUser ? <><span className="italic">AUTHOR_SIGNAL</span> <User size={10} /></> : <><Bot size={10} /> <span className="italic">NEURAL_RESPONSE</span></>}
                  </div>
                  
                  <div
                    className={`relative max-w-[92%] rounded-[2rem] px-8 py-6 text-sm font-medium leading-relaxed tracking-wide shadow-2xl md:max-w-[85%] group ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-sm shadow-blue-900/20'
                        : 'bg-white/[0.03] border border-white/5 text-gray-300 rounded-tl-sm'
                    }`}
                  >
                    {!isUser && <div className="absolute top-0 left-0 w-1 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity rounded-full h-full"></div>}
                    {getMessageText(message) || 'EMPTY_PAYLOAD_DETECTED'}
                  </div>
                  
                  <div className="mt-3 text-[8px] font-black font-mono text-gray-800 tracking-widest">
                    SEGMENT_{index.toString().padStart(3, '0')} // OPS_SUCCESS
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-20 pt-12 border-t border-white/5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-800 mb-8">End of Neural Transcript</p>
            <Link 
              to="/"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-colors flex items-center justify-center gap-3 group"
            >
              Initialize Your Own Session
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
