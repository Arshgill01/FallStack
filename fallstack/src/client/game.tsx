import './index.css';
import './redesign.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './game-app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameApp />
  </StrictMode>
);
