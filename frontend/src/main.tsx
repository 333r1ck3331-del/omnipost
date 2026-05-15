import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 50, color: 'red', fontFamily: 'monospace' }}>
          <h1>React 崩溃了</h1>
          <pre>{this.state.error.message}</pre>
          <pre>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')
if (!root) {
  document.body.innerHTML = '<h1 style="color:red;padding:50px">FATAL: #root 元素不存在</h1>'
} else {
  try {
    createRoot(root).render(
      <StrictMode>
        <ErrorBoundary>
          <div style={{padding:50}}>
            <h1 style={{color:'green'}}>✅ React is working</h1>
            <App />
          </div>
        </ErrorBoundary>
      </StrictMode>,
    )
  } catch (e: any) {
    root.innerHTML = `<h1 style="color:red">FATAL ERROR</h1><pre>${e.message}\n${e.stack}</pre>`
  }
}
