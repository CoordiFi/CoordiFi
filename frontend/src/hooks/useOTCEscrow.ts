import { useWriteContract, useReadContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { useState, useCallback } from "react";
import { OTC_ESCROW_ABI, OTC_ESCROW_STATUS } from "../lib/contracts";

export interface OTCEscrowDetails {
    maker: `0x${string}`;
    taker: `0x${string}`;
    assetA: `0x${string}`;
    assetB: `0x${string}`;
    amountA: bigint;
    amountB: bigint;
    deadline: bigint;
    status: number;
}

export function useOTCEscrow(escrowAddress: `0x${string}` | undefined) {
    const { address: userAddress } = useAccount();
    const [pendingTx, setPendingTx] = useState<`0x${string}` | null>(null);

    const { writeContractAsync, isPending: isWritePending } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: pendingTx ?? undefined,
    });

    const { data: detailsRaw, refetch: refetchDetails } = useReadContract({
        address: escrowAddress,
        abi: OTC_ESCROW_ABI,
        functionName: "getDetails",
    });

    const { data: isPriceValid } = useReadContract({
        address: escrowAddress,
        abi: OTC_ESCROW_ABI,
        functionName: "isPriceValid",
    });

    const details: OTCEscrowDetails | null = detailsRaw ? {
        maker: detailsRaw[0],
        taker: detailsRaw[1],
        assetA: detailsRaw[2],
        assetB: detailsRaw[3],
        amountA: detailsRaw[4],
        amountB: detailsRaw[5],
        deadline: detailsRaw[6],
        status: detailsRaw[7],
    } : null;

    const isMaker = details?.maker === userAddress;
    const takerNotSet = details?.taker === '0x0000000000000000000000000000000000000000';
    const canBeTaker = takerNotSet && !isMaker && details?.status === 1;
    const isTaker = (details?.taker === userAddress) || canBeTaker;
    const isParticipant = isMaker || isTaker;

    const setUniswapPool = useCallback(async (poolAddress: `0x${string}`) => {
        if (!escrowAddress) throw new Error("No escrow address");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: OTC_ESCROW_ABI,
            functionName: "setUniswapPool",
            args: [poolAddress],
        });

        setPendingTx(hash);
        return { hash };
    }, [escrowAddress, writeContractAsync]);

    const makerLock = useCallback(async () => {
        if (!escrowAddress) throw new Error("No escrow address");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: OTC_ESCROW_ABI,
            functionName: "makerLock",
        });

        setPendingTx(hash);
        return { hash };
    }, [escrowAddress, writeContractAsync]);

    const takerLock = useCallback(async () => {
        if (!escrowAddress) throw new Error("No escrow address");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: OTC_ESCROW_ABI,
            functionName: "takerLock",
        });

        setPendingTx(hash);
        return { hash };
    }, [escrowAddress, writeContractAsync]);

    const validateAndSettle = useCallback(async () => {
        if (!escrowAddress) throw new Error("No escrow address");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: OTC_ESCROW_ABI,
            functionName: "validateAndSettle",
        });

        setPendingTx(hash);
        return { hash };
    }, [escrowAddress, writeContractAsync]);

    const refund = useCallback(async () => {
        if (!escrowAddress) throw new Error("No escrow address");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: OTC_ESCROW_ABI,
            functionName: "refund",
        });

        setPendingTx(hash);
        return { hash };
    }, [escrowAddress, writeContractAsync]);

    return {
        isLoading: isWritePending || isConfirming,
        isConfirmed,
        pendingTx,

        details,
        statusLabel: details ? OTC_ESCROW_STATUS[details.status as keyof typeof OTC_ESCROW_STATUS] : null,
        isPriceValid: isPriceValid ?? true,
        isMaker,
        isTaker,
        isParticipant,
        isExpired: details ? Number(details.deadline) < Date.now() / 1000 : false,

        setUniswapPool,
        makerLock,
        takerLock,
        validateAndSettle,
        refund,
        refetchDetails,

        OTC_ESCROW_STATUS,
    };
}
