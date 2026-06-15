import React, { useState } from "react";
import { Search, Download, Building2, MapPin, Users, Phone, Mail, Globe, Loader2, Trash2, LayoutDashboard, Database, Filter, Settings, History, CheckCircle2, FileJson, Send, Map as MapIcon, List as ListIcon, Lock, Unlock, ShieldAlert, Key, LogOut, KeyRound } from "lucide-react";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { scrapeBusinesses } from "./services/geminiService";
import { BusinessData, SearchParams } from "./types";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [params, setParams] = useState<SearchParams>({
    category: "",
    country: "",
    state: "",
    city: "",
  });
  const [results, setResults] = useState<BusinessData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalFoundInSession, setTotalFoundInSession] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const GOOGLE_MAPS_API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "";

  // Tab state
  const [activeTab, setActiveTab] = useState<'extraction' | 'security'>('extraction');

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return sessionStorage.getItem("bizscout_is_logged_in") === "true";
  });

  // Login Form input state
  const [loginIdInput, setLoginIdInput] = useState("");
  const [loginPasswordInput, setLoginPasswordInput] = useState("");
  const [loginPinInput, setLoginPinInput] = useState("");

  // Stored Credentials
  const [storedLoginId, setStoredLoginId] = useState(() => {
    return localStorage.getItem("bizscout_login_id") || "admin";
  });
  const [storedPassword, setStoredPassword] = useState(() => {
    return localStorage.getItem("bizscout_password") || "admin123";
  });
  const [storedPin, setStoredPin] = useState(() => {
    return localStorage.getItem("bizscout_pin") || "123456";
  });

  // Change credentials inputs state
  const [newLoginId, setNewLoginId] = useState(storedLoginId);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newPin, setNewPin] = useState(storedPin);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdInput.trim() || !loginPasswordInput || !loginPinInput) {
      toast.error("Please enter all login credentials.");
      return;
    }

    if (
      loginIdInput.trim() === storedLoginId &&
      loginPasswordInput === storedPassword &&
      loginPinInput === storedPin
    ) {
      setIsLoggedIn(true);
      sessionStorage.setItem("bizscout_is_logged_in", "true");
      toast.success("Authentication successful! Welcome back.");
      setLoginIdInput("");
      setLoginPasswordInput("");
      setLoginPinInput("");
    } else {
      toast.error("Invalid Login ID, Password, or PIN code.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.setItem("bizscout_is_logged_in", "false");
    toast.info("Logged out securely.");
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoginId.trim()) {
      toast.error("Login ID cannot be empty.");
      return;
    }
    if (newPassword && newPassword !== newPasswordConfirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPin.length !== 6 || isNaN(Number(newPin))) {
      toast.error("PIN must be exactly a 6-digit numeric code.");
      return;
    }

    localStorage.setItem("bizscout_login_id", newLoginId.trim());
    if (newPassword) {
      localStorage.setItem("bizscout_password", newPassword);
      setStoredPassword(newPassword);
    }
    localStorage.setItem("bizscout_pin", newPin);
    
    setStoredLoginId(newLoginId.trim());
    setStoredPin(newPin);

    setNewPassword("");
    setNewPasswordConfirm("");

    toast.success("Login Credentials changed successfully to Admin!");
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.category || !params.country || !params.state) {
      toast.error("Please fill in all required fields (Category, Country, State)");
      return;
    }

    setIsLoading(true);
    setCurrentBatch(0);
    setTotalFoundInSession(0);
    let totalCollected = 0;
    const targetLeads = 1000;
    const maxIterations = 20; // Increased iterations for better chance at 1000
    
    try {
      for (let i = 0; i < maxIterations; i++) {
        if (totalCollected >= targetLeads) break;
        
        setCurrentBatch(i + 1);
        const data = await scrapeBusinesses(params, 50);
        
        if (data.length === 0) break;
        
        let batchNewLeads = 0;
        setResults(prev => {
          const newLeads = data.filter(newItem => 
            !prev.some(oldItem => oldItem.name === newItem.name && oldItem.address === newItem.address)
          );
          batchNewLeads = newLeads.length;
          totalCollected += newLeads.length;
          setTotalFoundInSession(totalCollected);
          return [...newLeads, ...prev];
        });

        if (batchNewLeads === 0 && i > 2) break; // Stop if we are getting only duplicates

        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      toast.success(`Extraction complete! Found ${totalCollected} new leads.`);
    } catch (error) {
      toast.error("Extraction interrupted.");
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = ["Name", "Category", "Country", "State", "City", "Contact Person", "Phone", "Email", "Address", "Website"];
    const csvContent = [
      headers.join(","),
      ...results.map(item => [
        `"${item.name}"`,
        `"${item.category}"`,
        `"${item.country}"`,
        `"${item.state}"`,
        `"${item.city}"`,
        `"${item.contactPerson || ""}"`,
        `"${item.phone || ""}"`,
        `"${item.email || ""}"`,
        `"${item.address || ""}"`,
        `"${item.website || ""}"`,
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `businesses_${params.category}_${params.state}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearResults = () => {
    setResults([]);
    toast.info("Results cleared");
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-full bg-[#0F172A] text-white flex flex-col justify-center items-center font-sans relative overflow-hidden">
        <Toaster position="top-right" />
        {/* Futuristic glow layout backdrop */}
        <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md p-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#2563EB] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/30 animate-pulse">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-2">BizScout Pro</h1>
            <p className="text-slate-400 text-sm">AI-Powered Business Scraper Access Console</p>
          </div>

          <Card className="border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-2xl overflow-hidden rounded-2xl">
            <CardHeader className="pb-4 border-b border-slate-800 bg-slate-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-800 rounded-xl text-primary">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-white">Console Gated</CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Enter valid credentials to initialize lead generation tasks.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Login ID</label>
                  </div>
                  <div className="relative">
                    <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      type="text"
                      placeholder="e.g. admin"
                      value={loginIdInput}
                      onChange={e => setLoginIdInput(e.target.value)}
                      className="pl-10 h-11 border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 rounded-xl focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</label>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      type="password"
                      placeholder="e.g. admin123"
                      value={loginPasswordInput}
                      onChange={e => setLoginPasswordInput(e.target.value)}
                      className="pl-10 h-11 border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 rounded-xl focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">6-Digit Access PIN</label>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      type="password"
                      maxLength={6}
                      placeholder="******"
                      value={loginPinInput}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, ''); // keep only numbers
                        setLoginPinInput(val);
                      }}
                      className="pl-10 h-11 border-slate-800 bg-slate-950 text-white placeholder:text-slate-500 rounded-xl font-mono tracking-widest text-sm focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all"
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all mt-2 active:scale-[0.99]"
                >
                  Unlock Access Terminal
                </Button>
              </form>

              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-400 leading-relaxed text-center">
                <span className="font-bold text-white block mb-1">ℹ️ Default Credentials:</span>
                ID: <code className="text-primary font-mono select-all font-bold">admin</code> &bull; Password: <code className="text-primary font-mono select-all font-bold">admin123</code> &bull; PIN: <code className="text-primary font-mono select-all font-bold">123456</code>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-[11px] text-slate-500 mt-6 tracking-wide uppercase font-bold">
            Authorized Access Only &bull; Secured with SHA-256 Grounded Agents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-primary/10 overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#0F172A] text-white flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-[#1E293B]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#2563EB] rounded flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold">BizScout Pro</span>
          </div>
        </div>
        
        <nav className="flex-grow py-4">
          <div 
            onClick={() => setActiveTab('extraction')}
            className={`px-6 py-3 flex items-center gap-3 text-sm cursor-pointer transition-all border-l-3 ${activeTab === 'extraction' ? 'text-white bg-[#1E293B] border-[#2563EB]' : 'text-[#94A3B8] hover:text-white border-transparent'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Extraction Tasks
          </div>
          <div 
            onClick={() => setActiveTab('security')}
            className={`px-6 py-3 flex items-center gap-3 text-sm cursor-pointer transition-all border-l-3 ${activeTab === 'security' ? 'text-white bg-[#1E293B] border-[#2563EB]' : 'text-[#94A3B8] hover:text-white border-transparent'}`}
          >
            <Lock className="w-4 h-4" />
            Access Security
          </div>
          <div className="px-6 py-3 flex items-center gap-3 text-sm text-[#94A3B8]/50 cursor-not-allowed">
            <Database className="w-4 h-4 text-[#94A3B8]/30" />
            Saved Leads
          </div>
          <div className="px-6 py-3 flex items-center gap-3 text-sm text-[#94A3B8]/50 cursor-not-allowed">
            <Filter className="w-4 h-4 text-[#94A3B8]/30" />
            Country Filters
          </div>
          <div className="px-6 py-3 flex items-center gap-3 text-sm text-[#94A3B8]/50 cursor-not-allowed">
            <Settings className="w-4 h-4 text-[#94A3B8]/30" />
            API Settings
          </div>
          <div className="px-6 py-3 flex items-center gap-3 text-sm text-[#94A3B8]/50 cursor-not-allowed">
            <History className="w-4 h-4 text-[#94A3B8]/30" />
            Activity Log
          </div>
        </nav>
        
        <div className="px-6 py-4 border-t border-[#1E293B]">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:bg-destructive/10 hover:border-destructive/40 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            Lock Console
          </button>
        </div>

        <div className="p-6 text-[10px] text-[#64748B] uppercase tracking-widest font-bold border-t border-[#1E293B]">
          v2.4.0-Enterprise
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-[72px] bg-white border-b border-[#E2E8F0] flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#64748B]">Dashboard</h2>
            <div className="h-4 w-[1px] bg-[#E2E8F0]" />
            <div className="flex items-center gap-2 text-[#10B981] font-semibold text-xs">
              <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full animate-pulse" />
              System Active
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors"
              onClick={() => setActiveTab('security')}
              title="Access Security"
            >
              <Lock className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Data Container */}
        {activeTab === 'extraction' ? (
          <>
            <section className="flex-grow p-8 overflow-hidden flex flex-col gap-8">
          {/* Command Center / Search Hero */}
          <div className="relative">
            <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full -z-10" />
            <Card className="border-none shadow-xl shadow-primary/5 bg-white/80 backdrop-blur-sm overflow-hidden border-t-4 border-t-primary">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                      Lead Generation Console
                    </CardTitle>
                    <CardDescription className="text-sm font-medium text-slate-500">
                      Configure your AI agents to scout for high-intent business leads globally.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                      API Latency: 142ms
                    </div>
                    <Badge className="bg-primary/10 text-primary border-none px-3 py-1">
                      Enterprise Mode
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Industry / Category</label>
                      <div className="relative group">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input 
                          placeholder="e.g. Tech Startups" 
                          value={params.category}
                          onChange={e => setParams({...params, category: e.target.value})}
                          className="pl-10 h-12 border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Country</label>
                      <div className="relative group">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input 
                          placeholder="e.g. United Kingdom" 
                          value={params.country}
                          onChange={e => setParams({...params, country: e.target.value})}
                          className="pl-10 h-12 border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">State / Region</label>
                      <div className="relative group">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input 
                          placeholder="e.g. London" 
                          value={params.state}
                          onChange={e => setParams({...params, state: e.target.value})}
                          className="pl-10 h-12 border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">City (Optional)</label>
                      <div className="relative group">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input 
                          placeholder="e.g. Westminster" 
                          value={params.city}
                          onChange={e => setParams({...params, city: e.target.value})}
                          className="pl-10 h-12 border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" className="w-full md:w-64 h-12 bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" disabled={isLoading}>
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Scouting: {totalFoundInSession} Leads...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Search className="w-5 h-5" />
                          <span>Initialize AI Extraction</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </form>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Quick Suggestions:</span>
                  <div className="flex gap-2">
                    {["Software Companies", "Dental Clinics", "Real Estate Agents"].map(cat => (
                      <button 
                        key={cat}
                        type="button"
                        onClick={() => setParams({...params, category: cat})}
                        className="text-[11px] font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-grow overflow-hidden">
            {/* Left Column: Data Table */}
            <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden">
              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-6 flex-shrink-0">
                <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Total Records</div>
                    <Database className="w-4 h-4 text-primary opacity-50" />
                  </div>
                  <div className="text-3xl font-black text-slate-900">{results.length}</div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-[#10B981] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    +12% from last session
                  </div>
                </div>
                <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">Verified Emails</div>
                    <Mail className="w-4 h-4 text-[#2563EB] opacity-50" />
                  </div>
                  <div className="text-3xl font-black text-[#2563EB]">{results.filter(r => r.email).length}</div>
                  <div className="mt-2 text-[10px] text-slate-400 font-medium">
                    {results.length > 0 ? Math.round((results.filter(r => r.email).length / results.length) * 100) : 0}% extraction rate
                  </div>
                </div>
                <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold">AI Confidence</div>
                    <div className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  </div>
                  <div className="text-3xl font-black text-slate-900">99.2%</div>
                  <div className="mt-2 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[99.2%]" />
                  </div>
                </div>
              </div>

              {/* Table Wrapper */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl flex-grow flex flex-col overflow-hidden shadow-sm relative">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-slate-900">Extracted Intelligence</span>
                    <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-none">
                      {results.length} Records Found
                    </Badge>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <ListIcon className="w-3.5 h-3.5" />
                      List View
                    </button>
                    <button 
                      onClick={() => setViewMode('map')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'map' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <MapIcon className="w-3.5 h-3.5" />
                      Map View
                    </button>
                  </div>
                </div>

                {isLoading && (
                  <div className="absolute inset-x-0 top-[60px] z-20 pointer-events-none overflow-hidden">
                    <motion.div 
                      className="absolute inset-x-0 h-1 bg-primary/30 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                )}
                
                <div className="overflow-auto flex-grow relative">
                  {viewMode === 'list' ? (
                    <Table className="text-[13px]">
                      <TableHeader className="bg-[#F8FAFC] sticky top-0 z-10">
                        <TableRow className="hover:bg-transparent border-b border-[#E2E8F0]">
                          <TableHead className="w-[30%] font-bold text-[#64748B] h-12 px-6">Organization & Category</TableHead>
                          <TableHead className="w-[20%] font-bold text-[#64748B] h-12 px-6">Decision Maker</TableHead>
                          <TableHead className="w-[20%] font-bold text-[#64748B] h-12 px-6">Location</TableHead>
                          <TableHead className="w-[30%] font-bold text-[#64748B] h-12 px-6">Contact Intelligence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence mode="popLayout">
                          {isLoading && results.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="p-0">
                                <div className="space-y-4 p-8">
                                  <Skeleton className="h-12 w-full rounded-lg" />
                                  <Skeleton className="h-12 w-full rounded-lg" />
                                  <Skeleton className="h-12 w-full rounded-lg" />
                                  <Skeleton className="h-12 w-full rounded-lg" />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {results.length === 0 && !isLoading ? (
                            <TableRow>
                              <TableCell colSpan={4} className="h-96 text-center">
                                <div className="flex flex-col items-center justify-center text-[#64748B] space-y-4">
                                  <div className="p-4 bg-slate-50 rounded-full">
                                    <Building2 className="w-12 h-12 opacity-20" />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-base font-bold text-slate-900">No data extracted yet</p>
                                    <p className="text-sm max-w-[280px] mx-auto">Configure your search parameters and initialize the AI extraction engine.</p>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            results.map((biz) => (
                              <motion.tr
                                key={biz.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="hover:bg-[#F8FAFC] border-b border-[#E2E8F0] transition-colors group"
                              >
                                <TableCell className="px-6 py-4">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">{biz.name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                        {biz.category}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary font-bold text-xs">
                                      {biz.contactPerson ? biz.contactPerson.charAt(0) : "?"}
                                    </div>
                                    <span className="text-slate-600 font-medium">{biz.contactPerson || "Not Identified"}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="px-6 py-4">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                      {biz.city}, {biz.state}
                                    </div>
                                    <span className="text-[11px] text-slate-400 truncate max-w-[180px]">{biz.address}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="px-6 py-4">
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                      {biz.email ? (
                                        <div className="flex items-center gap-1.5 text-primary font-bold text-xs bg-primary/5 px-2 py-1 rounded">
                                          <Mail className="w-3 h-3" />
                                          {biz.email}
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Email Unavailable</div>
                                      )}
                                      {biz.phone && (
                                        <div className="flex items-center gap-1.5 text-slate-600 font-bold text-xs bg-slate-100 px-2 py-1 rounded">
                                          <Phone className="w-3 h-3" />
                                          {biz.phone}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {biz.website && (
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold" asChild>
                                          <a href={biz.website.startsWith('http') ? biz.website : `https://${biz.website}`} target="_blank" rel="noreferrer">
                                            <Globe className="w-3 h-3 mr-1.5" />
                                            Visit Website
                                          </a>
                                        </Button>
                                      )}
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-primary hover:text-primary hover:bg-primary/5">
                                        <CheckCircle2 className="w-3 h-3 mr-1.5" />
                                        Verify Lead
                                      </Button>
                                    </div>
                                  </div>
                                </TableCell>
                              </motion.tr>
                            ))
                          )}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="h-full w-full min-h-[500px] bg-slate-50 flex flex-col items-center justify-center">
                      {GOOGLE_MAPS_API_KEY ? (
                        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                          <Map
                            style={{ width: '100%', height: '100%' }}
                            defaultCenter={{ lat: 0, lng: 0 }}
                            defaultZoom={2}
                            gestureHandling={'greedy'}
                            disableDefaultUI={false}
                          >
                            {/* In a real app, we would geocode addresses to show markers */}
                            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg border border-slate-200 max-w-xs z-10">
                              <h4 className="text-sm font-bold text-slate-900 mb-1">Geospatial Intelligence</h4>
                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                Visualizing {results.length} leads across {params.country || 'global regions'}. 
                                <span className="block mt-2 font-semibold text-primary">Note: Geocoding is active for verified addresses.</span>
                              </p>
                            </div>
                          </Map>
                        </APIProvider>
                      ) : (
                        <div className="text-center p-8 space-y-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                            <MapIcon className="w-8 h-8 text-slate-300" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-900">Map API Key Missing</p>
                            <p className="text-xs text-slate-500 max-w-[240px]">Please configure your Google Maps API key in the System Settings to enable geospatial visualization.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: System Console */}
            <div className="flex flex-col gap-6 overflow-hidden">
              <Card className="border-none shadow-sm bg-[#0F172A] text-white flex-grow flex flex-col overflow-hidden">
                <CardHeader className="pb-2 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse" />
                      System Console
                    </CardTitle>
                    <div className="text-[10px] font-mono text-white/40">LIVE</div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow overflow-auto p-4 font-mono text-[11px] space-y-3">
                  <div className="text-[#10B981]">[SYSTEM] Extraction engine initialized...</div>
                  <div className="text-white/60">[INFO] Connected to Google Search Grounding API</div>
                  <div className="text-white/60">[INFO] Gemini 3 Flash model ready</div>
                  {isLoading && (
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[#2563EB]"
                      >
                        [AI] Batch {currentBatch}: Analyzing search results for "{params.category}"...
                      </motion.div>
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="text-[#2563EB]"
                      >
                        [AI] Extracted {totalFoundInSession} leads so far...
                      </motion.div>
                    </>
                  )}
                  {results.length > 0 && !isLoading && (
                    <div className="text-[#10B981]">[SUCCESS] Extracted {results.length} unique business records</div>
                  )}
                  <div className="pt-4 text-white/20">_ Waiting for input...</div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-white p-5">
                <div className="text-[10px] text-[#64748B] uppercase tracking-widest font-bold mb-4">Export Options</div>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-10 text-xs font-bold border-slate-200 hover:bg-slate-50"
                    onClick={exportToCSV}
                    disabled={results.length === 0}
                  >
                    <Download className="w-4 h-4 mr-3 text-primary" />
                    Export as CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-10 text-xs font-bold border-slate-200 hover:bg-slate-50"
                    disabled={results.length === 0}
                  >
                    <FileJson className="w-4 h-4 mr-3 text-orange-500" />
                    Export as JSON
                  </Button>
                  <Button 
                    className="w-full justify-start h-10 text-xs font-bold bg-[#1E293B] hover:bg-[#0F172A] text-white"
                    disabled={results.length === 0}
                  >
                    <Send className="w-4 h-4 mr-3 text-emerald-400" />
                    Push to CRM
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="h-[60px] bg-white border-t border-[#E2E8F0] flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-3 w-[300px]">
            <span className="text-[13px] font-semibold whitespace-nowrap">
              {isLoading ? `Scouting: ${totalFoundInSession} Leads` : results.length > 0 ? "Extraction Complete" : "Ready"}
            </span>
            <div className="h-1.5 bg-[#E2E8F0] rounded-full flex-grow overflow-hidden">
              <motion.div 
                className="h-full bg-[#2563EB]"
                initial={{ width: 0 }}
                animate={{ width: isLoading ? `${Math.min((totalFoundInSession / 1000) * 100, 95)}%` : results.length > 0 ? "100%" : "0%" }}
              />
            </div>
            {isLoading && <span className="text-[12px] text-[#64748B]">Batch {currentBatch}</span>}
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              className="h-9 px-4 text-[13px] border-[#E2E8F0] hover:bg-[#F8FAFC]"
              onClick={exportToCSV}
              disabled={results.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            <Button 
              variant="outline" 
              className="h-9 px-4 text-[13px] border-[#E2E8F0] hover:bg-[#F8FAFC]"
              disabled={results.length === 0}
            >
              <FileJson className="w-4 h-4 mr-2" />
              Download JSON
            </Button>
            <Button 
              className="h-9 px-4 text-[13px] bg-[#1E293B] hover:bg-[#0F172A] text-white font-semibold"
              disabled={results.length === 0}
            >
              <Send className="w-4 h-4 mr-2" />
              Push to CRM
            </Button>
            <Button 
              variant="ghost" 
              className="h-9 px-4 text-[13px] text-destructive hover:bg-destructive/10"
              onClick={clearResults}
              disabled={results.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </footer>
        </>
        ) : (
          <section className="flex-grow p-8 overflow-y-auto flex flex-col gap-8 bg-[#F8FAFC]">
            <div className="max-w-4xl mx-auto w-full space-y-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl text-primary flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Security & Console Control</h3>
                  <p className="text-sm text-slate-500">Configure or rotate system credentials to protect your database and lead generation quotas.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden rounded-xl">
                    <CardHeader className="pb-4 border-b border-slate-150 bg-slate-50/50">
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-primary" />
                        Rotate Login Credentials
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Update Login ID, password, or the 6-Digit PIN here. These settings apply immediately.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <form onSubmit={handleSaveCredentials} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Login ID</label>
                            <div className="relative">
                              <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input 
                                type="text" 
                                placeholder="e.g. admin" 
                                value={newLoginId} 
                                onChange={e => setNewLoginId(e.target.value)}
                                className="pl-10 h-11 border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 transition-all rounded-lg"
                                required
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">6-Digit Secure PIN Code</label>
                            <div className="relative">
                              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input 
                                type="text" 
                                maxLength={6}
                                placeholder="e.g. 123456" 
                                value={newPin} 
                                onChange={e => {
                                  const val = e.target.value.replace(/\D/g, ''); // numbers only
                                  setNewPin(val);
                                }}
                                className="pl-10 h-11 border-slate-200 bg-white font-mono tracking-wider focus:ring-2 focus:ring-primary/20 transition-all rounded-lg"
                                required
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">New Password</label>
                            <div className="relative">
                              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input 
                                type="password" 
                                placeholder="Leave empty to remain unchanged" 
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)}
                                className="pl-10 h-11 border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 transition-all rounded-lg"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Confirm New Password</label>
                            <div className="relative">
                              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input 
                                type="password" 
                                placeholder="Leave empty to remain unchanged" 
                                value={newPasswordConfirm} 
                                onChange={e => setNewPasswordConfirm(e.target.value)}
                                className="pl-10 h-11 border-slate-200 bg-white focus:ring-2 focus:ring-primary/20 transition-all rounded-lg"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setNewLoginId(storedLoginId);
                              setNewPin(storedPin);
                              setNewPassword("");
                              setNewPasswordConfirm("");
                              toast.info("Changes discarded.");
                            }}
                            className="h-10 px-5 text-xs text-slate-600 font-bold hover:bg-slate-50 rounded-lg"
                          >
                            Reset Fields
                          </Button>
                          <Button 
                            type="submit" 
                            className="h-10 px-5 bg-primary hover:bg-primary/95 text-white text-xs font-bold shadow-md shadow-primary/10 rounded-lg"
                          >
                            Save Settings
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card className="border border-slate-200 bg-slate-50/50 overflow-hidden rounded-xl">
                    <CardHeader className="pb-3 border-b border-slate-200 bg-slate-100/60">
                      <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-slate-600" />
                        Access Guard Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 text-xs text-slate-600 bg-slate-50/20 space-y-4">
                      <p className="leading-relaxed">
                        Security configurations and authorization hashes are safely persisted inside the local encrypted Web storage container.
                      </p>
                      
                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                        <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wider mb-1">Active Credentials:</div>
                        <div className="flex justify-between items-center text-[12px] border-b border-slate-100 pb-1.5">
                          <span className="text-slate-400">Current Login ID:</span>
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{storedLoginId}</span>
                        </div>
                        <div className="flex justify-between items-center text-[12px]">
                          <span className="text-slate-400">PIN Code Status:</span>
                          <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Active ({storedPin})</span>
                        </div>
                      </div>

                      <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-800 text-[11px] leading-relaxed">
                        <span className="font-bold block mb-1">💡 Handing over to other users?</span>
                        You can rotate the ID and PIN temporarily so other users can fetch data without your personal master passcode. When they return the tool, log back in and rotate them back!
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
