import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Splash } from './splash-view';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
