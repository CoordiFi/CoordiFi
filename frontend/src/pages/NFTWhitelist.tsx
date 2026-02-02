import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import toast from 'react-hot-toast';
import { nftListings, NFTListingDB } from '../lib/supabase';
import { CONTRACTS, SUPREME_FACTORY_ABI, ERC20_ABI, NFT_ESCROW_ABI } from '../lib/contracts';

interface Listing {
    id: string;
    escrowAddress?: string;
    nftContract: string;
    collectionName: string;
    slotId: string;
    wlHolder: string;
    mintPrice: string;
    splitPercent: number;
    deadline: string;
    status: string;
}

export function NFTWhitelist() {
    const { address, isConnected } = useAccount();
    const [activeTab, setActiveTab] = useState<'create' | 'browse'>('browse');
    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);

    const loadListings = async () => {
        try {
            setLoading(true);
            const dbListings = await nftListings.getAll();
            const converted: Listing[] = dbListings.map(l => ({
                id: l.id || '',
                escrowAddress: l.escrow_address,
                nftContract: l.nft_contract,
                collectionName: l.collection_name || 'Unknown',
                slotId: l.slot_id || '0',
                wlHolder: l.wl_holder,
                mintPrice: l.mint_price,
                splitPercent: l.wl_holder_split_percent || 70,
                deadline: l.deadline || '',
                status: l.status,
            }));
            setListings(converted);
        } catch (err) {
            console.error('Failed to load listings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadListings();
    }, []);

    if (!isConnected) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-16 text-center">
                <h1 className="text-3xl font-bold text-white mb-4">NFT Whitelist Coordination</h1>
                <p className="text-gray-400 mb-8">Connect your wallet to create or join NFT whitelist pools</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">NFT Whitelist</h1>
                <p className="text-gray-400">Pool funds to coordinate whitelist spots for NFT mints</p>
            </div>

            <div className="flex gap-2 mb-8">
                <button
                    onClick={() => setActiveTab('browse')}
                    className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'browse' ? 'bg-primary-600 text-white' : 'bg-bg-elevated text-gray-400'}`}
                >
                    Browse Pools
                </button>
                <button
                    onClick={() => setActiveTab('create')}
                    className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'create' ? 'bg-primary-600 text-white' : 'bg-bg-elevated text-gray-400'}`}
                >
                    Create Pool
                </button>
            </div>

            {activeTab === 'browse' ? (
                <BrowsePools listings={listings} loading={loading} onRefresh={loadListings} />
            ) : (
                <CreatePool onCreated={() => { loadListings(); setActiveTab('browse'); }} />
            )}
        </div>
    );
}

