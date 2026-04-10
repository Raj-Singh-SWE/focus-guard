import { User, ShieldCheck, AlertCircle } from "lucide-react";

export default function AdminPage() {
    const daysUntilLicenseExpiry = 120;
    const daysUntilInsuranceExpiry = 14;

    const isLicenseCritical = daysUntilLicenseExpiry < 30;
    const isInsuranceCritical = daysUntilInsuranceExpiry < 30;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-slate-100">Admin & Documents</h1>
                <p className="text-slate-400 mt-1">Manage user profile, license, and vehicle insurance renewals.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">

                {/* License Card */}
                <div className={`p-6 rounded-xl border transition-all ${isLicenseCritical ? 'border-red-500/50 bg-red-950/10' : 'border-slate-800 bg-slate-900 shadow-sm'}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center">
                            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mr-4">
                                <User className="text-indigo-400 w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-200">Driver License</h3>
                                <p className="text-slate-400 text-sm">Class C - Document Active</p>
                            </div>
                        </div>
                        {isLicenseCritical && <AlertCircle className="text-red-500 w-6 h-6" />}
                    </div>

                    <div className="mt-8">
                        <p className="text-slate-400 mb-1 text-sm uppercase tracking-wide font-medium">Expires in</p>
                        <p className={`text-5xl font-bold tracking-tight ${isLicenseCritical ? 'text-red-400' : 'text-slate-100'}`}>
                            {daysUntilLicenseExpiry} <span className="text-xl font-normal opacity-50">days</span>
                        </p>
                    </div>
                </div>

                {/* Insurance Card */}
                <div className={`p-6 rounded-xl border transition-all ${isInsuranceCritical ? 'border-red-500/70 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-slate-800 bg-slate-900 shadow-sm'}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mr-4">
                                <ShieldCheck className="text-emerald-400 w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-200">Vehicle Insurance</h3>
                                <p className="text-slate-400 text-sm">Comprehensive Coverage</p>
                            </div>
                        </div>
                        {isInsuranceCritical && <AlertCircle className="text-red-500 w-6 h-6 animate-pulse" />}
                    </div>

                    <div className="mt-8">
                        <p className="text-slate-400 mb-1 text-sm uppercase tracking-wide font-medium">Expires in</p>
                        <p className={`text-5xl font-bold tracking-tight ${isInsuranceCritical ? 'text-red-400' : 'text-slate-100'}`}>
                            {daysUntilInsuranceExpiry} <span className="text-xl font-normal opacity-50">days</span>
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
