import { useParams, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useViamClients } from './ViamClientContext';

function VideoDetailPage() {
  const { machineInfo, videoId } = useParams<{ machineInfo: string, videoId: string }>();
  const [searchParams] = useSearchParams();
  const { locationId, machineName, organizationId, viamClient } = useViamClients();

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileName = searchParams.get('name');

  useEffect(() => {
    const fetchSignedUrl = async () => {
      try {
        if (!videoId) {
          setError('Video ID is required');
          return;
        }
        setLoading(true);
        const urlPath = `${organizationId}/${locationId}/${videoId}`;
        const url = await viamClient.dataClient.createBinaryDataSignedURL(urlPath, 60);
        setSignedUrl(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
        console.error('Error fetching signed URL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [viamClient, videoId, locationId, organizationId]);

  return (
    <div style={{ padding: '20px', width: '100%', height: '100%' }}>
      <a href={`/machine/${machineInfo}`} className="text-blue-500">Go to sanding history</a>
      <h2 className="font-semibold text-zinc-900">Sanding video</h2>
      <p><span className="font-semibold text-zinc-900">Location:</span> {locationId}</p>
      <p><span className="font-semibold text-zinc-900">Machine:</span> {machineName}</p>
      {fileName
        ? <p><span className="font-semibold text-zinc-900">File name:</span> {fileName}</p>
        : <p><span className="font-semibold text-zinc-900">File ID:</span> {videoId}</p>
      }

      {loading && <p>Loading video...</p>}
      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}
      {signedUrl && !loading && !error && (
        <video
          src={signedUrl}
          controls
          style={{ 
            width: '100%', 
            maxWidth: '1000px',
            aspectRatio: '16/9',
            borderRadius: '8px'
          }}
        />
      )}
    </div>
  );
}

export default VideoDetailPage;
