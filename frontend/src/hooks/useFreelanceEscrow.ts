import { useWriteContract, useReadContract, useAccount, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { useState, useCallback } from "react";
import { FREELANCE_ESCROW_ABI } from "../lib/contracts";

export const FREELANCE_PHASE = {
    0: "Created",
    1: "Funded",
    2: "InProgress",
    3: "Completed",
    4: "Disputed",
    5: "Refunded",
} as const;

export const MILESTONE_STATUS = {
    0: "Pending",
    1: "Submitted",
    2: "UnderRevision",
    3: "Approved",
    4: "Paid",
    5: "Disputed",
    6: "Cancelled",
} as const;

export const DISPUTE_TYPE = {
    0: "None",
    1: "QualityIssue",
    2: "MissedDeadline",
    3: "ScopeChange",
    4: "NonPayment",
    5: "Abandonment",
} as const;

export interface ProjectInfo {
    client: `0x${string}`;
    paymentToken: `0x${string}`;
    totalAmount: bigint;
    totalPaid: bigint;
    platformFeeCollected: bigint;
    currentPhase: number;
    fundedAt: bigint;
    milestoneCount: bigint;
    completedMilestones: bigint;
    allMilestonesCreated: boolean;
}

export interface Milestone {
    milestoneId: bigint;
    worker: `0x${string}`;
    amount: bigint;
    deadline: bigint;
    revisionLimit: bigint;
    revisionCount: bigint;
    status: number;
    description: string;
    createdAt: bigint;
    exists: boolean;
}

export interface AddMilestoneParams {
    worker: `0x${string}`;
    amount: bigint;
    deadline: number;
    revisionLimit: number;
    description: string;
}

export function useFreelanceEscrow(escrowAddress: `0x${string}` | undefined) {
    const { address: userAddress } = useAccount();
    const publicClient = usePublicClient();
    const [pendingTx, setPendingTx] = useState<`0x${string}` | null>(null);

    const { writeContractAsync, isPending: isWritePending } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: pendingTx ?? undefined,
    });

    const { data: projectInfoRaw, refetch: refetchProjectInfo, isLoading: isProjectInfoLoading, isError: isProjectInfoError } = useReadContract({
        address: escrowAddress,
        abi: FREELANCE_ESCROW_ABI,
        functionName: "getProjectInfo",
    });

    const { data: milestonesRaw, refetch: refetchMilestones, isLoading: isMilestonesLoading } = useReadContract({
        address: escrowAddress,
        abi: FREELANCE_ESCROW_ABI,
        functionName: "getAllMilestones",
    });

    const { data: progressRaw, refetch: refetchProgress } = useReadContract({
        address: escrowAddress,
        abi: FREELANCE_ESCROW_ABI,
        functionName: "getProjectProgress",
    });

    const projectInfo: ProjectInfo | null = projectInfoRaw ? {
        client: projectInfoRaw[0],
        paymentToken: projectInfoRaw[1],
        totalAmount: projectInfoRaw[2],
        totalPaid: projectInfoRaw[3],
        platformFeeCollected: projectInfoRaw[4],
        currentPhase: projectInfoRaw[5],
        fundedAt: projectInfoRaw[6],
        milestoneCount: projectInfoRaw[7],
        completedMilestones: projectInfoRaw[8],
        allMilestonesCreated: projectInfoRaw[9],
    } : null;

    const milestones: Milestone[] = milestonesRaw ? (milestonesRaw as any[]).map((m) => ({
        milestoneId: m.milestoneId,
        worker: m.worker,
        amount: m.amount,
        deadline: m.deadline,
        revisionLimit: m.revisionLimit,
        revisionCount: m.revisionCount,
        status: m.status,
        description: m.description,
        createdAt: m.createdAt,
        exists: m.exists,
    })) : [];

    const progress = progressRaw ? {
        totalMilestones: Number(progressRaw[0]),
        completedMilestones: Number(progressRaw[1]),
        totalPaid: progressRaw[2],
        remainingAmount: progressRaw[3],
    } : null;

    const isClient = projectInfo?.client?.toLowerCase() === userAddress?.toLowerCase();
    const isWorker = milestones.some((m) => m.worker?.toLowerCase() === userAddress?.toLowerCase());
    const isParticipant = isClient || isWorker;

    const userMilestones = milestones.filter((m) => m.worker?.toLowerCase() === userAddress?.toLowerCase());

    const refetchAll = useCallback(async () => {
        await Promise.all([
            refetchProjectInfo(),
            refetchMilestones(),
            refetchProgress(),
        ]);
    }, [refetchProjectInfo, refetchMilestones, refetchProgress]);

    const addMilestone = useCallback(async (params: AddMilestoneParams) => {
        if (!escrowAddress) throw new Error("No escrow address");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: FREELANCE_ESCROW_ABI,
            functionName: "addMilestone",
            args: [
                params.worker,
                params.amount,
                BigInt(params.deadline),
                BigInt(params.revisionLimit),
                params.description,
            ],
        });

        setPendingTx(hash);
        console.log("[useFreelanceEscrow] Add milestone TX:", hash);
        return { hash };
    }, [escrowAddress, writeContractAsync]);

    const finalizeMilestones = useCallback(async () => {
        if (!escrowAddress) throw new Error("No escrow address");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: FREELANCE_ESCROW_ABI,
            functionName: "finalizeMilestones",
        });

        setPendingTx(hash);
        console.log("[useFreelanceEscrow] Finalize milestones TX:", hash);
        return { hash };
    }, [escrowAddress, writeContractAsync]);

    const depositFunds = useCallback(async (ethValue?: bigint) => {
        if (!escrowAddress) throw new Error("No escrow address");
        if (!publicClient) throw new Error("No public client");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: FREELANCE_ESCROW_ABI,
            functionName: "depositFunds",
            value: ethValue,
        });

        setPendingTx(hash);
        console.log("[useFreelanceEscrow] Deposit funds TX:", hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("[useFreelanceEscrow] Deposit confirmed:", receipt.status);

        return { hash, receipt };
    }, [escrowAddress, writeContractAsync, publicClient]);

    const submitWork = useCallback(async (milestoneId: bigint, ipfsHash: string, description: string) => {
        if (!escrowAddress) throw new Error("No escrow address");
        if (!publicClient) throw new Error("No public client");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: FREELANCE_ESCROW_ABI,
            functionName: "submitWork",
            args: [milestoneId, ipfsHash, description],
        });

        setPendingTx(hash);
        console.log("[useFreelanceEscrow] Submit work TX:", hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("[useFreelanceEscrow] Submit work confirmed:", receipt.status);
        await refetchAll();

        return { hash, receipt };
    }, [escrowAddress, writeContractAsync, publicClient, refetchAll]);

    const requestRevision = useCallback(async (milestoneId: bigint, feedback: string) => {
        if (!escrowAddress) throw new Error("No escrow address");
        if (!publicClient) throw new Error("No public client");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: FREELANCE_ESCROW_ABI,
            functionName: "requestRevision",
            args: [milestoneId, feedback],
        });

        setPendingTx(hash);
        console.log("[useFreelanceEscrow] Request revision TX:", hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("[useFreelanceEscrow] Request revision confirmed:", receipt.status);
        await refetchAll();

        return { hash, receipt };
    }, [escrowAddress, writeContractAsync, publicClient, refetchAll]);

    const approveMilestone = useCallback(async (milestoneId: bigint, milestoneAmount: bigint) => {
        if (!escrowAddress) throw new Error("No escrow address");
        if (!publicClient) throw new Error("No public client");

        const approvalFeeBPS = BigInt(250);
        const BPS_DENOMINATOR = BigInt(10000);
        const approvalFee = (milestoneAmount * approvalFeeBPS) / BPS_DENOMINATOR;

        console.log("[useFreelanceEscrow] Milestone amount:", milestoneAmount.toString());
        console.log("[useFreelanceEscrow] Approval fee (2.5%):", approvalFee.toString(), "wei");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: FREELANCE_ESCROW_ABI,
            functionName: "approveMilestone",
            args: [milestoneId],
            value: approvalFee,
        });

        setPendingTx(hash);
        console.log("[useFreelanceEscrow] Approve milestone TX:", hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("[useFreelanceEscrow] Approve confirmed:", receipt.status);
        await refetchAll();

        return { hash, receipt };
    }, [escrowAddress, writeContractAsync, publicClient, refetchAll]);

    const raiseDispute = useCallback(async (milestoneId: bigint, disputeType: number, reason: string) => {
        if (!escrowAddress) throw new Error("No escrow address");
        if (!publicClient) throw new Error("No public client");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: FREELANCE_ESCROW_ABI,
            functionName: "raiseDispute",
            args: [milestoneId, disputeType, reason],
        });

        setPendingTx(hash);
        console.log("[useFreelanceEscrow] Raise dispute TX:", hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("[useFreelanceEscrow] Raise dispute confirmed:", receipt.status);
        await refetchAll();

        return { hash, receipt };
    }, [escrowAddress, writeContractAsync, publicClient, refetchAll]);

    const getPhaseLabel = (phase: number) => FREELANCE_PHASE[phase as keyof typeof FREELANCE_PHASE] || "Unknown";

    const getMilestoneStatusLabel = (status: number) => MILESTONE_STATUS[status as keyof typeof MILESTONE_STATUS] || "Unknown";

    const getMilestoneDependencies = useCallback(async (milestoneId: bigint): Promise<number[]> => {
        if (!escrowAddress || !publicClient) return [];
        try {
            const deps = await publicClient.readContract({
                address: escrowAddress,
                abi: FREELANCE_ESCROW_ABI,
                functionName: "getMilestoneDependencies",
                args: [milestoneId],
            }) as bigint[];
            return deps.map(d => Number(d));
        } catch (e) {
            console.error("Error fetching dependencies:", e);
            return [];
        }
    }, [escrowAddress, publicClient]);

    const checkDependenciesCompleted = useCallback(async (milestoneId: bigint): Promise<boolean> => {
        if (!escrowAddress || !publicClient) return true;
        try {
            const completed = await publicClient.readContract({
                address: escrowAddress,
                abi: FREELANCE_ESCROW_ABI,
                functionName: "areDependenciesCompleted",
                args: [milestoneId],
            }) as boolean;
            return completed;
        } catch (e) {
            console.error("Error checking dependencies:", e);
            return true;
        }
    }, [escrowAddress, publicClient]);

    const resolveDispute = useCallback(async (milestoneId: bigint, winner: `0x${string}`) => {
        if (!escrowAddress) throw new Error("No escrow address");
        if (!publicClient) throw new Error("No public client");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: FREELANCE_ESCROW_ABI,
            functionName: "resolveDispute",
            args: [milestoneId, winner],
        });

        setPendingTx(hash);
        console.log("[useFreelanceEscrow] Resolve dispute TX:", hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log("[useFreelanceEscrow] Resolve dispute confirmed:", receipt.status);
        await refetchAll();

        return { hash, receipt };
    }, [escrowAddress, writeContractAsync, publicClient, refetchAll]);

    const getDispute = useCallback(async (milestoneId: bigint) => {
        if (!escrowAddress || !publicClient) return null;
        try {
            const dispute = await publicClient.readContract({
                address: escrowAddress,
                abi: FREELANCE_ESCROW_ABI,
                functionName: "getDispute",
                args: [milestoneId],
            }) as {
                milestoneId: bigint;
                disputeType: number;
                initiator: `0x${string}`;
                reason: string;
                raisedAt: bigint;
                resolved: boolean;
                winner: `0x${string}`;
                exists: boolean;
                previousStatus: number;
            };
            console.log("[getDispute] Raw response:", dispute);
            return {
                milestoneId: dispute.milestoneId,
                disputeType: dispute.disputeType,
                initiator: dispute.initiator,
                reason: dispute.reason,
                raisedAt: dispute.raisedAt,
                resolved: dispute.resolved,
                winner: dispute.winner,
                exists: dispute.exists,
                previousStatus: dispute.previousStatus,
            };
        } catch (e) {
            console.error("Error fetching dispute:", e);
            return null;
        }
    }, [escrowAddress, publicClient]);

    const cancelDispute = useCallback(async (milestoneId: bigint) => {
        if (!escrowAddress) throw new Error("No escrow address");

        const hash = await writeContractAsync({
            address: escrowAddress,
            abi: FREELANCE_ESCROW_ABI,
            functionName: "cancelDispute",
            args: [milestoneId],
        });

        setPendingTx(hash);
        console.log("[useFreelanceEscrow] Cancel dispute TX:", hash);
        return { hash };
    }, [escrowAddress, writeContractAsync]);

    return {
        isLoading: isWritePending || isConfirming || isProjectInfoLoading || isMilestonesLoading,
        isDataLoading: isProjectInfoLoading || isMilestonesLoading,
        isError: isProjectInfoError,
        isConfirmed,
        pendingTx,

        projectInfo,
        milestones,
        progress,
        phaseLabel: projectInfo ? getPhaseLabel(projectInfo.currentPhase) : null,

        isClient,
        isWorker,
        isParticipant,
        userMilestones,

        addMilestone,
        finalizeMilestones,
        depositFunds,
        submitWork,
        requestRevision,
        approveMilestone,
        raiseDispute,
        resolveDispute,
        cancelDispute,
        refetchAll,
        getDispute,

        getPhaseLabel,
        getMilestoneStatusLabel,
        getMilestoneDependencies,
        checkDependenciesCompleted,

        FREELANCE_PHASE,
        MILESTONE_STATUS,
        DISPUTE_TYPE,
    };
}
