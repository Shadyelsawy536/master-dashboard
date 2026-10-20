import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

interface CustomerRow {
  id: string;
  restaurant_id: string;
  user_id: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

interface RestaurantOption {
  id: string;
  name: string;
}

interface AddressRow {
  id: string;
  customer_id: string;
  label: string | null;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  street: string | null;
  notes: string | null;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
}

function addressText(address: AddressRow) {
  return [
    address.street,
    address.building ? `Building ${address.building}` : null,
    address.floor ? `Floor ${address.floor}` : null,
    address.apartment ? `Apartment ${address.apartment}` : null,
  ].filter(Boolean).join(', ');
}

export function Customers() {
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [search, setSearch] = useState('');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [restaurantResult, customerPages] = await Promise.all([
        supabase.from('restaurants').select('id, name').is('deleted_at', null).order('name'),
        (async () => {
          const all: CustomerRow[] = [];
          const pageSize = 500;
          for (let from = 0; ; from += pageSize) {
            const { data, error: queryError } = await supabase
              .from('customers')
              .select('id, restaurant_id, user_id, full_name, phone, created_at')
              .order('created_at', { ascending: false })
              .range(from, from + pageSize - 1);
            if (queryError) throw queryError;
            const page = (data ?? []) as CustomerRow[];
            all.push(...page);
            if (page.length < pageSize) break;
          }
          return all;
        })(),
      ]);

      if (restaurantResult.error) throw restaurantResult.error;
      setRestaurants((restaurantResult.data ?? []) as RestaurantOption[]);
      setCustomers(customerPages);

      const allAddresses: AddressRow[] = [];
      for (let i = 0; i < customerPages.length; i += 200) {
        const ids = customerPages.slice(i, i + 200).map((customer) => customer.id);
        if (!ids.length) continue;
        const { data, error: addressError } = await supabase
          .from('customer_addresses')
          .select('id, customer_id, label, building, floor, apartment, street, notes, is_default, latitude, longitude')
          .in('customer_id', ids)
          .order('is_default', { ascending: false });
        if (addressError) throw addressError;
        allAddresses.push(...((data ?? []) as AddressRow[]));
      }
      setAddresses(allAddresses);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load platform customers.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const restaurantNames = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant.name])),
    [restaurants],
  );
  const addressByCustomer = useMemo(() => {
    const grouped = new Map<string, AddressRow[]>();
    for (const address of addresses) {
      const list = grouped.get(address.customer_id) ?? [];
      list.push(address);
      grouped.set(address.customer_id, list);
    }
    return grouped;
  }, [addresses]);

  const filtered = useMemo(() => {
    if (!customers) return null;
    const query = search.trim().toLocaleLowerCase();
    return customers.filter((customer) => {
      if (restaurantFilter !== 'all' && customer.restaurant_id !== restaurantFilter) return false;
      if (!query) return true;
      const customerAddresses = addressByCustomer.get(customer.id) ?? [];
      const haystack = [
        customer.full_name ?? '',
        customer.phone ?? '',
        restaurantNames.get(customer.restaurant_id) ?? '',
        ...customerAddresses.flatMap((address) => [
          address.label ?? '',
          addressText(address),
          address.notes ?? '',
        ]),
      ].join(' ').toLocaleLowerCase();
      return haystack.includes(query);
    });
  }, [customers, search, restaurantFilter, addressByCustomer, restaurantNames]);

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Customers</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">
            Customer directory across all restaurants, including saved delivery addresses. Customer records remain
            scoped to the restaurant they belong to.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={refreshing}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-60"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Customers shown</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{filtered?.length ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Restaurants represented</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {new Set((filtered ?? []).map((customer) => customer.restaurant_id)).size || (customers?.length === 0 ? 0 : '—')}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Saved addresses</p>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {(filtered ?? []).reduce((total, customer) => total + (addressByCustomer.get(customer.id)?.length ?? 0), 0) || (customers ? 0 : '—')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search name, phone, address, or restaurant…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-64 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <select
          value={restaurantFilter}
          onChange={(event) => setRestaurantFilter(event.target.value)}
          className="min-w-52 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="all">All restaurants</option>
          {restaurants.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Couldn't load customers: {error}
          <button onClick={() => void load()} className="ml-2 font-semibold underline">Try again</button>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Saved addresses</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {!filtered && !error && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink/40">Loading customers…</td></tr>
              )}
              {filtered?.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink/40">No customers match these filters.</td></tr>
              )}
              {filtered?.map((customer) => {
                const customerAddresses = addressByCustomer.get(customer.id) ?? [];
                return (
                  <tr key={customer.id} className="border-b border-line align-top last:border-0 hover:bg-canvas/30">
                    <td className="px-4 py-4">
                      <p className="font-medium text-ink">{customer.full_name?.trim() || 'Unnamed customer'}</p>
                      <p className="mt-1 text-xs text-ink/40">{customer.user_id ? 'Registered account' : 'Guest / no linked account'}</p>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-ink/70">{customer.phone || '—'}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                        {restaurantNames.get(customer.restaurant_id) ?? 'Unknown restaurant'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {customerAddresses.length === 0 ? (
                        <span className="text-ink/40">No saved addresses</span>
                      ) : (
                        <div className="space-y-3">
                          {customerAddresses.map((address) => (
                            <div key={address.id} className="max-w-lg">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-ink">{address.label?.trim() || 'Address'}</span>
                                {address.is_default && (
                                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium text-ink/60">Default</span>
                                )}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-ink/70">{addressText(address) || 'No address details'}</p>
                              {address.notes && <p className="mt-1 text-xs text-ink/40">Note: {address.notes}</p>}
                              {address.latitude != null && address.longitude != null && (
                                <a
                                  className="mt-1 inline-block text-xs font-medium text-accent hover:underline"
                                  href={`https://www.google.com/maps?q=${address.latitude},${address.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View map
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-ink/50">{new Date(customer.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink/40">
        Read-only directory. This page does not edit customer records or addresses. Data access is controlled by the existing platform-admin RLS policies.
      </p>
    </div>
  );
}
