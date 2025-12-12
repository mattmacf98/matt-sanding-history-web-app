import { Routes, Route } from 'react-router-dom';

import App from './App';
import { ViamClientProvider } from './ViamClientContext';
import VideoDetailPage from './VideoDetailPage';

function Root() {
  return (
    <ViamClientProvider>
      <Routes>
        {/* Main list view - matches /machine/:machineInfo */}
        <Route path="/machine/:machineInfo" element={<App />} />

        {/* Video detail view - matches /machine/:machineInfo/video/:videoId */}
        <Route path="/machine/:machineInfo/videos/:videoId" element={<VideoDetailPage />} />
      </Routes>
    </ViamClientProvider>
  );
}

export default Root;
