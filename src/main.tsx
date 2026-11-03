import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from './auth'
import { MomentsProvider } from './moments-layer'
import { ReportsProvider } from './reports'
import { StoreProvider } from './store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <AuthProvider>
        <MomentsProvider>
          <ReportsProvider>
            <App />
          </ReportsProvider>
        </MomentsProvider>
      </AuthProvider>
    </StoreProvider>
  </StrictMode>,
)
