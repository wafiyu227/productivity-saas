import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Send, User, ChevronRight, Inbox as InboxIcon, Loader2, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

export default function Inbox() {
  const { user, profile } = useAuth();
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef(null);

  const teamId = profile?.current_team_id || profile?.teams?.[0]?.team_id;

  useEffect(() => {
    if (teamId && user?.id) {
      fetchThreads();
    }
  }, [teamId, user?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedThread]);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/messages?userId=${user.id}&teamId=${teamId}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setThreads(data);
      if (data.length > 0 && !selectedThread) {
        setSelectedThread(data[0]);
      } else if (selectedThread) {
        // Refresh the currently selected thread
        const updated = data.find(t => t.threadId === selectedThread.threadId);
        if (updated) setSelectedThread(updated);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedThread || sending) return;

    setSending(true);
    try {
      const lastMsg = selectedThread.messages[selectedThread.messages.length - 1];
      const res = await fetch(`${API_URL}/api/messages/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          teamId: teamId,
          to: selectedThread.messages[0].from_email === profile.email ? selectedThread.messages[0].to_email : selectedThread.messages[0].from_email,
          subject: selectedThread.subject,
          html: `<p>${replyText.replace(/\n/g, '<br>')}</p>`,
          originalMessageId: lastMsg.message_id,
          previousMessageIds: selectedThread.messages.map(m => m.message_id)
        })
      });

      if (!res.ok) throw new Error('Failed to send reply');
      
      setReplyText('');
      await fetchThreads();
    } catch (error) {
      alert('Failed to send reply. Please try again.');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  if (loading && threads.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white overflow-hidden">
      {/* Thread List */}
      <div className="w-1/3 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <InboxIcon size={20} className="text-blue-600" />
            Messages
          </h2>
          <button 
            onClick={fetchThreads}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Mail size={48} className="mx-auto mb-4 opacity-20" />
              <p>No messages yet</p>
            </div>
          ) : (
            threads.map(thread => (
              <button
                key={thread.threadId}
                onClick={() => setSelectedThread(thread)}
                className={`w-full text-left p-4 border-b border-slate-100 transition-all hover:bg-slate-50 ${
                  selectedThread?.threadId === thread.threadId ? 'bg-blue-50/50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-slate-900 truncate pr-2">
                    {thread.messages[0].from_email === profile.email ? 'To: ' + thread.messages[0].to_email : thread.messages[0].from_email}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap uppercase font-bold">
                    {new Date(thread.lastMessageAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-700 truncate mb-1">{thread.subject}</p>
                <p className="text-xs text-slate-500 truncate italic">
                  {thread.messages[thread.messages.length - 1].body_text || 'See message content...'}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message View */}
      <div className="flex-1 flex flex-col bg-slate-50/30">
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedThread.subject}</h3>
                <p className="text-xs text-slate-500">
                  Conversation with {selectedThread.messages[0].from_email === profile.email ? selectedThread.messages[0].to_email : selectedThread.messages[0].from_email}
                </p>
              </div>
            </div>

            {/* Conversation Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {selectedThread.messages.map((msg, idx) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] flex gap-3 ${msg.direction === 'outbound' ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <User size={16} className="text-slate-500" />
                    </div>
                    <div>
                      <div className={`p-4 rounded-2xl shadow-sm border ${
                        msg.direction === 'outbound' 
                          ? 'bg-blue-600 text-white border-blue-500' 
                          : 'bg-white text-slate-900 border-slate-200'
                      }`}>
                        {msg.body_html ? (
                          <div 
                            className="text-sm whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: msg.body_html }}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.body_text}</p>
                        )}
                      </div>
                      <p className={`text-[10px] mt-1 text-slate-400 font-medium ${msg.direction === 'outbound' ? 'text-right' : ''}`}>
                        {new Date(msg.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply Area */}
            <div className="p-4 bg-white border-t border-slate-200">
              <form onSubmit={handleSendReply} className="relative">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full p-4 pr-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[100px] text-sm"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleSendReply(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:hover:bg-blue-600"
                >
                  {sending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </form>
              <p className="text-[10px] text-slate-400 mt-2 text-right">
                Press Cmd/Ctrl + Enter to send
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Mail size={32} className="opacity-20" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Select a conversation</h3>
            <p className="text-sm max-w-xs">
              Choose a message from the list to view the conversation and send a reply.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
