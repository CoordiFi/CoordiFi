import { useReadContract } from "wagmi";
import { useMemo } from "react";
import { FREELANCE_ESCROW_ABI } from "../lib/contracts";
import { MILESTONE_STATUS, Milestone } from "./useFreelanceEscrow";

export interface MilestoneDetails extends Milestone {
    timeRemaining: number;
    isOverdue: boolean;
    progressPercentage: number;
    statusLabel: string;
}

export function useMilestone(
    escrowAddress: `0x${string}` | undefined,
    milestoneId: bigint | undefined
) {
    const { data: milestoneRaw, refetch, isLoading } = useReadContract({
        address: escrowAddress,
        abi: FREELANCE_ESCROW_ABI,
        functionName: "getMilestone",
        args: milestoneId !== undefined ? [milestoneId] : undefined,
    });

    const milestone: MilestoneDetails | null = useMemo(() => {
        if (!milestoneRaw) return null;

        const rawData = milestoneRaw as any;

        const deadline = Number(rawData[3]);
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = deadline > 0 ? deadline - now : -1;
        const isOverdue = deadline > 0 && now > deadline;
        const status = rawData[6];

        const progressMap: Record<number, number> = {
            0: 0,
            1: 50,
            2: 25,
            3: 75,
            4: 100,
            5: 0,
            6: 0,
        };

        return {
            milestoneId: rawData[0],
            worker: rawData[1],
            amount: rawData[2],
            deadline: rawData[3],
            revisionLimit: rawData[4],
            revisionCount: rawData[5],
            status: status,
            description: rawData[7],
            createdAt: rawData[8],
            exists: rawData[9],
            timeRemaining,
            isOverdue,
            progressPercentage: progressMap[status] || 0,
            statusLabel: MILESTONE_STATUS[status as keyof typeof MILESTONE_STATUS] || "Unknown",
        };
    }, [milestoneRaw]);

    const canSubmitWork = milestone?.status === 0 || milestone?.status === 2;
    const canApprove = milestone?.status === 1;
    const canRequestRevision = milestone?.status === 1 &&
        (milestone?.revisionCount ?? 0n) < (milestone?.revisionLimit ?? 0n);
    const canDispute = milestone?.status === 0 || milestone?.status === 1 || milestone?.status === 2;
    const isPaid = milestone?.status === 4;
    const isCancelled = milestone?.status === 6;
    const isDisputed = milestone?.status === 5;

    const formatTimeRemaining = (seconds: number): string => {
        if (seconds < 0) return "No deadline";
        if (seconds <= 0) return "Overdue";

        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    return {
        milestone,
        isLoading,

        timeRemainingFormatted: milestone ? formatTimeRemaining(milestone.timeRemaining) : null,

        canSubmitWork,
        canApprove,
        canRequestRevision,
        canDispute,
        isPaid,
        isCancelled,
        isDisputed,

        refetch,

        formatTimeRemaining,
    };
}

export function useWorkerMilestones(
    escrowAddress: `0x${string}` | undefined,
    workerAddress: `0x${string}` | undefined
) {
    const { data: allMilestones, refetch, isLoading } = useReadContract({
        address: escrowAddress,
        abi: FREELANCE_ESCROW_ABI,
        functionName: "getAllMilestones",
    });

    const workerMilestones = useMemo(() => {
        if (!allMilestones || !workerAddress) return [];
        return (allMilestones as any[])
            .filter((m) => m.worker?.toLowerCase() === workerAddress.toLowerCase())
            .map((m) => ({
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
            })) as Milestone[];
    }, [allMilestones, workerAddress]);

    const pendingCount = workerMilestones.filter((m) => m.status === 0).length;
    const submittedCount = workerMilestones.filter((m) => m.status === 1).length;
    const paidCount = workerMilestones.filter((m) => m.status === 4).length;
    const totalEarned = workerMilestones
        .filter((m) => m.status === 4)
        .reduce((sum, m) => sum + m.amount, 0n);

    return {
        milestones: workerMilestones,
        isLoading,
        pendingCount,
        submittedCount,
        paidCount,
        totalEarned,
        refetch,
    };
}
