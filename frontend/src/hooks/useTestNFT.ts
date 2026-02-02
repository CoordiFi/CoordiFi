import { useCallback, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { CONTRACTS, TEST_NFT_ABI } from '@/lib/contracts';

export function useTestNFT() {
    const { address } = useAccount();
    const [pendingTx, setPendingTx] = useState<`0x${string}` | null>(null);

    const { writeContractAsync, isPending: isWritePending } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash: pendingTx ?? undefined,
    });

    const { data: mintPrice } = useReadContract({
        address: CONTRACTS.TEST_NFT_CONTRACT as `0x${string}`,
        abi: TEST_NFT_ABI,
        functionName: 'MINT_PRICE',
    });

    const { data: nextTokenId } = useReadContract({
        address: CONTRACTS.TEST_NFT_CONTRACT as `0x${string}`,
        abi: TEST_NFT_ABI,
        functionName: 'nextTokenId',
    });

    const { data: userBalance, refetch: refetchBalance } = useReadContract({
        address: CONTRACTS.TEST_NFT_CONTRACT as `0x${string}`,
        abi: TEST_NFT_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    const clearPendingTx = useCallback(() => {
        setPendingTx(null);
    }, []);

    const publicMint = useCallback(async () => {
        try {
            console.log('[useTestNFT] Minting NFT...');

            const hash = await writeContractAsync({
                address: CONTRACTS.TEST_NFT_CONTRACT as `0x${string}`,
                abi: TEST_NFT_ABI,
                functionName: 'publicMint',
                value: parseEther('0.01'),
            });

            setPendingTx(hash);
            console.log('[useTestNFT] Mint TX:', hash);

            return {
                hash,
                expectedTokenId: nextTokenId ? Number(nextTokenId) : 1
            };
        } catch (error) {
            console.error('[useTestNFT] Mint failed:', error);
            throw error;
        }
    }, [writeContractAsync, nextTokenId]);

    const useTokenOfOwner = (index: number) => {
        return useReadContract({
            address: CONTRACTS.TEST_NFT_CONTRACT as `0x${string}`,
            abi: TEST_NFT_ABI,
            functionName: 'tokenOfOwnerByIndex',
            args: address ? [address, BigInt(index)] : undefined,
        });
    };

    return {
        isLoading: isWritePending || isConfirming,
        isConfirmed,
        pendingTx,
        clearPendingTx,

        mintPrice: mintPrice ? mintPrice : parseEther('0.01'),
        nextTokenId: nextTokenId ? Number(nextTokenId) : 1,
        userBalance: userBalance ? Number(userBalance) : 0,

        publicMint,
        refetchBalance,
        useTokenOfOwner,

        contractAddress: CONTRACTS.TEST_NFT_CONTRACT,
    };
}
