import { HashRouter, Routes, Route } from 'react-router-dom';

import App from './App';
import { EnvironmentProvider } from './lib/contexts/EnvironmentContext';
import { ViamClientProvider } from './lib/contexts/ViamClientContext';
import VideoDetailPage from './VideoDetailPage';

function Root() {
  return (
    <EnvironmentProvider>
        <ViamClientProvider>
          <HashRouter>
            <Routes>
              {/* Main list view - served at /machine/:machineInfo#/ */}
              <Route path="/" element={<App />} />

              {/* Video detail view - served at /machine/:machineInfo#/videos/:videoId */}
              <Route path="/videos/:videoId" element={<VideoDetailPage />} />
            </Routes>
        </HashRouter>
        </ViamClientProvider>
    </EnvironmentProvider>
  );
}

export default Root;
