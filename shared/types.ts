export const technologies = [
  'FDM',
  'SLA',
  'SLS',
  'MJF',
  'DMLS',
  'LASER',
  'CNC',
  'CNC_TURNING',
  'WOOD_CNC',
  'WATERJET',
  'PLASMA',
  'SHEET_METAL',
  'CAD',
] as const;
export const technologyNames: Record<string, [string, string]> = {
  FDM: ['FDM-печать', 'FDM printing'],
  SLA: ['SLA-печать', 'SLA printing'],
  SLS: ['SLS-печать', 'SLS printing'],
  MJF: ['MJF-печать', 'MJF printing'],
  DMLS: ['Печать металлом', 'Metal printing'],
  LASER: ['Лазерная резка', 'Laser cutting'],
  CNC: ['Фрезеровка ЧПУ', 'CNC milling'],
  CNC_TURNING: ['Токарная обработка ЧПУ', 'CNC turning'],
  WOOD_CNC: ['ЧПУ по дереву', 'CNC woodworking'],
  WATERJET: ['Гидроабразивная резка', 'Waterjet cutting'],
  PLASMA: ['Плазменная резка', 'Plasma cutting'],
  SHEET_METAL: ['Листовой металл и гибка', 'Sheet metal & bending'],
  CAD: ['Проектирование CAD', 'CAD engineering'],
};
export const technologyName = (value: string, lang: 'ru' | 'en') =>
  technologyNames[value]?.[lang === 'ru' ? 0 : 1] || value;
export const materials = [
  'PLA',
  'PETG',
  'ABS',
  'ASA',
  'TPU',
  'Nylon',
  'Resin',
  'Metal',
  'Wood',
  'Plywood',
  'Acrylic',
  'Aluminum',
  'Steel',
  'Any',
] as const;
export const currencies = ['RUB', 'USD', 'EUR', 'THB'] as const;
export type Currency = (typeof currencies)[number];
export type User = { id: string; name: string; email: string; role: 'member' | 'admin' };
export type Profile = {
  id: string;
  user_id: string;
  name: string;
  kind: 'studio' | 'engineer' | 'both';
  city: string;
  description: string;
  technologies: string[];
  materials: string[];
  website: string;
  lat: number | null;
  lng: number | null;
  verified: boolean;
  remote: boolean;
  demo: boolean;
};
export type JobStatus = 'open' | 'assigned' | 'delivered' | 'completed' | 'cancelled';
export type Job = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  kind: 'print' | 'design' | 'repair';
  city: string;
  technology: string;
  material: string;
  quantity: number;
  currency: Currency;
  budget: number | null;
  deadline: string;
  status: JobStatus;
  visibility: 'public' | 'direct';
  target_profile_id: string | null;
  file_id: string | null;
  created_at: number;
  accepted_offer_id: string | null;
  accepted_terms: AcceptedTerms | null;
  offers_count: number;
  version: number;
  demo: boolean;
  has_file: boolean;
  moderated: boolean;
};
export type AcceptedTerms = {
  offer_id: string;
  revision: number;
  profile_id: string;
  profile_name: string;
  price: number;
  currency: Currency;
  days: number;
  note: string;
  accepted_at: number;
};
export type Offer = {
  id: string;
  job_id: string;
  provider_id: string;
  profile_id: string;
  profile_name: string;
  revision: number;
  price: number;
  days: number;
  note: string;
  status: 'active' | 'superseded' | 'accepted' | 'declined' | 'withdrawn';
  created_at: number;
  conversation_id: string;
};
export type JobDetail = {
  job: Job;
  offers: Offer[];
  file: { id: string; name: string; size: number } | null;
  can_download: boolean;
  owner: boolean;
  assigned: boolean;
  conversation_id: string | null;
  conversations: { id: string; provider_id: string; profile_name: string }[];
};
export type Message = {
  id: number;
  conversation_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  hidden: boolean;
  created_at: number;
};
export type Notification = {
  id: number;
  title: string;
  path: string;
  seen: boolean;
  created_at: number;
};

export const technologyLabel = (value: string, t: (ru: string, en: string) => string) => {
  const names: Record<string, string> = {
    FDM: t('FDM-печать', 'FDM printing'),
    SLA: t('SLA-печать', 'SLA printing'),
    SLS: t('SLS-печать', 'SLS printing'),
    MJF: t('MJF-печать', 'MJF printing'),
    DMLS: t('Печать металлом', 'Metal printing'),
    LASER: t('Лазерная резка', 'Laser cutting'),
    CNC: t('Фрезеровка ЧПУ', 'CNC milling'),
    CNC_TURNING: t('Токарная обработка ЧПУ', 'CNC turning'),
    WOOD_CNC: t('ЧПУ по дереву', 'CNC woodworking'),
    WATERJET: t('Гидроабразивная резка', 'Waterjet cutting'),
    PLASMA: t('Плазменная резка', 'Plasma cutting'),
    SHEET_METAL: t('Листовой металл и гибка', 'Sheet metal & bending'),
    CAD: t('Проектирование CAD', 'CAD engineering'),
  };
  return names[value] || value;
};

/** Translate known material identifiers without changing unknown user-supplied names. */
export const materialLabel = (value: string, t: (ru: string, en: string) => string): string => {
  const names: Record<string, string> = {
    Nylon: t('Нейлон', 'Nylon'),
    Resin: t('Фотополимер', 'Resin'),
    Metal: t('Металл', 'Metal'),
    Wood: t('Дерево', 'Wood'),
    Plywood: t('Фанера', 'Plywood'),
    Acrylic: t('Акрил', 'Acrylic'),
    Aluminum: t('Алюминий', 'Aluminum'),
    Steel: t('Сталь', 'Steel'),
    Any: t('Любой материал', 'Any material'),
  };
  return names[value] || value;
};
