// Types for currency API responses

export interface FiatCurrency {
  code: string;
  name: string;
  symbol: string;
}

export interface ChainInfo {
  id: string;
  name: string;
  logo?: string;
}

export interface TokenInfo {
  id: string;
  chainId: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

export interface AllCurrenciesResponse {
  fiat: FiatCurrency[];
  chains: ChainInfo[];
  tokens: TokenInfo[];
}

export interface ExchangeRateResponse {
  from: string;
  to: string;
  rate: number;
  timestamp: string;
}

export interface ConversionResponse {
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  timestamp: string;
  // If timeLockIn was requested
  isLockedRate?: boolean;
}
