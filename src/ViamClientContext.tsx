import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import Cookies from "js-cookie";

interface ViamClientContextType {
  apiKeyId: string;
  apiKeySecret: string;
  hostname: string;
  locationId: string | null;
  machineId: string;
  machineName: string | null;
  organizationId: string | null;
  robotClient: VIAM.RobotClient | null;
  viamClient: VIAM.ViamClient;
}

const ViamClientContext = createContext<ViamClientContextType | undefined>(undefined);

const locationIdRegex = /main\.([^.]+)\.viam\.cloud/;
const machineNameRegex = /\/machine\/(.+?)-main\./;

async function connect(apiKeyId: string, apiKeySecret: string): Promise<VIAM.ViamClient> {
  const opts: VIAM.ViamClientOptions = {
    serviceHost: "https://app.viam.com",
    credentials: {
      type: "api-key",
      authEntity: apiKeyId,
      payload: apiKeySecret,
    },
  };

  return await VIAM.createViamClient(opts);
}

export function ViamClientProvider({ children }: { children: ReactNode }) {
  const [viamClient, setViamClient] = useState<VIAM.ViamClient | null>(null);
  const [robotClient, setRobotClient] = useState<VIAM.RobotClient | null>(null);
  const [errorCreatingViamClient, setErrorCreatingViamClient] = useState(false);

  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const machineNameMatch = window.location.pathname.match(machineNameRegex);
  const machineName = machineNameMatch ? machineNameMatch[1] : null;

  const locationIdMatch = window.location.pathname.match(locationIdRegex);
  const locationId = locationIdMatch ? locationIdMatch[1] : null;

  const machineInfo = window.location.pathname.split("/")[2];

  const {
    apiKey: { id: apiKeyId, key: apiKeySecret },
    machineId,
    hostname,
  } = JSON.parse(Cookies.get(machineInfo)!);


  useEffect(() => {
    const initializeClients = async () => {
      setErrorCreatingViamClient(false);
      setViamClient(null);
      setRobotClient(null);
      setOrganizationId(null);
      console.log("Initializing Viam clients");

      let viamClient;
      try {
        viamClient = await connect(apiKeyId, apiKeySecret);
        setViamClient(viamClient);
      } catch (error) {
        console.error('Failed to create viam client:', error);
        setErrorCreatingViamClient(true);
        return;
      }
      
      try {
        const organizations = await viamClient.appClient.listOrganizations();
        if (organizations.length !== 1) {
          console.warn("expected 1 organization, got " + organizations.length);
          return;
        }

        setOrganizationId(organizations[0].id);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
        return;
      }

      try {
        const robotClient = await viamClient.connectToMachine({
          host: hostname,
          id: machineId,
        });
        setRobotClient(robotClient);
      } catch (error) {
        console.error('Failed to create robot client:', error);
      }
    };

    initializeClients();
  }, [apiKeyId, apiKeySecret, hostname, machineId]);

  if (errorCreatingViamClient) {
    return <div>Error creating Viam client</div>;
  }

  if (!viamClient) {
    return <div>Loading Viam client...</div>;
  }

  return (
    <ViamClientContext.Provider
      value={{
        apiKeyId,
        apiKeySecret,
        hostname,
        locationId,
        machineId,
        machineName,
        organizationId,
        viamClient,
        robotClient,
      }}
    >
      {children}
    </ViamClientContext.Provider>
  );
}

export function useViamClient() {
  const context = useContext(ViamClientContext);
  if (context === undefined) {
    throw new Error('useViamClient must be used within a ViamClientProvider');
  }
  return context;
}
