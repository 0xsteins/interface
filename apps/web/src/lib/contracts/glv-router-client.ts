import { prepareAndSign } from "@/lib/soroban/tx-builder"
import { queryClient } from "@/app/providers/QueryProvider"
import { CONTRACTS } from "@/app/config/contracts"
import { NETWORK } from "@/app/config/network"
import { parseSorobanError } from "@/lib/soroban/errors"
import { queryKeys } from "@/shared/lib/query-keys"
import { submitTx } from "@/shared/hooks/useTxSubmit"
import { walletKit } from "@/features/wallet/lib/wallet-kit"
import { Client as GlvRouterClient } from "@/lib/contracts/generated/glv-router/src"
import type {
  CreateDepositParams as GeneratedCreateDepositParams,
  CreateWithdrawalParams as GeneratedCreateWithdrawalParams,
  GlvInfo,
} from "@/lib/contracts/generated/glv-router/src"

const CHAIN_ID = "stellar-mainnet"

let glvClient: GlvRouterClient | null = null

function getGlvClient(): GlvRouterClient {
  if (!CONTRACTS.glvRouter) {
    throw new Error("GLV router is not deployed on this network.")
  }

  glvClient ??= new GlvRouterClient({
    contractId: CONTRACTS.glvRouter,
    networkPassphrase: NETWORK.networkPassphrase,
    rpcUrl: import.meta.env.VITE_RPC_URL,
  })

  return glvClient
}

export type CreateDepositParams = GeneratedCreateDepositParams
export type CreateWithdrawalParams = GeneratedCreateWithdrawalParams

function isValidAccount(account: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(account)
}

export async function createDeposit(params: CreateDepositParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before creating a GLV deposit.")
  }

  return submitTx(
    async () => {
      const tx = await getGlvClient().createDeposit(params)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: "Submitting GLV deposit...",
      successMessage: "GLV deposit submitted successfully.",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.tokenBalances(CHAIN_ID, params.account) })
        queryClient.invalidateQueries({ queryKey: ["tokenBalances", params.account] })
        queryClient.invalidateQueries({ queryKey: queryKeys.earn.glvVaultData(params.glvAddress, params.account) })
      },
      onError: parseSorobanError,
    },
  )
}

export async function createWithdrawal(params: CreateWithdrawalParams): Promise<string> {
  if (!isValidAccount(params.account)) {
    throw new Error("Connect your wallet before creating a GLV withdrawal.")
  }

  return submitTx(
    async () => {
      const tx = await getGlvClient().createWithdrawal(params)
      return prepareAndSign(tx, walletKit, NETWORK.networkPassphrase)
    },
    {
      loadingMessage: "Submitting GLV withdrawal...",
      successMessage: "GLV withdrawal submitted successfully.",
      successDescription: (hash) => `Tx: ${hash.slice(0, 8)}...`,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.trade.tokenBalances(CHAIN_ID, params.account) })
        queryClient.invalidateQueries({ queryKey: ["tokenBalances", params.account] })
        queryClient.invalidateQueries({ queryKey: queryKeys.earn.glvVaultData(params.glvAddress, params.account) })
      },
      onError: parseSorobanError,
    },
  )
}

export async function getGlvInfo(glvAddress: string): Promise<GlvInfo> {
  return getGlvClient().getGlvInfo(glvAddress)
}
