'use client'

import * as React from 'react'

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 3000

type ToastActionElement = React.ReactElement
type ToasterToast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: 'default' | 'destructive' | 'success'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

let count = 0
function genId() { return `toast-${++count}` }

type State = { toasts: ToasterToast[] }
type Action =
  | { type: 'ADD_TOAST'; toast: ToasterToast }
  | { type: 'UPDATE_TOAST'; toast: Partial<ToasterToast> & { id: string } }
  | { type: 'DISMISS_TOAST'; toastId?: string }
  | { type: 'REMOVE_TOAST'; toastId?: string }

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_TOAST':
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case 'UPDATE_TOAST':
      return { ...state, toasts: state.toasts.map(t => t.id === action.toast.id ? { ...t, ...action.toast } : t) }
    case 'DISMISS_TOAST': {
      const { toastId } = action
      if (toastId) {
        if (!toastTimeouts.has(toastId)) {
          toastTimeouts.set(toastId, setTimeout(() => {
            toastTimeouts.delete(toastId)
            dispatch({ type: 'REMOVE_TOAST', toastId })
          }, TOAST_REMOVE_DELAY))
        }
      }
      return { ...state, toasts: state.toasts.map(t => toastId === undefined || t.id === toastId ? { ...t, open: false } : t) }
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: action.toastId ? state.toasts.filter(t => t.id !== action.toastId) : [] }
    default:
      return state
  }
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach(listener => listener(memoryState))
}

function toast({ ...props }: Omit<ToasterToast, 'id'>) {
  const id = genId()
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id })
  dispatch({ type: 'ADD_TOAST', toast: { ...props, id, open: true, onOpenChange: open => { if (!open) dismiss() } } })
  return { id, dismiss, update: (props: ToasterToast) => dispatch({ type: 'UPDATE_TOAST', toast: { ...props, id } }) }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)
  React.useEffect(() => {
    listeners.push(setState)
    return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1) }
  }, [state])
  return { ...state, toast, dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }) }
}

export { useToast, toast }
