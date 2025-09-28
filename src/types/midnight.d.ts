// TypeScript definitions for Midnight blockchain integration (Lace Midnight wallet)
declare global {
  interface Window {
    midnight?: {
      lace?: {
        enable(): Promise<MidnightAPI>;
        isEnabled(): Promise<boolean>;
        apiVersion: string;
        name: string;
        icon: string;
      };
    };
  }
}

interface MidnightAPI {
  getNetworkId(): Promise<number>;
  getAddress(): Promise<string>;
  getAddresses(): Promise<string[]>;
  getBalance(): Promise<string>;
  getUtxos(): Promise<string[]>;
  signTx(tx: string): Promise<string>;
  signData(addr: string, payload: string): Promise<{
    signature: string;
    key: string;
  }>;
  submitTx(tx: string): Promise<string>;
  // Midnight-specific ZKP methods
  generateProof(circuit: string, inputs: any): Promise<string>;
  verifyProof(proof: string, publicInputs: any): Promise<boolean>;
  createPrivateState(data: any): Promise<string>;
}

export {};
