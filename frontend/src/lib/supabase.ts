import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface NFTListingDB {
    id?: string;
    escrow_address?: string;
    nft_contract: string;
    collection_name?: string;
    slot_id?: string;
    wl_holder: string;
    investor?: string;
    mint_price: string;
    wl_holder_split_percent?: number;
    deadline?: string;
    status: string;
    created_at?: string;
}

export interface OTCOfferDB {
    id?: string;
    escrow_address?: string;
    maker_address: string;
    taker_address?: string;
    sell_token: string;
    sell_amount: string;
    buy_token: string;
    buy_amount: string;
    tolerance_percent?: number;
    deadline?: string;
    status: string;
    created_at?: string;
}

export interface FreelanceProjectDB {
    id?: string;
    escrow_address: string;
    title: string;
    description?: string;
    client_address: string;
    contractor_address: string;
    total_amount: string;
    status: string;
    created_at?: string;
}

export const nftListings = {
    async getAll(): Promise<NFTListingDB[]> {
        const { data, error } = await supabase
            .from('nft_listings')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async create(listing: NFTListingDB): Promise<NFTListingDB | null> {
        const { data, error } = await supabase
            .from('nft_listings')
            .insert(listing)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<NFTListingDB>): Promise<NFTListingDB | null> {
        const { data, error } = await supabase
            .from('nft_listings')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getByAddress(escrowAddress: string): Promise<NFTListingDB | null> {
        const { data, error } = await supabase
            .from('nft_listings')
            .select('*')
            .eq('escrow_address', escrowAddress)
            .single();
        if (error) return null;
        return data;
    },
};

export const otcOffers = {
    async getAll(): Promise<OTCOfferDB[]> {
        const { data, error } = await supabase
            .from('otc_offers')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async create(offer: OTCOfferDB): Promise<OTCOfferDB | null> {
        const { data, error } = await supabase
            .from('otc_offers')
            .insert(offer)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<OTCOfferDB>): Promise<OTCOfferDB | null> {
        const { data, error } = await supabase
            .from('otc_offers')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};

export const freelanceProjects = {
    async getAll(): Promise<FreelanceProjectDB[]> {
        const { data, error } = await supabase
            .from('freelance_projects')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async create(project: FreelanceProjectDB): Promise<FreelanceProjectDB | null> {
        const { data, error } = await supabase
            .from('freelance_projects')
            .insert(project)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getByAddress(escrowAddress: string): Promise<FreelanceProjectDB | null> {
        const { data, error } = await supabase
            .from('freelance_projects')
            .select('*')
            .eq('escrow_address', escrowAddress)
            .single();
        if (error) return null;
        return data;
    },
};
