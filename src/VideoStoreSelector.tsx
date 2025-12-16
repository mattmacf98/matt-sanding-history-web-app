import React, { useState, useEffect, useRef } from 'react';
import * as VIAM from "@viamrobotics/sdk";

import { useViamClients } from './ViamClientContext';

const STORAGE_KEY = 'selectedVideoStore';

interface VideoStoreSelectorProps {
  onVideoStoreSelected: (client: VIAM.GenericComponentClient | null) => void;
}

interface Resource {
  name: string;
  type: string;
  subtype: string;
}

const VideoStoreSelector: React.FC<VideoStoreSelectorProps> = ({ onVideoStoreSelected }) => {
  const { robotClient } = useViamClients();

  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've done initial selection for current resources
  const hasAutoSelected = useRef(false);

  // Fetch available resources when robotClient changes
  useEffect(() => {
    // Don't fetch if no robot client
    if (!robotClient) {
      setResources([]);
      setError(null);
      onVideoStoreSelected(null);
      hasAutoSelected.current = false;
      return;
    }

    const fetchResources = async () => {
      setIsLoading(true);
      setError(null);
      hasAutoSelected.current = false;

      try {
        // Get resource names from the robot client
        const resourceNames = await robotClient.resourceNames();

        // Filter for components with type "component" and subtype "generic", excluding webapp
        const filteredResources = resourceNames.filter(
          (resource: any) =>
            resource.type === "component" &&
            resource.subtype === "generic" &&
            resource.name !== "webapp"
        );

        setResources(filteredResources);
      } catch (err) {
        console.error('Failed to fetch resources:', err);
        setError('Failed to fetch available resources');
        setResources([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, [robotClient, onVideoStoreSelected]);

  // Auto-select: if only one resource, select it; otherwise restore from localStorage
  // Always ensure the client is created on initial load
  useEffect(() => {
    if (resources.length === 0 || !robotClient || hasAutoSelected.current) return;
    
    hasAutoSelected.current = true;
    const resourceNames = resources.map(r => r.name);
    
    // If only one resource, auto-select it
    if (resources.length === 1) {
      const onlyResource = resources[0].name;
      handleResourceSelect(onlyResource);
      return;
    }
    
    // Multiple resources - try to restore from localStorage or validate current selection
    const savedResource = localStorage.getItem(STORAGE_KEY);
    
    if (selectedResource && resourceNames.includes(selectedResource)) {
      // Current selection is valid, create the client
      handleResourceSelect(selectedResource);
    } else if (savedResource && resourceNames.includes(savedResource)) {
      // Restore from localStorage
      handleResourceSelect(savedResource);
    } else {
      // Clear invalid selection
      setSelectedResource('');
      localStorage.removeItem(STORAGE_KEY);
      onVideoStoreSelected(null);
    }
  }, [resources, robotClient]);

  const handleResourceSelect = (resourceName: string) => {
    setSelectedResource(resourceName);

    if (resourceName && robotClient) {
      try {
        const videoStoreClient = new VIAM.GenericComponentClient(robotClient, resourceName);
        onVideoStoreSelected(videoStoreClient);
        localStorage.setItem(STORAGE_KEY, resourceName);
        setError(null);
      } catch (err) {
        console.error('Failed to create video store client:', err);
        setError(`Failed to connect to selected video store`);
        onVideoStoreSelected(null);
      }
    } else {
      onVideoStoreSelected(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Show label with message when robot not connected
  if (!robotClient) {
    return (
      <div className="video-store-selector">
        <label className="video-store-selector-label">
          Select video store resource
        </label>
        <div className="video-store-selector-message info">
          Connect to a robot to select a video store
        </div>
      </div>
    );
  }

  return (
    <div className="video-store-selector">
      <label htmlFor="video-store-select" className="video-store-selector-label">
        Select video store resource
      </label>

      <div style={{ position: 'relative' }}>
        <select
          id="video-store-select"
          value={selectedResource}
          onChange={(e) => handleResourceSelect(e.target.value)}
          disabled={isLoading}
          className="video-store-selector-select"
        >
          <option value="">
            {isLoading ? 'Loading resources...' : 'Select a video store resource'}
          </option>
          {resources.map((resource) => (
            <option key={resource.name} value={resource.name}>
              {resource.name}
            </option>
          ))}
        </select>

        {isLoading && (
          <div className="video-store-selector-spinner-container">
            <div className="video-store-selector-spinner"></div>
          </div>
        )}
      </div>

      {error && (
        <div className="video-store-selector-message error">
          {error}
        </div>
      )}

      {resources.length === 0 && !isLoading && !error && (
        <div className="video-store-selector-message info">
          No video store resources found
        </div>
      )}

      {selectedResource && !error && (
        <div className="video-store-selector-message success">
          ✓ Connected to: {selectedResource}
        </div>
      )}
    </div>
  );
};

export default VideoStoreSelector;
