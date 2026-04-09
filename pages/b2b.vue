<script setup>
definePageMeta({ layout: 'fullwidth' });

useHead({
  title: 'B2B Корпоративный портал — OT Center',
  meta: [
    { name: 'description', content: 'Корпоративное обучение и аттестация по промышленной безопасности для организаций Казахстана.' },
  ],
});

const { paths, syncCourseId } = useRedesignRoutes();

syncCourseId();

const goToCabinet = () => navigateTo(paths.value.cabinet);
const goToCourses = () => navigateTo(paths.value.courses);
const goToCategories = () => navigateTo(paths.value.categories);
const goToWizard = () => navigateTo(paths.value.wizard);
const goToPending = () => navigateTo(paths.value.pending);
</script>

<template>
<!-- Sidebar Navigation -->
<aside class="h-screen w-64 border-r border-primary/15 bg-surface-container-low flex flex-col py-6 px-4 shrink-0 overflow-y-auto">
<div class="mb-8 px-2">
<h2 class="text-lg font-bold text-primary">Industrial Portal</h2>
<p class="text-xs font-medium text-on-surface-variant/70 uppercase tracking-widest">Certification Center</p>
</div>
<nav class="flex-1 space-y-1">
<!-- Active State: Overview -->
<NuxtLink class="flex items-center gap-3 px-3 py-2 bg-secondary text-on-primary rounded-md shadow-lg transition-all duration-200" :to="paths.cabinet">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
<span class="text-sm font-semibold uppercase tracking-wider">Overview</span>
</NuxtLink>
<NuxtLink class="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-surface-container-high rounded-md transition-all duration-200" :to="paths.courses">
<span class="material-symbols-outlined" data-icon="school">school</span>
<span class="text-sm font-semibold uppercase tracking-wider">My Training</span>
</NuxtLink>
<NuxtLink class="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-surface-container-high rounded-md transition-all duration-200" :to="paths.certificate">
<span class="material-symbols-outlined" data-icon="verified_user">verified_user</span>
<span class="text-sm font-semibold uppercase tracking-wider">My Documents</span>
</NuxtLink>
<NuxtLink class="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-surface-container-high rounded-md transition-all duration-200" :to="paths.wizard">
<span class="material-symbols-outlined" data-icon="group">group</span>
<span class="text-sm font-semibold uppercase tracking-wider">Employees</span>
</NuxtLink>
<NuxtLink class="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-surface-container-high rounded-md transition-all duration-200" :to="paths.pending">
<span class="material-symbols-outlined" data-icon="receipt_long">receipt_long</span>
<span class="text-sm font-semibold uppercase tracking-wider">Invoices</span>
</NuxtLink>
<NuxtLink class="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-surface-container-high rounded-md transition-all duration-200" :to="paths.contacts">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
<span class="text-sm font-semibold uppercase tracking-wider">Settings</span>
</NuxtLink>
</nav>
<div class="mt-auto pt-6 border-t border-outline-variant/20">
<button class="w-full bg-primary-container text-white py-3 px-4 rounded flex items-center justify-center gap-2 hover:bg-[#162a4a] transition-all duration-300 group" @click="goToCategories">
<span class="material-symbols-outlined text-secondary" data-icon="add_circle">add_circle</span>
<span class="text-sm font-bold tracking-tight">New Training</span>
</button>
<div class="mt-6 flex items-center gap-3 px-2">
<img alt="User Profile Photo" class="w-10 h-10 rounded-full object-cover grayscale" data-alt="professional headshot of a male industrial manager wearing a suit, clean background, high quality office lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD2bUjynT4EV4kCrNjceaDT8jkQS2fxO5jxaEYjUuVpSOGoEY_zdGYISPVQaGzC8oC11jsf-70htuL4V-AECF_H5yZDHUGcimxWFdH4CGCMnZ-y-WeMO0dFtJqQFLRrKktgnwBWZV3xlO-okLcTvbKatF9XRdc7tgp_BpF7hWV-UAGbIn394IoxTTOGOIAfyEW5ACNwiyc2TspiE2nnqWIugKKXr5GTI5qwa6ccF839wPlIE068IbcIcXNKwbnWtPItfUg2SbqG57Ka"/>
<div>
<p class="text-xs font-bold text-primary">Kairat Akhmetov</p>
<p class="text-[10px] text-on-surface-variant uppercase font-bold tracking-tighter">Chief Safety Officer</p>
</div>
</div>
</div>
</aside>
<!-- Main Content Area -->
<main class="flex-1 overflow-y-auto bg-surface">
<!-- Header -->
<header class="sticky top-0 z-20 bg-primary px-8 py-4 flex justify-between items-center shadow-[0_40px_40px_rgba(10,25,47,0.06)]">
<h1 class="text-2xl font-extrabold tracking-tighter text-white">Sertificat.kz <span class="text-secondary">/</span> Corporate Cabinet</h1>
<div class="flex items-center gap-6">
<div class="relative hidden md:block">
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-primary-container" data-icon="search">search</span>
<input class="bg-[#162a4a] border-none text-white text-sm pl-10 pr-4 py-2 w-64 rounded-sm focus:ring-1 focus:ring-secondary" placeholder="Search registry..." type="text"/>
</div>
<div class="flex items-center gap-3">
<button class="p-2 text-on-primary-container hover:text-white transition-colors" @click="goToPending">
<span class="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button class="p-2 text-on-primary-container hover:text-white transition-colors" @click="goToCabinet">
<span class="material-symbols-outlined" data-icon="account_circle">account_circle</span>
</button>
</div>
</div>
</header>
<div class="p-8 max-w-[1600px] mx-auto space-y-8">
<!-- Summary Bento Grid -->
<div class="grid grid-cols-1 md:grid-cols-4 gap-6">
<!-- Widget: Total Employees -->
<div class="bg-surface-container-lowest p-6 border-l-4 border-secondary shadow-sm flex flex-col justify-between">
<div>
<p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Total Workforce</p>
<h3 class="text-4xl font-extrabold text-primary mt-1">1,482</h3>
</div>
<div class="mt-4 flex items-center text-xs text-secondary font-bold">
<span class="material-symbols-outlined text-sm" data-icon="trending_up">trending_up</span>
<span>+12 this month</span>
</div>
</div>
<!-- Widget: Active Learning -->
<div class="bg-surface-container-lowest p-6 border-l-4 border-primary shadow-sm flex flex-col justify-between">
<div>
<p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Active Learning</p>
<h3 class="text-4xl font-extrabold text-primary mt-1">84</h3>
</div>
<div class="mt-4 w-full bg-surface-container rounded-full h-1">
<div class="bg-secondary h-1 w-[65%]"></div>
</div>
</div>
<!-- Widget: Expired Certs (Critical) -->
<div class="bg-error-container p-6 border-l-4 border-error shadow-sm flex flex-col justify-between">
<div>
<p class="text-[10px] font-bold text-on-error-container uppercase tracking-widest">Expired Certificates</p>
<h3 class="text-4xl font-extrabold text-error mt-1">29</h3>
</div>
<div class="mt-4 flex items-center text-xs text-error font-bold">
<span class="material-symbols-outlined text-sm animate-pulse" data-icon="report">report</span>
<span class="ml-1">Immediate action required</span>
</div>
</div>
<!-- Widget: Compliance Risks -->
<div class="bg-surface-container-lowest p-6 border-l-4 border-tertiary shadow-sm flex flex-col justify-between">
<div>
<p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Global Risk Index</p>
<h3 class="text-4xl font-extrabold text-primary mt-1">4.2%</h3>
</div>
<div class="mt-4 flex items-center text-xs text-slate-500 font-medium">
<span>Within industry baseline</span>
</div>
</div>
</div>
<!-- Main Layout: Chart & Risk Zone -->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
<!-- Training Dynamics Chart (Visual Representation) -->
<div class="lg:col-span-2 bg-surface-container-lowest p-8 shadow-sm">
<div class="flex justify-between items-end mb-8">
<div>
<h2 class="text-xl font-extrabold text-primary tracking-tight">Training Dynamics</h2>
<p class="text-xs text-on-surface-variant font-medium">Certification throughput — Last 6 Months</p>
</div>
<div class="flex gap-4">
<div class="flex items-center gap-2">
<div class="w-3 h-3 bg-primary"></div>
<span class="text-[10px] font-bold text-on-surface-variant uppercase">Mandatory</span>
</div>
<div class="flex items-center gap-2">
<div class="w-3 h-3 bg-secondary"></div>
<span class="text-[10px] font-bold text-on-surface-variant uppercase">Elective</span>
</div>
</div>
</div>
<!-- Simplified Visual Chart -->
<div class="h-64 flex items-end justify-between gap-4 border-b border-outline-variant/30 pb-2 relative">
<!-- Grid Lines -->
<div class="absolute inset-x-0 top-0 border-t border-outline-variant/10"></div>
<div class="absolute inset-x-0 top-1/3 border-t border-outline-variant/10"></div>
<div class="absolute inset-x-0 top-2/3 border-t border-outline-variant/10"></div>
<div class="w-full flex flex-col items-center gap-1">
<div class="w-full flex flex-col gap-0.5 items-center">
<div class="w-12 bg-primary/20 h-24"></div>
<div class="w-12 bg-secondary h-12"></div>
</div>
<span class="text-[10px] font-bold text-on-surface-variant">JAN</span>
</div>
<div class="w-full flex flex-col items-center gap-1">
<div class="w-full flex flex-col gap-0.5 items-center">
<div class="w-12 bg-primary/20 h-32"></div>
<div class="w-12 bg-secondary h-8"></div>
</div>
<span class="text-[10px] font-bold text-on-surface-variant">FEB</span>
</div>
<div class="w-full flex flex-col items-center gap-1">
<div class="w-full flex flex-col gap-0.5 items-center">
<div class="w-12 bg-primary/20 h-40"></div>
<div class="w-12 bg-secondary h-16"></div>
</div>
<span class="text-[10px] font-bold text-on-surface-variant">MAR</span>
</div>
<div class="w-full flex flex-col items-center gap-1">
<div class="w-full flex flex-col gap-0.5 items-center">
<div class="w-12 bg-primary/20 h-28"></div>
<div class="w-12 bg-secondary h-20"></div>
</div>
<span class="text-[10px] font-bold text-on-surface-variant">APR</span>
</div>
<div class="w-full flex flex-col items-center gap-1">
<div class="w-full flex flex-col gap-0.5 items-center">
<div class="w-12 bg-primary/20 h-48"></div>
<div class="w-12 bg-secondary h-10"></div>
</div>
<span class="text-[10px] font-bold text-on-surface-variant">MAY</span>
</div>
<div class="w-full flex flex-col items-center gap-1">
<div class="w-full flex flex-col gap-0.5 items-center">
<div class="w-12 bg-primary/20 h-52"></div>
<div class="w-12 bg-secondary h-14"></div>
</div>
<span class="text-[10px] font-bold text-on-surface-variant">JUN</span>
</div>
</div>
</div>
<!-- Risk Zone Panel -->
<div class="bg-surface-container-high p-8 shadow-sm flex flex-col">
<div class="flex items-center gap-3 mb-6">
<span class="material-symbols-outlined text-error" data-icon="warning">warning</span>
<h2 class="text-xl font-extrabold text-primary tracking-tight">Risk Zone</h2>
</div>
<div class="space-y-4 flex-1">
<!-- Risk Item -->
<div class="bg-white p-4 shadow-sm border-l-4 border-error">
<div class="flex justify-between items-start">
<div>
<h4 class="text-sm font-bold text-primary">A. Mamutov</h4>
<p class="text-[10px] text-on-surface-variant font-medium">HSE Inspector • Tengiz Field</p>
</div>
<span class="bg-error-container text-error text-[9px] px-2 py-0.5 font-black rounded-sm uppercase">Expired</span>
</div>
<p class="text-xs text-error mt-2 font-bold">Industrial Safety Cert #339-B</p>
</div>
<!-- Risk Item -->
<div class="bg-white p-4 shadow-sm border-l-4 border-error">
<div class="flex justify-between items-start">
<div>
<h4 class="text-sm font-bold text-primary">D. Kovalev</h4>
<p class="text-[10px] text-on-surface-variant font-medium">Driller • Karachaganak</p>
</div>
<span class="bg-error-container text-error text-[9px] px-2 py-0.5 font-black rounded-sm uppercase">Expired</span>
</div>
<p class="text-xs text-error mt-2 font-bold">Fire Safety Compliance</p>
</div>
<!-- Risk Item -->
<div class="bg-white/50 p-4 shadow-sm border-l-4 border-orange-500">
<div class="flex justify-between items-start">
<div>
<h4 class="text-sm font-bold text-primary">L. Serikova</h4>
<p class="text-[10px] text-on-surface-variant font-medium">Site Manager • Almaty Hub</p>
</div>
<span class="bg-orange-100 text-orange-700 text-[9px] px-2 py-0.5 font-black rounded-sm uppercase">Expiring (5d)</span>
</div>
<p class="text-xs text-orange-700 mt-2 font-bold">Electric Safety (Group IV)</p>
</div>
</div>
<button class="w-full mt-6 text-primary text-xs font-bold uppercase tracking-widest py-2 border border-primary/20 hover:bg-white transition-colors" @click="goToCabinet">
                        View Full Registry
                    </button>
