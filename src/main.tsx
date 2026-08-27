import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initHaptics } from './lib/haptics';
import './app.css';

void initHaptics();

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
