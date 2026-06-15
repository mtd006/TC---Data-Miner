export interface BusinessData {
  id: string;
  name: string;
  category: string;
  country: string;
  state: string;
  city: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

export interface SearchParams {
  category: string;
  country: string;
  state: string;
  city?: string;
}
