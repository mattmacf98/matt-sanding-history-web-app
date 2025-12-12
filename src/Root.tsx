import { Routes, Route } from 'react-router-dom';

import App from './App';
import { ViamClientProvider } from './ViamClientContext';

function Root() {
  return (
    <ViamClientProvider>
      <Routes>
        {/* Main list view - matches /machine/:machineInfo */}
        <Route path="/machine/:machineInfo" element={<App />} />
      </Routes>
    </ViamClientProvider>
  );
}

export default Root;