</div>
</div>
<!-- Detailed Data Table & Quick Actions -->
<div class="grid grid-cols-1 xl:grid-cols-4 gap-8">
<!-- High-Density Table -->
<div class="xl:col-span-3 bg-surface-container-lowest overflow-hidden shadow-sm">
<div class="p-6 border-b border-outline-variant/10 flex justify-between items-center">
<h2 class="text-lg font-extrabold text-primary tracking-tight">Recent Certification Activity</h2>
<div class="flex gap-2">
<button class="text-xs font-bold px-3 py-1 bg-surface-container-high rounded-sm">Filter</button>
<button class="text-xs font-bold px-3 py-1 bg-surface-container-high rounded-sm">Sort</button>
</div>
</div>
<table class="w-full text-left">
<thead class="bg-surface-container-low border-b border-outline-variant/10">
<tr>
<th class="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">Employee Name</th>
<th class="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">Certificate Type</th>
<th class="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">Status</th>
<th class="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">Expiry Date</th>
<th class="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-on-surface-variant/70">Verification</th>
</tr>
</thead>
<tbody class="divide-y divide-outline-variant/5">
<tr class="hover:bg-surface-container-low transition-colors group">
<td class="px-6 py-4 text-sm font-bold text-primary">Bolat Issakov</td>
<td class="px-6 py-4 text-sm font-medium text-on-surface-variant">High-Altitude Ops</td>
<td class="px-6 py-4">
<span class="bg-secondary-container text-on-secondary-container text-[10px] px-2 py-0.5 font-bold rounded-sm uppercase">Active</span>
</td>
<td class="px-6 py-4 text-sm font-mono text-on-surface-variant">24.11.2025</td>
<td class="px-6 py-4">
<span class="material-symbols-outlined text-secondary text-lg" data-icon="verified" style="font-variation-settings: 'FILL' 1;">verified</span>
</td>
</tr>
<tr class="hover:bg-surface-container-low transition-colors">
<td class="px-6 py-4 text-sm font-bold text-primary">Irina Pak</td>
<td class="px-6 py-4 text-sm font-medium text-on-surface-variant">Occupational Health</td>
<td class="px-6 py-4">
<span class="bg-secondary-container text-on-secondary-container text-[10px] px-2 py-0.5 font-bold rounded-sm uppercase">Active</span>
</td>
<td class="px-6 py-4 text-sm font-mono text-on-surface-variant">12.08.2026</td>
<td class="px-6 py-4">
<span class="material-symbols-outlined text-secondary text-lg" data-icon="verified" style="font-variation-settings: 'FILL' 1;">verified</span>
</td>
</tr>
<tr class="hover:bg-surface-container-low transition-colors">
<td class="px-6 py-4 text-sm font-bold text-primary">Samat Urazov</td>
<td class="px-6 py-4 text-sm font-medium text-on-surface-variant">Gas Safety Lv.3</td>
<td class="px-6 py-4">
<span class="bg-primary/10 text-primary text-[10px] px-2 py-0.5 font-bold rounded-sm uppercase">In Progress</span>
</td>
<td class="px-6 py-4 text-sm font-mono text-on-surface-variant">--.--.----</td>
<td class="px-6 py-4">
<span class="material-symbols-outlined text-on-surface-variant/30 text-lg" data-icon="pending">pending</span>
</td>
</tr>
</tbody>
</table>
</div>
<!-- Quick Actions Stack -->
<div class="space-y-4">
<h3 class="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">Command Center</h3>
<button class="w-full bg-primary text-white p-4 flex items-center justify-between shadow-md hover:translate-y-[-2px] transition-all group" @click="goToWizard">
<div class="flex items-center gap-4">
<span class="material-symbols-outlined text-secondary" data-icon="assignment_add">assignment_add</span>
<span class="text-sm font-bold uppercase tracking-wider">Assign Training</span>
</div>
<span class="material-symbols-outlined text-white/40 group-hover:text-white transition-colors" data-icon="arrow_forward">arrow_forward</span>
</button>
<button class="w-full bg-white text-primary border border-primary/10 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all group" @click="goToCourses">
<div class="flex items-center gap-4">
<span class="material-symbols-outlined" data-icon="ios_share">ios_share</span>
<span class="text-sm font-bold uppercase tracking-wider">Export Registry</span>
</div>
<span class="material-symbols-outlined text-primary/20 group-hover:text-primary transition-colors" data-icon="file_download">file_download</span>
</button>
<button class="w-full bg-white text-primary border border-primary/10 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all group" @click="goToPending">
<div class="flex items-center gap-4">
<span class="material-symbols-outlined" data-icon="credit_card">credit_card</span>
<span class="text-sm font-bold uppercase tracking-wider">Renew Contracts</span>
</div>
<span class="material-symbols-outlined text-primary/20 group-hover:text-primary transition-colors" data-icon="refresh">refresh</span>
</button>
<!-- Promotional / Info Block -->
<div class="mt-8 bg-primary-container p-6 relative overflow-hidden">
<div class="relative z-10">
<h4 class="text-white font-bold text-sm mb-2">Audit Readiness</h4>
<p class="text-[11px] text-on-primary-container leading-relaxed">Your cabinet is currently 92% compliant with Q3 state standards. Need a simulation?</p>
<button class="mt-4 text-[10px] font-black text-secondary uppercase tracking-widest border-b-2 border-secondary pb-0.5" @click="goToWizard">Start Audit Prep</button>
</div>
<div class="absolute -right-8 -bottom-8 opacity-10">
<span class="material-symbols-outlined text-[120px] text-white" data-icon="shield">shield</span>
</div>
</div>
</div>
</div>
</div>
<!-- Footer Shell -->
<footer class="w-full py-12 px-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-primary mt-12">
<div>
<h4 class="text-xl font-black text-white mb-4">Sertificat.kz</h4>
<p class="text-slate-400 text-xs max-w-md leading-relaxed">Official portal for industrial safety and professional qualification certification. Accredited by the Ministry of Emergency Situations of the Republic of Kazakhstan.</p>
</div>
<div class="flex flex-col md:items-end justify-between">
<div class="flex gap-6 mb-4">
<NuxtLink class="text-slate-400 text-xs hover:text-secondary hover:underline transition-all" :to="paths.privacy">Privacy Policy</NuxtLink>
<NuxtLink class="text-slate-400 text-xs hover:text-secondary hover:underline transition-all" :to="paths.publicOffer">Terms of Service</NuxtLink>
<NuxtLink class="text-slate-400 text-xs hover:text-secondary hover:underline transition-all" :to="paths.licenses">Accreditation Details</NuxtLink>
</div>
<p class="text-slate-500 text-[10px] uppercase font-medium tracking-widest">© 2024 Industrial Safety Certification Center Kazakhstan. All rights reserved.</p>
</div>
</footer>
</main>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  display: inline-block;
}
</style>
