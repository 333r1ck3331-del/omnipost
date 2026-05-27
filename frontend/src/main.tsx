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
        <div style={{
          maxWidth: 720, margin: '60px auto', padding: 32,
          background: '#fdfbf6', border: '1px solid #e8dcc4', borderRadius: 10,
          fontFamily: '-apple-system, "PingFang SC", sans-serif', color: '#2a241c'
        }}>
          <h1 style={{ fontFamily: 'Georgia, "Noto Serif SC", serif', fontSize: 24, marginBottom: 8 }}>
            出了点意外
          </h1>
          <p style={{ color: '#7a6c55', fontSize: 13, marginBottom: 20 }}>
            React 渲染失败。下面是技术细节，可以截图反馈。
          </p>
          <pre style={{
            background: '#f4ecdd', padding: 12, borderRadius: 6,
            fontSize: 12, overflow: 'auto', color: '#a85a45'
          }}>{this.state.error.message}</pre>
          <pre style={{
            background: '#f4ecdd', padding: 12, borderRadius: 6, marginTop: 8,
            fontSize: 11, overflow: 'auto', color: '#7a6c55', maxHeight: 300
          }}>{this.state.error.stack}</pre>
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
          <App />
        </ErrorBoundary>
      </StrictMode>,
    )
  } catch (e: any) {
    root.innerHTML = `<h1 style="color:red">FATAL ERROR</h1><pre>${e.message}\n${e.stack}</pre>`
  }
}
