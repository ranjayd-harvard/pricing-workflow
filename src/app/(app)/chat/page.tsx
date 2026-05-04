'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Send, RotateCcw, Bot, User, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ConversationState {
  phase: 'intent' | 'fields' | 'email' | 'done'
  templateId?: string
  templateName?: string
  templateFields?: unknown[]
  collectedFields: Record<string, string | number | null>
  missingFields: string[]
  userName?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GREETING =
  "Hi! I'm the Pricing Assistant — I'll help you submit a pricing update request.\n\nWhat kind of update are you looking to make? For example:\n• \"I need to update a product price\"\n• \"I want to change event ticket pricing\""

const INITIAL_STATE: ConversationState = {
  phase: 'intent',
  collectedFields: {},
  missingFields: [],
}

const PHASE_LABELS: Record<ConversationState['phase'], string> = {
  intent: 'Understanding your request',
  fields: 'Collecting details',
  email: 'Almost done',
  done: 'Complete',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  // Render **bold** markdown in assistant messages
  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 mb-0.5">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words',
          isUser
            ? 'bg-brand-600 text-white rounded-br-sm shadow-sm'
            : 'bg-white border border-surface-border text-slate-800 rounded-bl-sm shadow-sm',
        )}
      >
        {isUser ? message.content : renderContent(message.content)}
      </div>

      {isUser && (
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-0.5">
          <User className="w-4 h-4 text-slate-500" />
        </div>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0 mb-0.5">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-surface-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: GREETING },
  ])
  const [conversationState, setConversationState] = useState<ConversationState>(INITIAL_STATE)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, conversationState }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      setConversationState(data.conversationState)
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Connection error — please try again.' },
      ])
    } finally {
      setLoading(false)
      // Re-focus input after response
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function resetConversation() {
    setMessages([{ role: 'assistant', content: GREETING }])
    setConversationState(INITIAL_STATE)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const isDone = conversationState.phase === 'done'

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-surface-border bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-900 text-sm leading-tight">Pricing Assistant</h1>
            <p className="text-xs text-slate-500 leading-tight">
              {PHASE_LABELS[conversationState.phase]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Phase progress pills */}
          <div className="hidden sm:flex items-center gap-1">
            {(['intent', 'fields', 'email', 'done'] as const).map((phase, i) => {
              const phases = ['intent', 'fields', 'email', 'done'] as const
              const currentIdx = phases.indexOf(conversationState.phase)
              const isActive = phase === conversationState.phase
              const isPast = i < currentIdx
              return (
                <div
                  key={phase}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    isActive ? 'w-6 bg-brand-600' : isPast ? 'w-4 bg-brand-300' : 'w-4 bg-slate-200',
                  )}
                />
              )
            })}
          </div>

          <button
            onClick={resetConversation}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <RotateCcw className="w-3 h-3" />
            New Chat
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-slate-50">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {loading && <TypingIndicator />}

        {isDone && (
          <div className="flex justify-center pt-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-center">
              <p className="text-sm text-emerald-700 font-medium">Request submitted successfully</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Check the{' '}
                <a href="/queue" className="underline hover:text-emerald-800">
                  Approval Queue
                </a>{' '}
                to track progress
              </p>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-surface-border bg-white px-6 py-4">
        {isDone ? (
          <div className="text-center">
            <p className="text-sm text-slate-500">
              Conversation complete.{' '}
              <button
                onClick={resetConversation}
                className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
              >
                Start a new one
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || isDone}
              placeholder={loading ? 'Waiting for response…' : 'Type your message… (Enter to send, Shift+Enter for new line)'}
              className="input flex-1 resize-none leading-relaxed min-h-[42px] max-h-32 overflow-y-auto py-2.5"
              style={{ height: 'auto' }}
              onInput={e => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || isDone}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        )}

        <p className="text-xs text-slate-400 mt-2 text-center">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  )
}
