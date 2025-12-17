import { useViamClients } from "../lib/contexts/ViamClientContext";
import VideoStoreSelector from "./VideoStoreSelector";
import * as VIAM from "@viamrobotics/sdk";

interface ResourceSelectionProps {
    machineName: string;
    setVideoStoreClient: (client: VIAM.GenericComponentClient | null) => void;
    cameraComponentNames: string[];
    selectedCamera: string;
    setSelectedCamera: (camera: string) => void;
}

export const ResourceSelection: React.FC<ResourceSelectionProps> = ({ machineName, setVideoStoreClient, cameraComponentNames, selectedCamera, setSelectedCamera }) => {
    const { robotClient } = useViamClients();

    return (
        <div className='flex gap-8'>
              {machineName && (
                <div className="video-store-selector">
                  <div className="video-store-selector-label" style={{ marginBottom: '0.6rem' }}>Machine name</div>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: '#f3f3f3',
                      color: 'rgb(37 37 37)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.375rem',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}>
                      {machineName}
                    </span>
                  </div>
                </div>
              )}

              <VideoStoreSelector onVideoStoreSelected={setVideoStoreClient}/>

              <div className="video-store-selector">
                <label htmlFor="camera-select" className="video-store-selector-label">
                  Select camera resource
                </label>
                {!robotClient ? (
                  <div className="video-store-selector-message info">
                    Connect to a robot to select a camera
                  </div>
                ) : cameraComponentNames.length > 0 ? (
                  <select
                    id="camera-select"
                    value={selectedCamera}
                    onChange={(e) => {
                      setSelectedCamera(e.target.value);
                      localStorage.setItem('selectedCamera', e.target.value);
                    }}
                    className="video-store-selector-select"
                  >
                    <option value="">Select a camera resource</option>
                    {cameraComponentNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="video-store-selector-message info">
                    No camera resources found
                  </div>
                )}
              </div>
            </div>
    );
};