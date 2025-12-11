import { Routes, Route } from 'react-router-dom';
import App from './App';

function Root() {
  return (
    <Routes>
      {/* Main list view - matches /machine/:machineInfo */}
      <Route path="/machine/:machineInfo" element={<App />} />
    </Routes>
  );
}

export default Root;