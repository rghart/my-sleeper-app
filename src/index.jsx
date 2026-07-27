import React from 'react';
import { createRoot } from 'react-dom/client';
// Tokens first, so the `@layer` order statement in theme.css is established
// before index.css declares itself part of the base layer.
import './styles/theme.css';
import './index.css';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
