import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { TranslationProvider } from './hooks/useTranslation'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <TranslationProvider>
            <App />
        </TranslationProvider>
    </React.StrictMode>,
)
