import { Chain, configureChains } from "wagmi";
import { mainnet, goerli } from "wagmi/chains";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { alchemyProvider } from "wagmi/providers/alchemy";

export const { chains, provider } = configureChains(
  [mainnet, goerli],
  [
    alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_KEY }),
    jsonRpcProvider({
      rpc: (localChain: Chain) => ({
        http: localChain.rpcUrls.default.http[0],
      }),
    }),
  ]
);
