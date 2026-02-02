import { useWriteContract, useReadContract, useAccount, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { parseEther } from "viem";
import { useState, useCallback } from "react";
import { CONTRACTS, SUPREME_FACTORY_ABI, INSTANCE_TYPE } from "../lib/contracts";

export interface DeployNFTEscrowParams {
    wlHolder: `0x${string}`;
    capitalHolder: `0x${string}`;
    nftContract: `0x${string}`;
    mintPrice: string;
    splitBPS: number;
    deadline: number;
}

export interface DeployOTCEscrowParams {
    maker: `0x${string}`;
    assetA: `0x${string}`;
    assetB: `0x${string}`;
    amountA: bigint;
    amountB: bigint;
    toleranceBPS: number;
    deadline: number;
}

export interface MilestoneInput {
    worker: `0x${string}`;
    amount: bigint;
    deadline: bigint;
    revisionLimit: number;
    description: string;
    dependencies: number[];
}

export interface DeployFreelanceEscrowParams {
    client: `0x${string}`;
    paymentToken: `0x${string}`;
    totalAmount: bigint;
    milestones: MilestoneInput[];
}

export interface EscrowInstance {
    escrowAddress: `0x${string}`;
    creator: `0x${string}`;
    instanceType: number;
    createdAt: bigint;
    status: number;
}

export function useSupreme() {
    const { address: userAddress } = useAccount();
    const publicClient = usePublicClient();
    const [pendingTx, setPendingTx] = useState<`0x${string}` | null>(null);

    const { writeContractAsync, isPending: isWritePending } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: pendingTx ?? undefined,
    });

    const clearPendingTx = useCallback(() => {
        setPendingTx(null);
    }, []);

    const extractEscrowFromLogs = (logs: any[]): `0x${string}` | null => {
        const factoryAddress = CONTRACTS.SUPREME_FACTORY.toLowerCase();

        console.log('[useSupreme] Looking for logs from factory:', factoryAddress);
        console.log('[useSupreme] Total logs:', logs.length);

        for (const log of logs) {
            const logAddress = log.address?.toLowerCase();
            const topicsCount = log.topics?.length || 0;

            console.log('[useSupreme] Log from:', logAddress, 'topics:', topicsCount, 'isFactory:', logAddress === factoryAddress);

            if (logAddress === factoryAddress && log.topics && topicsCount >= 3) {
                const escrowTopic = log.topics[2];
                if (escrowTopic) {
                    const escrowAddress = `0x${escrowTopic.slice(-40)}` as `0x${string}`;
                    console.log('[useSupreme] ✅ Extracted escrow address:', escrowAddress);
                    return escrowAddress;
                }
            }
        }

        console.log('[useSupreme] Trying fallback extraction...');
        for (const log of logs) {
            if (log.topics && log.topics.length >= 3) {
                const potentialAddress = log.topics[2];
                if (potentialAddress && !potentialAddress.endsWith('0'.repeat(40))) {
                    const escrowAddress = `0x${potentialAddress.slice(-40)}` as `0x${string}`;
                    console.log('[useSupreme] ⚠️ Fallback extracted escrow address:', escrowAddress, 'from:', log.address);
                    return escrowAddress;
                }
            }
        }

        console.warn('[useSupreme] ❌ Could not find escrow address in any logs');
        return null;
    };

    const { data: platformFeeBPS } = useReadContract({
        address: CONTRACTS.SUPREME_FACTORY as `0x${string}`,
        abi: SUPREME_FACTORY_ABI,
        functionName: "platformFeeBPS",
    });

    const { data: totalInstances } = useReadContract({
        address: CONTRACTS.SUPREME_FACTORY as `0x${string}`,
        abi: SUPREME_FACTORY_ABI,
        functionName: "getTotalInstances",
    });

    const { data: userInstanceIds, refetch: refetchUserInstances } = useReadContract({
        address: CONTRACTS.SUPREME_FACTORY as `0x${string}`,
        abi: SUPREME_FACTORY_ABI,
        functionName: "getInstancesByUser",
        args: userAddress ? [userAddress] : undefined,
    });

    const deployNFTEscrow = useCallback(async (params: DeployNFTEscrowParams) => {
        if (!publicClient) throw new Error("No public client");

        try {
            const hash = await writeContractAsync({
                address: CONTRACTS.SUPREME_FACTORY as `0x${string}`,
                abi: SUPREME_FACTORY_ABI,
                functionName: "deployNFTEscrow",
                args: [
                    params.wlHolder,
                    params.capitalHolder,
                    params.nftContract,
                    parseEther(params.mintPrice),
                    BigInt(params.splitBPS),
                    BigInt(params.deadline),
                ],
            });

            setPendingTx(hash);
            console.log('[useSupreme] NFT Escrow deploy TX submitted:', hash);

            console.log('[useSupreme] Waiting for confirmation...');
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log('[useSupreme] TX confirmed, extracting escrow address...');

            const escrowAddress = extractEscrowFromLogs(receipt.logs);

            return { hash, escrowAddress };
        } catch (error) {
            console.error("Failed to deploy NFT Escrow:", error);
            throw error;
        }
    }, [writeContractAsync, publicClient]);

    const deployOTCEscrow = useCallback(async (params: DeployOTCEscrowParams) => {
        if (!publicClient) throw new Error("No public client");

        try {
            const hash = await writeContractAsync({
                address: CONTRACTS.SUPREME_FACTORY as `0x${string}`,
                abi: SUPREME_FACTORY_ABI,
                functionName: "deployOTCEscrow",
                args: [
                    params.maker,
                    params.assetA,
                    params.assetB,
                    params.amountA,
                    params.amountB,
                    BigInt(params.toleranceBPS),
                    BigInt(params.deadline),
                ],
            });

            setPendingTx(hash);
            console.log('[useSupreme] OTC Escrow deploy TX submitted:', hash);

            console.log('[useSupreme] Waiting for confirmation...');
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log('[useSupreme] TX confirmed, extracting escrow address...');

            const escrowAddress = extractEscrowFromLogs(receipt.logs);

            return { hash, escrowAddress };
        } catch (error) {
            console.error("Failed to deploy OTC Escrow:", error);
            throw error;
        }
    }, [writeContractAsync, publicClient]);

    const deployFreelanceEscrow = useCallback(async (params: DeployFreelanceEscrowParams) => {
        if (!publicClient) throw new Error("No public client");

        try {
            const milestonesForContract = params.milestones.map((m) => ({
                worker: m.worker,
                amount: m.amount,
                deadline: m.deadline,
                revisionLimit: BigInt(m.revisionLimit),
                description: m.description,
                dependencies: m.dependencies.map(d => BigInt(d)),
            }));

            const deploymentFeeBPS = BigInt(50);
            const BPS_DENOMINATOR = BigInt(10000);
            const deploymentFee = (params.totalAmount * deploymentFeeBPS) / BPS_DENOMINATOR;

            console.log('[useSupreme] Deploying Freelance Escrow with', params.milestones.length, 'milestones');
            console.log('[useSupreme] Deployment fee (0.5%):', deploymentFee.toString(), 'wei');

            const hash = await writeContractAsync({
                address: CONTRACTS.SUPREME_FACTORY as `0x${string}`,
                abi: SUPREME_FACTORY_ABI,
                functionName: "deployFreelanceEscrowWithMilestones",
                args: [
                    params.client,
                    params.paymentToken,
                    params.totalAmount,
                    milestonesForContract,
                ],
                value: deploymentFee,
            });

            setPendingTx(hash);
            console.log('[useSupreme] Freelance Escrow deploy TX submitted:', hash);

            console.log('[useSupreme] Waiting for confirmation...');
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log('[useSupreme] TX confirmed, receipt status:', receipt.status, 'logs:', receipt.logs.length);

            let escrowAddress = extractEscrowFromLogs(receipt.logs);

            if (!escrowAddress && receipt.logs.length === 0) {
                console.log('[useSupreme] Logs empty, trying direct RPC fallback...');

                const rpcEndpoints = [
                    'https://rpc.sepolia.org',
                    'https://ethereum-sepolia.publicnode.com',
                    'https://sepolia.drpc.org',
                ];

                for (const rpcUrl of rpcEndpoints) {
                    try {
                        console.log('[useSupreme] Trying RPC:', rpcUrl);
                        const rpcResponse = await fetch(rpcUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                id: 1,
                                method: 'eth_getTransactionReceipt',
                                params: [hash],
                            }),
                        });

                        const rpcData = await rpcResponse.json();

                        if (rpcData.result && rpcData.result.logs && rpcData.result.logs.length > 0) {
                            console.log('[useSupreme] RPC returned', rpcData.result.logs.length, 'logs');

                            const logs = rpcData.result.logs;
                            const factoryAddress = CONTRACTS.SUPREME_FACTORY.toLowerCase();

                            for (const log of logs) {
                                const logAddress = log.address?.toLowerCase();
                                const topics = log.topics || [];

                                console.log('[useSupreme] RPC Log:', logAddress, 'topics:', topics.length);

                                if (logAddress === factoryAddress && topics.length >= 3) {
                                    const escrowTopic = topics[2];
                                    if (escrowTopic) {
                                        escrowAddress = `0x${escrowTopic.slice(-40)}` as `0x${string}`;
                                        console.log('[useSupreme] ✅ RPC Fallback: Got escrow:', escrowAddress);
                                        break;
                                    }
                                }
                            }

                            if (escrowAddress) break;
                        } else {
                            console.log('[useSupreme] RPC returned no logs or null result');
                        }
                    } catch (e) {
                        console.warn('[useSupreme] RPC', rpcUrl, 'failed:', e);
                    }
                }
            }

            return { hash, escrowAddress };
        } catch (error) {
            console.error("Failed to deploy Freelance Escrow:", error);
            throw error;
        }
    }, [writeContractAsync, publicClient]);

    const useInstanceDetails = (instanceId: number) => {
        return useReadContract({
            address: CONTRACTS.SUPREME_FACTORY as `0x${string}`,
            abi: SUPREME_FACTORY_ABI,
            functionName: "getInstanceDetails",
            args: [BigInt(instanceId)],
        });
    };

    return {
        isLoading: isWritePending || isConfirming,
        isConfirmed,
        pendingTx,
        clearPendingTx,

        platformFeeBPS: platformFeeBPS ? Number(platformFeeBPS) / 100 : 5,
        totalInstances: totalInstances ? Number(totalInstances) : 0,
        userInstanceIds: userInstanceIds as bigint[] | undefined,

        deployNFTEscrow,
        deployOTCEscrow,
        deployFreelanceEscrow,
        refetchUserInstances,
        useInstanceDetails,

        INSTANCE_TYPE,
    };
}
