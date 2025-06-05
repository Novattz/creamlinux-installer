import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AppProvider } from '@/contexts/index.ts'

createRoot(document.getElementById('root')!).render(
  <AppProvider>
    <App />
  </AppProvider>
)
