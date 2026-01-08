import { createContext, useContext, useState, ReactNode } from 'react'

export interface ToastMessage {
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}
interface ToastContextType {
  messages: ToastMessage[]
  addMessage: (message: ToastMessage) => void
  clearMessages: () => void
  popMessage: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const addMessage = (message: ToastMessage) =>
    setMessages([...messages, message])
  const clearMessages = () => setMessages([])
  const popMessage = () => setMessages(messages.slice(0, -1))

  return (
    <ToastContext.Provider
      value={{ messages, addMessage, clearMessages, popMessage }}
    >
      {messages.length > 0 && (
        <ToastMessage
          message={messages[0].message}
          type={messages[0].type}
          removeMessage={popMessage}
        />
      )}
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

const ToastMessage = ({
  message,
  type,
  removeMessage,
}: ToastMessage & { removeMessage: () => void }) => {
  const baseClasses =
    'fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] px-4 py-3 rounded shadow-lg flex items-center font-medium text-sm mb-2 min-w-[220px] max-w-xs w-auto'
  const typeClasses: Record<typeof type, string> = {
    success: 'bg-green-100 text-green-800 border border-green-300',
    error: 'bg-red-100 text-red-800 border border-red-300',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    info: 'bg-blue-100 text-blue-800 border border-blue-300',
  }

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`}>
      <span className="flex-1">{message}</span>
      <button
        onClick={removeMessage}
        className="ml-2 text-xl leading-none bg-transparent border-0 text-gray-500 hover:text-black"
        aria-label="Close"
        type="button"
      >
        &times;
      </button>
    </div>
  )
}
