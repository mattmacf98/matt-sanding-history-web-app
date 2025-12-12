import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import Cookies from "js-cookie";

interface ViamClientContextType {
  locationId: string;
  machineId: string;
  machineName: string;
  organizationId: string;
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
  const [initializationErrors, setInitializationErrors] = useState<string[]>([]);

  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Parse URL and cookie data.
  const urlAndCookieData = useMemo(() => {
    const errors: string[] = [];
    let apiKeyId: string | undefined;
    let apiKeySecret: string | undefined;
    let machineId: string | undefined;
    let hostname: string | undefined;
    let machineName: string | null = null;
    let locationId: string | null = null;

    const machineInfo = window.location.pathname.split("/")[2];
    if (!machineInfo) {
      errors.push("Invalid URL format. Expected: /machine/[machine-name]-main.[location-id].viam.cloud");
    }

    // Parse machine name and location from URL
    const machineNameMatch = window.location.pathname.match(machineNameRegex);
    if (!machineNameMatch) {
      errors.push("Could not parse machine name from URL");
    } else {
      machineName = machineNameMatch[1];
    }

    const locationIdMatch = window.location.pathname.match(locationIdRegex);
    if (!locationIdMatch) {
      console.error("Could not parse location ID from URL");
      errors.push("Could not parse location ID from URL");
    } else {
      locationId = locationIdMatch[1];
    }

    // Parse cookie data
    if (machineInfo) {
      const cookieData = Cookies.get(machineInfo);
      if (!cookieData) {
        errors.push(`No credentials found for machine: ${machineInfo}`);
      } else {
        try {
          const parsed = JSON.parse(cookieData);

          apiKeyId = parsed?.apiKey?.id;
          apiKeySecret = parsed?.apiKey?.key;
          hostname = parsed?.hostname;
          machineId = parsed?.machineId;

          if (!apiKeyId) {
            errors.push("Missing API key ID in cookie data");
          }
          if (!apiKeySecret) {
            errors.push("Missing API key secret in cookie data");
          }
          if (!hostname) {
            errors.push("Missing hostname in cookie data");
          }
          if (!machineId) {
            errors.push("Missing machine ID in cookie data");
          }
        } catch (error) {
          errors.push(`Failed to parse cookie data: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return {
      apiKeyId,
      apiKeySecret,
      hostname,
      locationId,
      machineId,
      machineName,
      errors,
    };
  }, []); // Only run once on mount.

  // Set errors in a useEffect to avoid setState during render
  useEffect(() => {
    if (urlAndCookieData.errors.length > 0) {
      setInitializationErrors(urlAndCookieData.errors);
    }
  }, [urlAndCookieData.errors]);


  useEffect(() => {
    // Skip initialization if configuration parsing failed.
    if (!urlAndCookieData.apiKeyId || !urlAndCookieData.apiKeySecret || !urlAndCookieData.hostname || !urlAndCookieData.machineId) {
      return;
    }

    const initializeClients = async () => {
      setInitializationErrors([]);
      setViamClient(null);
      setRobotClient(null);
      setOrganizationId(null);

      console.log("Initializing Viam clients");

      let viamClient;
      try {
        viamClient = await connect(urlAndCookieData.apiKeyId!, urlAndCookieData.apiKeySecret!);
        setViamClient(viamClient);
      } catch (error) {
        console.error('Failed to create viam client:', error);
        setInitializationErrors((prev) =>
          [...prev, `Failed to create viam client: ${error instanceof Error ? error.message : String(error)}`]
        );
        return;
      }
      
      try {
        const organizations = await viamClient.appClient.listOrganizations();
        if (organizations.length !== 1) {
          throw new Error(`expected 1 organization, got ${organizations.length}`);
        }

        setOrganizationId(organizations[0].id);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
        setInitializationErrors((prev) =>
          [...prev, `Failed to get organization ID: ${error instanceof Error ? error.message : String(error)}`]
        );
        return;
      }

      try {
        const robotClient = await viamClient.connectToMachine({
          host: urlAndCookieData.hostname,
          id: urlAndCookieData.machineId,
        });
        setRobotClient(robotClient);
      } catch (error) {
        console.error('Failed to create robot client:', error);
      }
    };

    initializeClients();
  }, [urlAndCookieData.apiKeyId, urlAndCookieData.apiKeySecret, urlAndCookieData.hostname, urlAndCookieData.machineId]);

  // Display errors if any occurred during initialization.
  if (initializationErrors.length > 0) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Errors encountered during initialization</h2>
        <ul style={{ color: '#dc2626' }}>
          {initializationErrors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </div>
    );
  }

  // Display loading message if initialization is still in progress.
  if (!viamClient || !urlAndCookieData.machineId || !urlAndCookieData.locationId || !urlAndCookieData.machineName || !organizationId) {
    return <div>Initializing...</div>;
  }

  return (
    <ViamClientContext.Provider
      value={{
        locationId: urlAndCookieData.locationId,
        machineId: urlAndCookieData.machineId,
        machineName: urlAndCookieData.machineName,
        organizationId,
        viamClient,
        robotClient,
      }}
    >
      {children}
    </ViamClientContext.Provider>
  );
}

export function useViamClients() {
  const context = useContext(ViamClientContext);
  if (context === undefined) {
    throw new Error('useViamClients must be used within a ViamClientProvider');
  }
  return context;
}
