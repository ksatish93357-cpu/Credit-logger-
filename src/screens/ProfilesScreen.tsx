import React, { useMemo, useState } from 'react';
import {
  Archive,
  Edit3,
  FileDown,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Share2,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { useApp } from '../context/AppContext';
import { buildExportBundle } from '../db/indexedDb';
import {
  calculateProfileSummary,
  generateProfileStatement,
} from '../engine/finance';
import { downloadJsonFile, shareText } from '../services/share';
import { formatDateDDMMYYYY, formatINR, todayISODate } from '../utils/format';

export const ProfilesListScreen: React.FC = () => {
  const { profiles, credits, creditAdjustments, payments, settings, navigate, restoreProfile, t } = useApp();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const precision = settings.financialPreferences.decimalPrecision;

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles
      .filter((p) => (showArchived ? Boolean(p.archivedAt) : !p.archivedAt))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q))
      .map((p) => calculateProfileSummary(p, credits, creditAdjustments, payments, todayISODate(), precision))
      .sort((a, b) => b.currentOutstanding - a.currentOutstanding);
  }, [profiles, credits, creditAdjustments, payments, search, showArchived, precision]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('profiles')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Independent personal profiles with unlimited universal credit records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border ${
              showArchived
                ? 'bg-violet-600 text-white border-violet-600'
                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            {showArchived ? 'Showing Archived' : 'Show Archived'}
          </button>
          <button
            type="button"
            onClick={() => navigate('add_profile')}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addLoanTaker')}</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search loan takers by name or phone..."
          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#15152B] pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {filteredSummaries.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {showArchived ? 'No archived profiles.' : 'No loan taker profiles found.'}
          </p>
          {!showArchived && (
            <button
              type="button"
              onClick={() => navigate('add_profile')}
              className="mt-4 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold"
            >
              {t('addLoanTaker')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSummaries.map((ps) => (
            <div
              key={ps.profile.id}
              className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 flex flex-col justify-between gap-4 hover:border-violet-500/40 transition"
            >
              <button
                type="button"
                onClick={() => navigate({ screen: 'profile_details', profileId: ps.profile.id })}
                className="text-left space-y-3 w-full"
              >
                <div className="flex items-center gap-3">
                  {ps.profile.photo ? (
                    <img
                      src={ps.profile.photo}
                      alt={ps.profile.name}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-white/10"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-violet-600/15 text-violet-600 dark:text-violet-400 font-bold text-base flex items-center justify-center shrink-0">
                      {ps.profile.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {ps.profile.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                      {ps.profile.phone || 'No phone'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
                  <div>
                    <div className="text-[11px] text-slate-500">Outstanding</div>
                    <div className="text-sm font-bold font-mono-num text-red-500 dark:text-red-400">
                      {formatINR(ps.currentOutstanding, precision)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Total Misradhan</div>
                    <div className="text-sm font-bold font-mono-num text-violet-600 dark:text-violet-400">
                      {formatINR(ps.totalMisradhan, precision)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Active Credits</div>
                    <div className="text-xs font-semibold font-mono-num text-slate-800 dark:text-slate-200">
                      {ps.activeCreditCount} Active / {ps.closedCreditCount} Closed
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Latest Payment</div>
                    <div className="text-xs font-semibold font-mono-num text-slate-800 dark:text-slate-200">
                      {ps.latestPaymentDate ? formatDateDDMMYYYY(ps.latestPaymentDate) : '-'}
                    </div>
                  </div>
                </div>
              </button>

              {showArchived && (
                <button
                  type="button"
                  onClick={() => restoreProfile(ps.profile.id)}
                  className="w-full py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                >
                  Restore Profile
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ProfileFormScreen: React.FC<{ editProfileId?: string }> = ({ editProfileId }) => {
  const { profiles, addProfile, updateProfile, navigate, goBack, showToast, t } = useApp();
  const existing = editProfileId ? profiles.find((p) => p.id === editProfileId) : undefined;

  const [name, setName] = useState(existing?.name || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [address, setAddress] = useState(existing?.address || '');
  const [photo, setPhoto] = useState(existing?.photo || '');
  const [note, setNote] = useState(existing?.note || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Full Name is required.');
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateProfile(existing.id, {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          photo,
          note: note.trim(),
        });
        showToast('Profile updated', 'success');
        navigate({ screen: 'profile_details', profileId: existing.id });
      } else {
        const created = await addProfile({ name, phone, address, photo, note });
        showToast(`Profile "${created.name}" created`, 'success');
        navigate({ screen: 'profile_details', profileId: created.id });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {existing ? 'Edit Profile' : t('addLoanTaker')}
        </h1>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="profile-name" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {t('fullName')} <span className="text-red-500">*</span>
            </label>
            <input
              id="profile-name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Rahul Sharma"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-phone" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                {t('phoneNumber')}
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm font-mono-num text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label htmlFor="profile-photo" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Profile Photo (Optional)
              </label>
              <input
                id="profile-photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-violet-600/15 file:text-violet-600 dark:file:text-violet-300 file:font-semibold"
              />
            </div>
          </div>

          <div>
            <label htmlFor="profile-address" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {t('address')}
            </label>
            <input
              id="profile-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="City / Locality"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label htmlFor="profile-note" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
              {t('notes')}
            </label>
            <textarea
              id="profile-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional reference notes..."
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ProfileDetailsScreen: React.FC<{ profileId: string }> = ({ profileId }) => {
  const {
    profiles,
    credits,
    creditAdjustments,
    payments,
    transactions,
    settings,
    navigate,
    archiveProfile,
    deleteProfile,
    updateProfile,
    getFullSnapshot,
    showToast,
    t,
  } = useApp();

  const [tab, setTab] = useState<'credits' | 'payments' | 'normal' | 'history' | 'notes'>('credits');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const profile = profiles.find((p) => p.id === profileId);
  const precision = settings.financialPreferences.decimalPrecision;

  const summary = useMemo(() => {
    if (!profile) return null;
    return calculateProfileSummary(profile, credits, creditAdjustments, payments, todayISODate(), precision);
  }, [profile, credits, creditAdjustments, payments, precision]);

  if (!profile || !summary) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#15152B] p-8 text-center">
        <p className="text-sm text-slate-500">Profile not found.</p>
        <button
          type="button"
          onClick={() => navigate('profiles')}
          className="mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold"
        >
          Back to Profiles
        </button>
      </div>
    );
  }

  const creditPayments = payments
    .filter((p) => p.profileId === profileId && p.paymentType === 'credit_payment')
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const normalPayments = payments
    .filter((p) => p.profileId === profileId && p.paymentType === 'normal_payment')
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const profileTx = transactions
    .filter((tx) => tx.profileId === profileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleShareProfile = async () => {
    const text = generateProfileStatement(summary, payments, precision);
    const res = await shareText(`${profile.name} - Statement`, text);
    showToast(res === 'copied' ? 'Profile statement copied to clipboard' : 'Shared statement', 'success');
  };

  const handleExportProfileJson = () => {
    const bundle = buildExportBundle(getFullSnapshot(), 'profile', profile.id);
    downloadJsonFile(JSON.stringify(bundle, null, 2), `credit-logger-profile-${profile.name.replace(/\s+/g, '_')}.json`);
    showToast('Profile JSON exported', 'success');
    setMenuOpen(false);
  };

  const handleSaveNote = async () => {
    await updateProfile(profile.id, { note: noteDraft });
    showToast('Notes updated', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Profile Header */}
      <section className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {profile.photo ? (
              <img
                src={profile.photo}
                alt={profile.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-white/10"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-violet-600/15 text-violet-600 dark:text-violet-400 font-bold text-lg flex items-center justify-center shrink-0">
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{profile.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                {profile.phone && (
                  <span className="flex items-center gap-1 font-mono-num">
                    <Phone className="w-3.5 h-3.5" /> {profile.phone}
                  </span>
                )}
                {profile.address && <span>{profile.address}</span>}
                <span>Created {formatDateDDMMYYYY(profile.createdAt.slice(0, 10))}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => navigate({ screen: 'edit_profile', profileId: profile.id })}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t('edit')}</span>
            </button>
            <button
              type="button"
              onClick={handleShareProfile}
              className="px-3.5 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-violet-700"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{t('share')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="More profile options"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-12 z-20 w-52 rounded-xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 shadow-xl py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate({ screen: 'pdf_preview', pdfMode: 'profile', profileId: profile.id });
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4 text-violet-500" /> PDF Statement Preview
                </button>
                <button
                  type="button"
                  onClick={handleExportProfileJson}
                  className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4 text-blue-500" /> Export Profile JSON
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    await archiveProfile(profile.id);
                    showToast('Profile archived', 'info');
                    navigate('profiles');
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                >
                  <Archive className="w-4 h-4 text-amber-500" /> Archive Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-medium text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete Profile
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Profile Financial Summary */}
        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <div className="text-[11px] text-slate-500">{t('totalPrincipal')}</div>
            <div className="mt-0.5 text-base font-bold font-mono-num text-blue-600 dark:text-blue-400">
              {formatINR(summary.totalPrincipal, precision)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">{t('totalInterest')}</div>
            <div className="mt-0.5 text-base font-bold font-mono-num text-amber-600 dark:text-amber-400">
              {formatINR(summary.totalInterest, precision)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">{t('totalMisradhan')}</div>
            <div className="mt-0.5 text-base font-bold font-mono-num text-violet-600 dark:text-violet-400">
              {formatINR(summary.totalMisradhan, precision)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">{t('totalPaidAmount')}</div>
            <div className="mt-0.5 text-base font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
              {formatINR(summary.totalPaidAmount, precision)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">{t('currentOutstanding')}</div>
            <div className="mt-0.5 text-base font-bold font-mono-num text-red-500 dark:text-red-400">
              {formatINR(summary.currentOutstanding, precision)}
            </div>
          </div>
        </div>

        {/* Profile Quick Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ screen: 'add_credit', profileId: profile.id })}
            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {t('addCredit')}
          </button>
          <button
            type="button"
            onClick={() => navigate({ screen: 'add_payment', profileId: profile.id })}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {t('addPayment')}
          </button>
          <button
            type="button"
            onClick={() => navigate({ screen: 'normal_payment', profileId: profile.id })}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5"
          >
            + {t('addNormalPayment')}
          </button>
        </div>
      </section>

      {/* 5 Profile Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 overflow-x-auto">
        {(
          [
            { id: 'credits', label: `Credits (${summary.creditStates.length})` },
            { id: 'payments', label: `Payments (${creditPayments.length})` },
            { id: 'normal', label: `Normal Payments (${normalPayments.length})` },
            { id: 'history', label: `History (${profileTx.length})` },
            { id: 'notes', label: 'Notes' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              if (item.id === 'notes') setNoteDraft(profile.note);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              tab === item.id
                ? 'bg-violet-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'credits' && (
        <div className="space-y-3">
          {summary.creditStates.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-6 text-center text-sm text-slate-500">
              No credits recorded for {profile.name} yet.
            </div>
          ) : (
            summary.creditStates.map((cs) => (
              <div
                key={cs.credit.id}
                className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-bold font-mono-num text-violet-600 dark:text-violet-400">
                      {cs.credit.creditNumber}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">· {cs.credit.status}</span>
                    <span className="text-xs text-slate-500">· Start {formatDateDDMMYYYY(cs.credit.startDate)}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono-num">
                    Rate: {cs.activeInterestRate}% {cs.activeInterestPeriod} ({cs.activeInterestMethod}) ·{' '}
                    Duration: {cs.durationSinceStart.completedMonths}m {cs.durationSinceStart.remainingDays}d
                  </div>
                  <div className="flex flex-wrap gap-4 pt-1 text-xs font-mono-num">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      Prin: {formatINR(cs.currentPrincipal, precision)}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Int: {formatINR(cs.totalInterest, precision)}
                    </span>
                    <span className="text-violet-600 dark:text-violet-400 font-bold">
                      Misradhan: {formatINR(cs.totalMisradhan, precision)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate({ screen: 'daily_credit_update', creditId: cs.credit.id })}
                    className="px-3 py-2 rounded-xl bg-violet-600/15 text-violet-600 dark:text-violet-300 text-xs font-semibold"
                  >
                    Daily Update
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate({ screen: 'credit_details', creditId: cs.credit.id })}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold"
                  >
                    Details
                  </button>
                  {cs.credit.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => navigate({ screen: 'add_payment', profileId: profile.id, creditId: cs.credit.id })}
                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                    >
                      Pay
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
          {creditPayments.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No credit payments recorded.</p>
          ) : (
            creditPayments.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate({ screen: 'payment_receipt', paymentId: p.id })}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <div>
                  <div className="text-sm font-semibold font-mono-num text-slate-900 dark:text-white">
                    {p.receiptNumber} {p.reversed ? '(REVERSED)' : ''}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDateDDMMYYYY(p.paymentDate)} · {p.paymentMethod.toUpperCase()} ·{' '}
                    {p.allocationMode === 'principal_adjustment' ? 'Principal Adjustment' : 'Interest First'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
                    {formatINR(p.amount, precision)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-num">
                    New Prin: {formatINR(p.newPrincipal, precision)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {tab === 'normal' && (
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
          {normalPayments.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No normal payments recorded.</p>
          ) : (
            normalPayments.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate({ screen: 'payment_receipt', paymentId: p.id })}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <div>
                  <div className="text-sm font-semibold font-mono-num text-slate-900 dark:text-white">
                    {p.receiptNumber} · Normal Payment
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDateDDMMYYYY(p.paymentDate)} · {p.paymentMethod.toUpperCase()} · {p.note}
                  </div>
                </div>
                <div className="text-sm font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
                  {formatINR(p.amount, precision)}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
          {profileTx.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No transaction history yet.</p>
          ) : (
            profileTx.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => navigate({ screen: 'transaction_details', transactionId: tx.id })}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <div className="min-w-0 pr-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {tx.description}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDateDDMMYYYY(tx.effectiveDate)} · {tx.transactionType.replace(/_/g, ' ')}
                  </div>
                </div>
                <div className="text-sm font-bold font-mono-num text-slate-700 dark:text-slate-200 shrink-0">
                  {formatINR(tx.amount, precision)}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="rounded-2xl bg-white dark:bg-[#15152B] border border-slate-200 dark:border-white/10 p-5 space-y-3">
          <label htmlFor="profile-notes-edit" className="block text-sm font-semibold">
            Profile Notes
          </label>
          <textarea
            id="profile-notes-edit"
            rows={4}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B0B18] p-3 text-sm"
          />
          <button
            type="button"
            onClick={handleSaveNote}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold"
          >
            Save Notes
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        danger
        title="Delete Loan Taker Profile?"
        message={`This will permanently delete "${profile.name}" and all associated credits, payments, and history. Consider Archiving instead to preserve records.`}
        confirmLabel="Delete Permanently"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deleteProfile(profile.id);
          showToast('Profile deleted', 'info');
          navigate('profiles');
        }}
      />
    </div>
  );
};