function BrowsePools({ listings, loading, onRefresh }: { listings: Listing[]; loading: boolean; onRefresh: () => void }) {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const [contributingTo, setContributingTo] = useState<string | null>(null);
    const [contributeAmount, setContributeAmount] = useState('1');

    const handleContribute = async (listing: Listing) => {
        if (!listing.escrowAddress) {
            toast.error('Escrow not deployed yet');
            return;
        }

        try {
            setContributingTo(listing.id);
            const amount = parseUnits(contributeAmount, 6);

            const approveTx = await writeContractAsync({
                address: CONTRACTS.USDC as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [listing.escrowAddress as `0x${string}`, amount],
            });
            toast.success('Approval submitted');

            const contributeTx = await writeContractAsync({
                address: listing.escrowAddress as `0x${string}`,
                abi: NFT_ESCROW_ABI,
                functionName: 'contribute',
                args: [BigInt(contributeAmount)],
            });
            toast.success('Contribution submitted!');

            onRefresh();
        } catch (err: any) {
            toast.error(err.shortMessage || 'Failed to contribute');
        } finally {
            setContributingTo(null);
        }
    };

    if (loading) {
        return <div className="card p-8 text-center"><p className="text-gray-400">Loading...</p></div>;
    }

    if (listings.length === 0) {
        return <div className="card p-8 text-center"><p className="text-gray-400">No pools found. Create one!</p></div>;
    }

    return (
        <div className="grid gap-4">
            {listings.map(listing => (
                <div key={listing.id} className="card p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-semibold text-white">{listing.collectionName}</h3>
                            <p className="text-sm text-gray-400">Slot #{listing.slotId}</p>
                            <p className="text-sm text-gray-500 mt-1">
                                {listing.escrowAddress
                                    ? `Escrow: ${listing.escrowAddress.slice(0, 10)}...`
                                    : 'Pending deployment'}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className={`px-2 py-1 rounded text-xs ${
                                listing.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                listing.status === 'filled' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                            }`}>
                                {listing.status}
                            </span>
                            <p className="text-sm text-gray-400 mt-2">{listing.mintPrice} ETH mint</p>
                        </div>
                    </div>
                    {listing.status === 'active' && listing.wlHolder !== address && (
                        <div className="mt-4 flex gap-2 items-center">
                            <input
                                type="number"
                                value={contributeAmount}
                                onChange={e => setContributeAmount(e.target.value)}
                                className="input w-24"
                                placeholder="Slots"
                            />
                            <button
                                onClick={() => handleContribute(listing)}
                                disabled={contributingTo === listing.id}
                                className="btn-primary"
                            >
                                {contributingTo === listing.id ? 'Contributing...' : 'Contribute'}
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function CreatePool({ onCreated }: { onCreated: () => void }) {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        nftContract: '',
        collectionName: '',
        pricePerSlot: '',
        totalSlots: '',
        deadline: '',
    });

    const handleCreate = async () => {
        if (!address) return;

        try {
            setIsSubmitting(true);

            const deadlineTimestamp = Math.floor(new Date(formData.deadline).getTime() / 1000);
            const priceInUsdc = parseUnits(formData.pricePerSlot, 6);

            const tx = await writeContractAsync({
                address: CONTRACTS.SUPREME_FACTORY as `0x${string}`,
                abi: SUPREME_FACTORY_ABI,
                functionName: 'createNFTEscrow',
                args: [
                    formData.nftContract as `0x${string}`,
                    CONTRACTS.USDC as `0x${string}`,
                    priceInUsdc,
                    BigInt(formData.totalSlots),
                    BigInt(deadlineTimestamp),
                    true,
                ],
            });

            toast.success('Pool created!');

            await nftListings.create({
                nft_contract: formData.nftContract,
                collection_name: formData.collectionName,
                wl_holder: address,
                mint_price: formData.pricePerSlot,
                deadline: formData.deadline,
                status: 'active',
            });

            onCreated();
        } catch (err: any) {
            toast.error(err.shortMessage || 'Failed to create pool');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="card p-6 max-w-xl">
            <h2 className="text-xl font-semibold text-white mb-6">Create NFT Whitelist Pool</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm text-gray-400 mb-2">Collection Name</label>
                    <input
                        type="text"
                        placeholder="Azuki, BAYC, etc."
                        value={formData.collectionName}
                        onChange={e => setFormData({ ...formData, collectionName: e.target.value })}
                        className="input w-full"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-2">NFT Contract Address</label>
                    <input
                        type="text"
                        placeholder="0x..."
                        value={formData.nftContract}
                        onChange={e => setFormData({ ...formData, nftContract: e.target.value })}
                        className="input w-full"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Price per Slot (USDC)</label>
                        <input
                            type="number"
                            placeholder="100"
                            value={formData.pricePerSlot}
                            onChange={e => setFormData({ ...formData, pricePerSlot: e.target.value })}
                            className="input w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Total Slots</label>
                        <input
                            type="number"
                            placeholder="10"
                            value={formData.totalSlots}
                            onChange={e => setFormData({ ...formData, totalSlots: e.target.value })}
                            className="input w-full"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-2">Deadline</label>
                    <input
                        type="datetime-local"
                        value={formData.deadline}
                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                        className="input w-full"
                    />
                </div>
                <button
                    onClick={handleCreate}
                    disabled={isSubmitting}
                    className="btn-primary w-full mt-4"
                >
                    {isSubmitting ? 'Creating...' : 'Create Pool'}
                </button>
            </div>
        </div>
    );
}

