import type { Profile } from './types.js';

export type PublicStudioInput = {
  name: string;
  city: string;
  region: string;
  country: string;
  description: string;
  technologies: string[];
  materials: string[];
  website: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

export type CatalogStudio = {
  id: string;
  name: string;
  city: string;
  region: string;
  country: string;
  description: string;
  technologies: string[];
  materials: string[];
  website: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  source_name: string;
  source_url: string;
  imported_at: number;
  listing_type: 'imported' | 'self-published';
  version: number;
  updated_at: number;
};

export type DirectoryEntry =
  { source: 'member'; profile: Profile } | { source: 'catalog'; studio: CatalogStudio };

export type DirectoryResponse = {
  entries: DirectoryEntry[];
  total: number;
  members: number;
  catalog: number;
  has_more: boolean;
};

export type DirectoryMapPoint = {
  id: string;
  source: 'member' | 'catalog';
  name: string;
  city: string;
  lat: number;
  lng: number;
};

export type DirectoryMapResponse = {
  points: DirectoryMapPoint[];
  total: number;
  mappable: number;
  unmapped: number;
  truncated: boolean;
};
