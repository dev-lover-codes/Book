'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  getInventory, 
  addInventoryItem, 
  addStationerySale, 
  getStationerySales, 
  checkLowStock 
} from '@/app/actions/stationery';
import { 
  Plus, 
  AlertTriangle, 
  ShoppingBag, 
  BookOpen, 
  Layers, 
  TrendingUp, 
  Loader2, 
  CheckCircle,
  FileText,
  AlertCircle
} from 'lucide-react';

interface InventoryItem {
  id: number;
  item_name: string;
  category: 'books' | 'pens' | 'notebooks' | 'art_supplies' | 'other';
  stock_quantity: number;
  cost_price: number;
  selling_price: number;
  low_stock_threshold: number;
}

interface CounterSale {
  id: string;
  quantity_sold: number;
  total_amount: number;
  created_at: string;
  inventory?: {
    item_name: string;
    category: string;
    selling_price: number;
  } | null;
}

interface StationeryManagerProps {
  retailerId: string;
  lang: 'en' | 'hi';
}

export default function StationeryManager({ retailerId, lang }: StationeryManagerProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [salesHistory, setSalesHistory] = useState<CounterSale[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Add Item form states
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<'books' | 'pens' | 'notebooks' | 'art_supplies' | 'other'>('books');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [costPrice, setCostPrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [threshold, setThreshold] = useState('5');

  // Quick Counter Sale form states
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [saleQty, setSaleQty] = useState('1');

  // Compute sale total dynamically during render to avoid useEffect state synchronization loops
  const selectedItem = inventory.find(i => String(i.id) === selectedItemId);
  const computedTotal = selectedItem ? selectedItem.selling_price * (parseInt(saleQty) || 0) : 0;

  // Load everything
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, lowRes, salesRes] = await Promise.all([
        getInventory(retailerId),
        checkLowStock(retailerId),
        getStationerySales(retailerId)
      ]);

      if (invRes.success && invRes.data) {
        setInventory(invRes.data as InventoryItem[]);
      }
      if (lowRes.success && lowRes.data) {
        setLowStockItems(lowRes.data as InventoryItem[]);
      }
      if (salesRes.success && salesRes.data) {
        setSalesHistory(salesRes.data as unknown as CounterSale[]);
      }
    } catch (err) {
      console.error('Error loading stationery data:', err);
    } finally {
      setLoading(false);
    }
  }, [retailerId]);

  // Fetch initial data asynchronously to avoid synchronous setState cascading render warning
  useEffect(() => {
    let active = true;
    const run = async () => {
      await Promise.resolve();
      if (active) {
        loadData();
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [loadData]);

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName) {
      setFormError(lang === 'hi' ? 'कृपया वस्तु का नाम दर्ज करें।' : 'Please enter the item name.');
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setActionLoading(true);

    try {
      const res = await addInventoryItem(retailerId, {
        item_name: itemName,
        category,
        stock_quantity: parseInt(stockQuantity) || 0,
        cost_price: parseFloat(costPrice) || 0,
        selling_price: parseFloat(sellingPrice) || 0,
        low_stock_threshold: parseInt(threshold) || 5
      });

      if (res.success) {
        setFormSuccess(
          lang === 'hi' 
            ? 'वस्तु सफलतापूर्वक इन्वेंट्री में जोड़ी गई!' 
            : 'Item successfully added to inventory!'
        );
        setItemName('');
        setStockQuantity('10');
        setCostPrice('0');
        setSellingPrice('0');
        setThreshold('5');
        // Reload
        await loadData();
      } else {
        setFormError(res.error || 'Failed to add item.');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      setFormError(lang === 'hi' ? 'कृपया बिक्री के लिए एक वस्तु चुनें।' : 'Please select an item to sell.');
      return;
    }

    const qty = parseInt(saleQty) || 0;
    if (qty <= 0) {
      setFormError(lang === 'hi' ? 'बिक्री मात्रा 1 से अधिक होनी चाहिए।' : 'Sales quantity must be at least 1.');
      return;
    }

    const selectedItem = inventory.find(i => String(i.id) === selectedItemId);
    if (!selectedItem) return;

    if (selectedItem.stock_quantity < qty) {
      setFormError(
        lang === 'hi'
          ? `अपर्याप्त स्टॉक। केवल ${selectedItem.stock_quantity} उपलब्ध हैं।`
          : `Insufficient stock. Only ${selectedItem.stock_quantity} available.`
      );
      return;
    }

    setFormError(null);
    setFormSuccess(null);
    setActionLoading(true);

    try {
      const res = await addStationerySale(retailerId, {
        item_id: parseInt(selectedItemId),
        quantity_sold: qty,
        total_amount: computedTotal
      });

      if (res.success) {
        setFormSuccess(
          lang === 'hi'
            ? `काउंटर बिक्री दर्ज की गई! ₹${computedTotal} प्राप्त हुए।`
            : `Counter sale logged! Received ₹${computedTotal}.`
        );
        setSelectedItemId('');
        setSaleQty('1');
        await loadData();
      } else {
        setFormError(res.error || 'Failed to log sale.');
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/10 border border-zinc-800 rounded-3xl min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        <p className="text-xs text-zinc-400 mt-2 font-semibold">
          {lang === 'hi' ? 'स्टेशनरी डेटा लोड हो रहा है...' : 'Loading stationery details...'}
        </p>
      </div>
    );
  }

  // Derived stats
  const totalUniqueItems = inventory.length;
  const totalStockItems = inventory.reduce((acc, curr) => acc + curr.stock_quantity, 0);
  const lowStockCount = lowStockItems.length;

  return (
    <div className="space-y-6 animate-slide-up">
      
      {/* 1. Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Unique Items */}
        <div className="bg-[#121218] border border-zinc-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-500">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-zinc-400 font-medium">
              {lang === 'hi' ? 'कुल विशिष्ट पुस्तकें/वस्तुएँ' : 'Total Unique Items'}
            </span>
            <h3 className="text-2xl font-bold text-white mt-0.5">{totalUniqueItems}</h3>
          </div>
        </div>

        {/* Card 2: Total Stock */}
        <div className="bg-[#121218] border border-zinc-800/80 rounded-2xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-zinc-400 font-medium">
              {lang === 'hi' ? 'कुल स्टॉक स्तर' : 'Total Stock Level'}
            </span>
            <h3 className="text-2xl font-bold text-white mt-0.5">{totalStockItems}</h3>
          </div>
        </div>

        {/* Card 3: Low Stock Alert Card */}
        <div className={`border rounded-2xl p-5 flex items-center gap-4 transition-all duration-300 ${
          lowStockCount > 0 
            ? 'bg-red-500/5 border-red-500/20 shadow-[0_4px_20px_rgba(239,68,68,0.05)]' 
            : 'bg-[#121218] border-zinc-800/80'
        }`}>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
            lowStockCount > 0 
              ? 'bg-red-500/10 border border-red-500/20 text-red-400 animate-pulse' 
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
          }`}>
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-zinc-400 font-medium">
              {lang === 'hi' ? 'कम स्टॉक अलर्ट' : 'Low Stock Alerts'}
            </span>
            <h3 className={`text-2xl font-bold mt-0.5 ${lowStockCount > 0 ? 'text-red-400' : 'text-zinc-300'}`}>
              {lowStockCount > 0 
                ? `${lowStockCount} ${lang === 'hi' ? 'वस्तुएँ कम स्टॉक में' : 'Items Low'}` 
                : (lang === 'hi' ? 'सब स्टॉक सुरक्षित' : 'No Alerts')}
            </h3>
          </div>
        </div>
      </div>

      {/* Low Stock Highlight Area if alerts exist */}
      {lowStockCount > 0 && (
        <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-pulse">
          <div className="flex gap-2.5 items-center">
            <AlertTriangle className="h-4.5 w-4.5 text-red-400 shrink-0" />
            <div className="text-xs text-red-300">
              <span className="font-bold">{lang === 'hi' ? 'चेतावनी:' : 'Attention:'}</span>{' '}
              {lang === 'hi' 
                ? 'निम्नलिखित वस्तुएँ कम स्टॉक सीमा (5 से कम) से नीचे पहुँच गई हैं:' 
                : 'The following stationery items are below the low stock threshold:'}{' '}
              <span className="font-semibold text-white">
                {lowStockItems.map(i => i.item_name).join(', ')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Forms & Table Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Quick Forms (Counter Sale + Add Inventory) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quick Counter Sale Card */}
          <div className="bg-[#121218] border border-zinc-800/80 rounded-2xl p-6 shadow-md">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <ShoppingBag className="h-4.5 w-4.5 text-emerald-500" />
              {lang === 'hi' ? 'त्वरित काउंटर बिक्री / बिल' : 'Quick Counter Sale (Cash Bill)'}
            </h3>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaleSubmit} className="space-y-4">
              {/* Select Item */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">
                  {lang === 'hi' ? 'वस्तु चुनें' : 'Select Item'}
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500 [color-scheme:dark]"
                >
                  <option value="">{lang === 'hi' ? '-- वस्तु चुनें --' : '-- Select Item --'}</option>
                  {inventory
                    .filter(i => i.stock_quantity > 0)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_name} ({lang === 'hi' ? 'स्टॉक' : 'Stock'}: {item.stock_quantity}) - ₹{item.selling_price}
                      </option>
                    ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">
                  {lang === 'hi' ? 'बिक्री मात्रा' : 'Quantity to Sell'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={saleQty}
                  onChange={(e) => setSaleQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Computed Amount Display */}
              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex justify-between items-center text-xs">
                <span className="font-semibold text-zinc-400">{lang === 'hi' ? 'कुल राशि:' : 'Total Bill Amount:'}</span>
                <span className="text-base font-bold text-emerald-400">₹{computedTotal}</span>
              </div>

              <button
                type="submit"
                disabled={actionLoading || !selectedItemId}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 text-xs"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>{lang === 'hi' ? 'बिक्री दर्ज करें' : 'Log Counter Sale'}</span>
                    <TrendingUp className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Add Inventory Form */}
          <div className="bg-[#121218] border border-zinc-800/80 rounded-2xl p-6 shadow-md">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Plus className="h-4.5 w-4.5 text-violet-500" />
              {lang === 'hi' ? 'नई वस्तु जोड़ें' : 'Add New Inventory Item'}
            </h3>

            <form onSubmit={handleAddItemSubmit} className="space-y-4">
              {/* Item Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">
                  {lang === 'hi' ? 'वस्तु / पुस्तक का नाम' : 'Item Name'}
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder={lang === 'hi' ? 'उदा. नटराज पेंसिल, कक्षा 10 गणित' : 'e.g. Nataraj Pencil, Math Book'}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-400">
                  {lang === 'hi' ? 'श्रेणी' : 'Category'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'books' | 'pens' | 'notebooks' | 'art_supplies' | 'other')}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500 [color-scheme:dark]"
                >
                  <option value="books">{lang === 'hi' ? 'पुस्तकें (Books)' : 'Books'}</option>
                  <option value="pens">{lang === 'hi' ? 'पेन/पेंसिल (Pens/Pencils)' : 'Pens'}</option>
                  <option value="notebooks">{lang === 'hi' ? 'कॉपियां/रफ (Notebooks)' : 'Notebooks'}</option>
                  <option value="art_supplies">{lang === 'hi' ? 'ड्राइंग/आर्ट (Art Supplies)' : 'Art Supplies'}</option>
                  <option value="other">{lang === 'hi' ? 'अन्य स्टेशनरी (Other)' : 'Other'}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Cost Price */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400">
                    {lang === 'hi' ? 'लागत मूल्य (₹)' : 'Cost Price (₹)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Selling Price */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400">
                    {lang === 'hi' ? 'बिक्री मूल्य (₹)' : 'Selling Price (₹)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Stock Quantity */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400">
                    {lang === 'hi' ? 'स्टॉक मात्रा' : 'Initial Stock Qty'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Low Stock Threshold */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400">
                    {lang === 'hi' ? 'न्यूनतम स्टॉक अलर्ट' : 'Alert Limit'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/10 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 text-xs"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>{lang === 'hi' ? 'इन्वेंट्री में जोड़ें' : 'Add to Inventory'}</span>
                    <Plus className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Inventory List & Counter Sales History */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Inventory Table */}
          <div className="bg-[#121218] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
            <div className="p-5 border-b border-zinc-800/60 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="h-4.5 w-4.5 text-brand-500" />
                {lang === 'hi' ? 'इन्वेंट्री स्टॉक सूची' : 'Current Stock Inventory'}
              </h3>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-900/60 text-zinc-400 font-bold uppercase tracking-wider sticky top-0 border-b border-zinc-800/60">
                  <tr>
                    <th className="p-4">{lang === 'hi' ? 'वस्तु नाम' : 'Item Name'}</th>
                    <th className="p-4">{lang === 'hi' ? 'श्रेणी' : 'Category'}</th>
                    <th className="p-4 text-center">{lang === 'hi' ? 'स्टॉक' : 'Stock'}</th>
                    <th className="p-4 text-right">{lang === 'hi' ? 'खरीद' : 'Cost'}</th>
                    <th className="p-4 text-right">{lang === 'hi' ? 'बिक्री' : 'Selling'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500 font-medium">
                        {lang === 'hi' ? 'इन्वेंट्री में कोई वस्तु नहीं है।' : 'No items found in inventory.'}
                      </td>
                    </tr>
                  ) : (
                    inventory.map((item) => {
                      const isLow = item.stock_quantity <= item.low_stock_threshold;
                      return (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-zinc-800/20 transition-all ${
                            isLow ? 'bg-red-500/5 hover:bg-red-500/10' : ''
                          }`}
                        >
                          <td className="p-4">
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              {item.item_name}
                              {isLow && (
                                <span className="px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[9px] font-extrabold uppercase text-red-400 tracking-wider">
                                  {lang === 'hi' ? 'कम' : 'Low'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700/30">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`font-bold text-sm ${
                              isLow ? 'text-red-400' : 'text-zinc-200'
                            }`}>
                              {item.stock_quantity}
                            </span>
                          </td>
                          <td className="p-4 text-right text-zinc-400 font-mono">₹{item.cost_price}</td>
                          <td className="p-4 text-right text-white font-mono font-bold">₹{item.selling_price}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales History List */}
          <div className="bg-[#121218] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
            <div className="p-5 border-b border-zinc-800/60 flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-emerald-500" />
              <h3 className="text-sm font-bold text-white">
                {lang === 'hi' ? 'हालिया काउंटर बिक्री इतिहास' : 'Recent Counter Sales History'}
              </h3>
            </div>

            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-900/60 text-zinc-400 font-bold uppercase tracking-wider sticky top-0 border-b border-zinc-800/60">
                  <tr>
                    <th className="p-4">{lang === 'hi' ? 'समय' : 'Date / Time'}</th>
                    <th className="p-4">{lang === 'hi' ? 'वस्तु' : 'Item'}</th>
                    <th className="p-4 text-center">{lang === 'hi' ? 'मात्रा' : 'Qty'}</th>
                    <th className="p-4 text-right">{lang === 'hi' ? 'कुल राशि' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                  {salesHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-zinc-500 font-medium">
                        {lang === 'hi' ? 'कोई हालिया काउंटर बिक्री रिकॉर्ड नहीं मिला।' : 'No recent counter sales found.'}
                      </td>
                    </tr>
                  ) : (
                    salesHistory.map((sale) => {
                      const itemName = sale.inventory?.item_name || (lang === 'hi' ? 'अज्ञात वस्तु' : 'Unknown Item');
                      const category = sale.inventory?.category || '';
                      return (
                        <tr key={sale.id} className="hover:bg-zinc-800/20 transition-all">
                          <td className="p-4 text-zinc-400 font-medium">
                            {new Date(sale.created_at).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="p-4 font-semibold text-white">
                            <div>{itemName}</div>
                            {category && (
                              <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest">{category}</span>
                            )}
                          </td>
                          <td className="p-4 text-center text-zinc-200 font-bold">{sale.quantity_sold}</td>
                          <td className="p-4 text-right text-emerald-400 font-mono font-bold">₹{sale.total_amount}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
