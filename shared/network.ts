/** A v1 node attests only to makers with accounts on that node. IDs are origin-scoped. */
export type NetworkWorkshop = {
  id: string;
  name: string;
  city: string;
  technologies: string[];
  lat: number | null;
  lng: number | null;
};

export type WorkshopFeed = {
  version: 1;
  workshops: NetworkWorkshop[];
  truncated: boolean;
};

export type WorkshopNode = {
  origin: string;
  available: boolean;
  truncated: boolean;
  workshops: NetworkWorkshop[];
};
