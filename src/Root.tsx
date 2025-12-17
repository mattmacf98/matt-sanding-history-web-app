import { Routes, Route } from 'react-router-dom';

import App from './App';
import { ViamClientProvider } from './lib/contexts/ViamClientContext';
import { EnvironmentProvider } from './lib/contexts/EnvironmentContext';

function Root() {
  return (
    <EnvironmentProvider>
        <ViamClientProvider>
          <Routes>
            {/* Main list view - matches /machine/:machineInfo */}
            <Route path="/machine/:machineInfo" element={<App />} />
          </Routes>
        </ViamClientProvider>
    </EnvironmentProvider>
  );
}

export default Root;
